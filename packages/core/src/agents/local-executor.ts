/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { type AgentLoopContext } from '../config/agent-loop-context.js';
import { reportError } from '../utils/errorReporting.js';
import { GeminiChat, StreamEventType } from '../core/geminiChat.js';
import {
  type Content,
  type Part,
  type FunctionCall,
  type FunctionDeclaration,
} from '@google/genai';
import { ToolRegistry } from '../tools/tool-registry.js';
import { type AnyDeclarativeTool } from '../tools/tools.js';
import {
  DiscoveredMCPTool,
  isMcpToolName,
  parseMcpToolName,
  MCP_TOOL_PREFIX,
} from '../tools/mcp-tool.js';
import { CompressionStatus } from '../core/turn.js';
import { type ToolCallRequestInfo } from '../scheduler/types.js';
import { ChatCompressionService } from '../services/chatCompressionService.js';
import { getDirectoryContextString } from '../utils/environmentContext.js';
import { promptIdContext } from '../utils/promptIdContext.js';
import {
  logAgentStart,
  logAgentFinish,
  logRecoveryAttempt,
} from '../telemetry/loggers.js';
import {
  AgentStartEvent,
  AgentFinishEvent,
  LlmRole,
  RecoveryAttemptEvent,
} from '../telemetry/types.js';
import {
  AgentTerminateMode,
  DEFAULT_QUERY_STRING,
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_TIME_MINUTES,
  type LocalAgentDefinition,
  type AgentInputs,
  type OutputObject,
  type SubagentActivityEvent,
} from './types.js';
import { getErrorMessage } from '../utils/errors.js';
import { templateString } from './utils.js';
import { DEFAULT_GEMINI_MODEL, isAutoModel } from '../config/models.js';
import type { RoutingContext } from '../routing/routingStrategy.js';
import { parseThought } from '../utils/thoughtUtils.js';
import { type z } from 'zod';
import { debugLogger } from '../utils/debugLogger.js';
import { getModelConfigAlias } from './registry.js';
import { getVersion } from '../utils/version.js';
import { getToolCallContext } from '../utils/toolCallContext.js';
import { scheduleAgentTools } from './agent-scheduler.js';
import { DeadlineTimer } from '../utils/deadlineTimer.js';
import {
  formatUserHintsForModel,
  formatBackgroundCompletionForModel,
} from '../utils/fastAckHelper.js';
import type { InjectionSource } from '../config/injectionService.js';

/** A callback function to report on agent activity. */
export type ActivityCallback = (activity: SubagentActivityEvent) => void;

const GRACE_PERIOD_MS = 60 * 1000; // 1 min

/** The possible outcomes of a single agent turn. */
type AgentTurnResult =
  | {
      status: 'continue';
      nextMessage: Content;
    }
  | {
      status: 'stop';
      terminateReason: AgentTerminateMode;
      finalResult: string | null;
    };

export function createUnauthorizedToolError(toolName: string): string {
  return `Unauthorized tool call: '${toolName}' is not available to this agent.`;
}

/**
 * Executes an agent loop based on an {@link AgentDefinition}.
 *
 * This executor runs the agent in a loop, calling tools until the model
 * responds with text (no tool calls), signaling completion.
 */
export class LocalAgentExecutor<TOutput extends z.ZodTypeAny> {
  readonly definition: LocalAgentDefinition<TOutput>;

  private readonly agentId: string;
  private readonly toolRegistry: ToolRegistry;
  private readonly context: AgentLoopContext;
  private readonly onActivity?: ActivityCallback;
  private readonly compressionService: ChatCompressionService;
  private readonly parentCallId?: string;
  private hasFailedCompressionAttempt = false;

  private get config(): Config {
    return this.context.config;
  }

  /**
   * Creates and validates a new `AgentExecutor` instance.
   *
   * This method ensures that all tools specified in the agent's definition are
   * safe for non-interactive use before creating the executor.
   *
   * @param definition The definition object for the agent.
   * @param context The execution context.
   * @param onActivity An optional callback to receive activity events.
   * @returns A promise that resolves to a new `LocalAgentExecutor` instance.
   */
  static async create<TOutput extends z.ZodTypeAny>(
    definition: LocalAgentDefinition<TOutput>,
    context: AgentLoopContext,
    onActivity?: ActivityCallback,
  ): Promise<LocalAgentExecutor<TOutput>> {
    const parentMessageBus = context.messageBus;

    // Create an override object to inject the subagent name into tool confirmation requests
    const subagentMessageBus = parentMessageBus.derive(definition.name);

    // Create an isolated tool registry for this agent instance.
    const agentToolRegistry = new ToolRegistry(
      context.config,
      subagentMessageBus,
    );
    const parentToolRegistry = context.toolRegistry;
    const allAgentNames = new Set(
      context.config.getAgentRegistry().getAllAgentNames(),
    );

    // Tools that should not be available to subagents.
// Based on REF_PROMPT:
// - general-purpose: All tools (*)
// - Explore/Plan: All tools except Agent, ExitPlanMode, Edit, Write, NotebookEdit

// Tools excluded from ALL subagent types (interactive/task management)
const SUBAGENT_EXCLUDED_TOOLS_ALL = new Set([
  'AskUserQuestion',  // Interactive - can't ask user in non-interactive mode
  'EnterPlanMode',    // Interactive - plan mode is for main agent only
  'ExitPlanMode',     // Interactive - plan mode is for main agent only
  'TaskOutput',       // Task management - for main agent only
  'TaskStop',         // Task management - for main agent only
]);

// Tools excluded from read-only agent types (Explore, Plan)
const SUBAGENT_EXCLUDED_TOOLS_READONLY = new Set([
  'Agent',          // Prevent recursion - subagents shouldn't spawn more subagents
  'ExitPlanMode',   // Plan mode is for main agent only (also in ALL)
  'Edit',           // Read-only for Explore/Plan agents
  'Write',          // Read-only for Explore/Plan agents
  'NotebookEdit',   // Read-only for Explore/Plan agents
]);

// Determine which tools to exclude based on agent type
// - general-purpose: only exclude interactive tools (can Edit/Write)
// - Explore/Plan: exclude read-only tools + interactive tools
const isGeneralPurpose = definition.name === 'general-purpose';
const subagentExcludedTools = isGeneralPurpose
  ? SUBAGENT_EXCLUDED_TOOLS_ALL 
  : new Set([...SUBAGENT_EXCLUDED_TOOLS_READONLY, ...SUBAGENT_EXCLUDED_TOOLS_ALL]);

    const registerToolInstance = (tool: AnyDeclarativeTool) => {
      // Check if the tool is a subagent to prevent recursion.
      // We do not allow agents to call other agents.
      // Note: 'Agent' is also in SUBAGENT_EXCLUDED_TOOLS_READONLY, but we check
      // allAgentNames too for any dynamically registered agent tools.
      if (allAgentNames.has(tool.name)) {
        debugLogger.warn(
          `[LocalAgentExecutor] Skipping subagent tool '${tool.name}' for agent '${definition.name}' to prevent recursion.`,
        );
        return;
      }

      // Exclude tools that should not be used in subagents
      if (subagentExcludedTools.has(tool.name)) {
        debugLogger.debug(
          `[LocalAgentExecutor] Excluding tool '${tool.name}' from subagent '${definition.name}'.`,
        );
        return;
      }

      agentToolRegistry.registerTool(tool);
    };

    const registerToolByName = (toolName: string) => {
      // Handle global wildcard
      if (toolName === '*') {
        for (const tool of parentToolRegistry.getAllTools()) {
          registerToolInstance(tool);
        }
        return;
      }

      // Handle MCP wildcards
      if (isMcpToolName(toolName)) {
        if (toolName === `${MCP_TOOL_PREFIX}*`) {
          for (const tool of parentToolRegistry.getAllTools()) {
            if (tool instanceof DiscoveredMCPTool) {
              registerToolInstance(tool);
            }
          }
          return;
        }

        const parsed = parseMcpToolName(toolName);
        if (parsed.serverName && parsed.toolName === '*') {
          for (const tool of parentToolRegistry.getToolsByServer(
            parsed.serverName,
          )) {
            registerToolInstance(tool);
          }
          return;
        }
      }

      // If the tool is referenced by name, retrieve it from the parent
      // registry and register it with the agent's isolated registry.
      const tool = parentToolRegistry.getTool(toolName);
      if (tool) {
        registerToolInstance(tool);
      }
    };

    if (definition.toolConfig) {
      for (const toolRef of definition.toolConfig.tools) {
        if (typeof toolRef === 'string') {
          registerToolByName(toolRef);
        } else if (
          typeof toolRef === 'object' &&
          'name' in toolRef &&
          'build' in toolRef
        ) {
          agentToolRegistry.registerTool(toolRef);
        }
        // Note: Raw `FunctionDeclaration` objects in the config don't need to be
        // registered; their schemas are passed directly to the model later.
      }
    } else {
      // If no tools are explicitly configured, default to all available tools.
      for (const toolName of parentToolRegistry.getAllToolNames()) {
        registerToolByName(toolName);
      }
    }

    agentToolRegistry.sortTools();

    // Get the parent prompt ID from context
    const parentPromptId = context.promptId;

    // Get the parent tool call ID from context
    const toolContext = getToolCallContext();
    const parentCallId = toolContext?.callId;

    return new LocalAgentExecutor(
      definition,
      context,
      agentToolRegistry,
      parentPromptId,
      parentCallId,
      onActivity,
    );
  }

  /**
   * Constructs a new AgentExecutor instance.
   *
   * @private This constructor is private. Use the static `create` method to
   * instantiate the class.
   */
  private constructor(
    definition: LocalAgentDefinition<TOutput>,
    context: AgentLoopContext,
    toolRegistry: ToolRegistry,
    parentPromptId: string | undefined,
    parentCallId: string | undefined,
    onActivity?: ActivityCallback,
  ) {
    this.definition = definition;
    this.context = context;
    this.toolRegistry = toolRegistry;
    this.onActivity = onActivity;
    this.compressionService = new ChatCompressionService();
    this.parentCallId = parentCallId;

    const randomIdPart = Math.random().toString(36).slice(2, 8);
    // parentPromptId will be undefined if this agent is invoked directly
    // (top-level), rather than as a sub-agent.
    const parentPrefix = parentPromptId ? `${parentPromptId}-` : '';
    this.agentId = `${parentPrefix}${this.definition.name}-${randomIdPart}`;
  }

  /**
   * Executes a single turn of the agent's logic, from calling the model
   * to processing its response.
   *
   * @returns An {@link AgentTurnResult} object indicating whether to continue
   * or stop the agent loop.
   */
  private async executeTurn(
    chat: GeminiChat,
    currentMessage: Content,
    turnCounter: number,
    combinedSignal: AbortSignal,
    timeoutSignal: AbortSignal, // Pass the timeout controller's signal
    onWaitingForConfirmation?: (waiting: boolean) => void,
  ): Promise<AgentTurnResult> {
    const promptId = `${this.agentId}#${turnCounter}`;

    await this.tryCompressChat(chat, promptId);

    const { functionCalls, textResponse } = await promptIdContext.run(promptId, async () =>
      this.callModel(chat, currentMessage, combinedSignal, promptId),
    );

    if (combinedSignal.aborted) {
      const terminateReason = timeoutSignal.aborted
        ? AgentTerminateMode.TIMEOUT
        : AgentTerminateMode.ABORTED;
      return {
        status: 'stop',
        terminateReason,
        finalResult: null, // 'run' method will set the final timeout string
      };
    }

    // If the model responds with text and no tool calls, the task is complete.
    // This is the normal completion path - the agent provides a text summary.
    if (functionCalls.length === 0) {
      if (textResponse) {
        return {
          status: 'stop',
          terminateReason: AgentTerminateMode.GOAL,
          finalResult: textResponse,
        };
      }
      // No text and no tool calls - unusual but treat as completion
      return {
        status: 'stop',
        terminateReason: AgentTerminateMode.GOAL,
        finalResult: 'Task completed.',
      };
    }

    const { nextMessage, aborted } =
      await this.processFunctionCalls(
        functionCalls,
        combinedSignal,
        promptId,
        onWaitingForConfirmation,
      );

    if (aborted) {
      return {
        status: 'stop',
        terminateReason: AgentTerminateMode.ABORTED,
        finalResult: null,
      };
    }

    // Task is not complete, continue to the next turn.
    return {
      status: 'continue',
      nextMessage,
    };
  }

  /**
   * Generates a specific warning message for the agent's final turn.
   */
  private getFinalWarningMessage(
    reason:
      | AgentTerminateMode.TIMEOUT
      | AgentTerminateMode.MAX_TURNS,
  ): string {
    let explanation = '';
    switch (reason) {
      case AgentTerminateMode.TIMEOUT:
        explanation = 'You have exceeded the time limit.';
        break;
      case AgentTerminateMode.MAX_TURNS:
        explanation = 'You have exceeded the maximum number of turns.';
        break;
      default:
        throw new Error(`Unknown terminate reason: ${reason}`);
    }
    return `${explanation} You have one final chance to complete the task with a short grace period. Provide your best answer and explain that your investigation was interrupted. Do not call any tools.`;
  }

  /**
   * Attempts a single, final recovery turn if the agent stops for a recoverable reason.
   * Gives the agent a grace period to provide a text response.
   *
   * @returns The final result string if recovery was successful, or `null` if it failed.
   */
  private async executeFinalWarningTurn(
    chat: GeminiChat,
    turnCounter: number,
    reason:
      | AgentTerminateMode.TIMEOUT
      | AgentTerminateMode.MAX_TURNS,
    externalSignal: AbortSignal, // The original signal passed to run()
    onWaitingForConfirmation?: (waiting: boolean) => void,
  ): Promise<string | null> {
    this.emitActivity('THOUGHT_CHUNK', {
      text: `Execution limit reached (${reason}). Attempting one final recovery turn with a grace period.`,
    });

    const recoveryStartTime = Date.now();
    let success = false;

    const gracePeriodMs = GRACE_PERIOD_MS;
    const graceTimeoutController = new AbortController();
    const graceTimeoutId = setTimeout(
      () => graceTimeoutController.abort(new Error('Grace period timed out.')),
      gracePeriodMs,
    );

    try {
      const recoveryMessage: Content = {
        role: 'user',
        parts: [{ text: this.getFinalWarningMessage(reason) }],
      };

      // We monitor both the external signal and our new grace period timeout
      const combinedSignal = AbortSignal.any([
        externalSignal,
        graceTimeoutController.signal,
      ]);

      const turnResult = await this.executeTurn(
        chat,
        recoveryMessage,
        turnCounter, // This will be the "last" turn number
        combinedSignal,
        graceTimeoutController.signal, // Pass grace signal to identify a *grace* timeout
        onWaitingForConfirmation,
      );

      if (
        turnResult.status === 'stop' &&
        turnResult.terminateReason === AgentTerminateMode.GOAL
      ) {
        // Success!
        this.emitActivity('THOUGHT_CHUNK', {
          text: 'Graceful recovery succeeded.',
        });
        success = true;
        return turnResult.finalResult ?? 'Task completed during grace period.';
      }

      // Any other outcome (continue, error, non-GOAL stop) is a failure.
      this.emitActivity('ERROR', {
        error: `Graceful recovery attempt failed. Reason: ${turnResult.status}`,
        context: 'recovery_turn',
      });
      return null;
    } catch (error) {
      // This catch block will likely catch the 'Grace period timed out' error.
      this.emitActivity('ERROR', {
        error: `Graceful recovery attempt failed: ${String(error)}`,
        context: 'recovery_turn',
      });
      return null;
    } finally {
      clearTimeout(graceTimeoutId);
      logRecoveryAttempt(
        this.config,
        new RecoveryAttemptEvent(
          this.agentId,
          this.definition.name,
          reason,
          Date.now() - recoveryStartTime,
          success,
          turnCounter,
        ),
      );
    }
  }

  /**
   * Runs the agent.
   *
   * @param inputs The validated input parameters for this invocation.
   * @param signal An `AbortSignal` for cancellation.
   * @returns A promise that resolves to the agent's final output.
   */
  async run(inputs: AgentInputs, signal: AbortSignal): Promise<OutputObject> {
    const startTime = Date.now();
    let turnCounter = 0;
    let terminateReason: AgentTerminateMode = AgentTerminateMode.ERROR;
    let finalResult: string | null = null;

    const maxTimeMinutes =
      this.definition.runConfig.maxTimeMinutes ?? DEFAULT_MAX_TIME_MINUTES;
    const maxTurns = this.definition.runConfig.maxTurns ?? DEFAULT_MAX_TURNS;

    const deadlineTimer = new DeadlineTimer(
      maxTimeMinutes * 60 * 1000,
      'Agent timed out.',
    );

    // Track time spent waiting for user confirmation to credit it back to the agent.
    const onWaitingForConfirmation = (waiting: boolean) => {
      if (waiting) {
        deadlineTimer.pause();
      } else {
        deadlineTimer.resume();
      }
    };

    // Combine the external signal with the internal timeout signal.
    const combinedSignal = AbortSignal.any([signal, deadlineTimer.signal]);

    logAgentStart(
      this.config,
      new AgentStartEvent(this.agentId, this.definition.name),
    );

    let chat: GeminiChat | undefined;
    let tools: FunctionDeclaration[] | undefined;
    try {
      // Inject standard runtime context into inputs
      const augmentedInputs = {
        ...inputs,
        cliVersion: await getVersion(),
        activeModel: this.config.getActiveModel(),
        today: new Date().toLocaleDateString(),
      };

      tools = this.prepareToolsList();
      chat = await this.createChatObject(augmentedInputs, tools);
      const query = this.definition.promptConfig.query
        ? templateString(this.definition.promptConfig.query, augmentedInputs)
        : DEFAULT_QUERY_STRING;

      const pendingHintsQueue: string[] = [];
      const pendingBgCompletionsQueue: string[] = [];
      const injectionListener = (text: string, source: InjectionSource) => {
        if (source === 'user_steering') {
          pendingHintsQueue.push(text);
        } else if (source === 'background_completion') {
          pendingBgCompletionsQueue.push(text);
        }
      };
      // Capture the index of the last hint before starting to avoid re-injecting old hints.
      // NOTE: Hints added AFTER this point will be broadcast to all currently running
      // local agents via the listener below.
      const startIndex = this.config.injectionService.getLatestInjectionIndex();
      this.config.injectionService.onInjection(injectionListener);

      try {
        const initialHints = this.config.injectionService.getInjectionsAfter(
          startIndex,
          'user_steering',
        );
        const formattedInitialHints = formatUserHintsForModel(initialHints);

        let currentMessage: Content = formattedInitialHints
          ? {
              role: 'user',
              parts: [{ text: formattedInitialHints }, { text: query }],
            }
          : { role: 'user', parts: [{ text: query }] };

        while (true) {
          // Check for termination conditions like max turns.
          const reason = this.checkTermination(turnCounter, maxTurns);
          if (reason) {
            terminateReason = reason;
            break;
          }

          // Check for timeout or external abort.
          if (combinedSignal.aborted) {
            // Determine which signal caused the abort.
            terminateReason = deadlineTimer.signal.aborted
              ? AgentTerminateMode.TIMEOUT
              : AgentTerminateMode.ABORTED;
            break;
          }

          const turnResult = await this.executeTurn(
            chat,
            currentMessage,
            turnCounter++,
            combinedSignal,
            deadlineTimer.signal,
            onWaitingForConfirmation,
          );

          if (turnResult.status === 'stop') {
            terminateReason = turnResult.terminateReason;
            // Only set finalResult if the turn provided one (e.g., error or goal).
            if (turnResult.finalResult) {
              finalResult = turnResult.finalResult;
            }
            break; // Exit the loop for *any* stop reason.
          }

          // If status is 'continue', update message for the next loop
          currentMessage = turnResult.nextMessage;

          // Prepend inter-turn injections. User hints are unshifted first so
          // that bg completions (unshifted second) appear before them in the
          // final message — the model sees context before the user's reaction.
          if (pendingHintsQueue.length > 0) {
            const hintsToProcess = [...pendingHintsQueue];
            pendingHintsQueue.length = 0;
            const formattedHints = formatUserHintsForModel(hintsToProcess);
            if (formattedHints) {
              currentMessage.parts ??= [];
              currentMessage.parts.unshift({ text: formattedHints });
            }
          }

          if (pendingBgCompletionsQueue.length > 0) {
            const bgText = pendingBgCompletionsQueue.join('\n');
            pendingBgCompletionsQueue.length = 0;
            currentMessage.parts ??= [];
            currentMessage.parts.unshift({
              text: formatBackgroundCompletionForModel(bgText),
            });
          }
        }
      } finally {
        this.config.injectionService.offInjection(injectionListener);
      }

      // === UNIFIED RECOVERY BLOCK ===
      // Only attempt recovery if it's a known recoverable reason.
      // We don't recover from GOAL (already done) or ABORTED (user cancelled).
      if (
        terminateReason !== AgentTerminateMode.ERROR &&
        terminateReason !== AgentTerminateMode.ABORTED &&
        terminateReason !== AgentTerminateMode.GOAL
      ) {
        const recoveryResult = await this.executeFinalWarningTurn(
          chat,
          turnCounter, // Use current turnCounter for the recovery attempt
          terminateReason,
          signal, // Pass the external signal
          onWaitingForConfirmation,
        );

        if (recoveryResult !== null) {
          // Recovery Succeeded
          terminateReason = AgentTerminateMode.GOAL;
          finalResult = recoveryResult;
        } else {
          // Recovery Failed. Set the final error message based on the *original* reason.
          if (terminateReason === AgentTerminateMode.TIMEOUT) {
            finalResult = `Agent timed out after ${maxTimeMinutes} minutes.`;
            this.emitActivity('ERROR', {
              error: finalResult,
              context: 'timeout',
            });
          } else if (terminateReason === AgentTerminateMode.MAX_TURNS) {
            finalResult = `Agent reached max turns limit (${maxTurns}).`;
            this.emitActivity('ERROR', {
              error: finalResult,
              context: 'max_turns',
            });
          }
        }
      }

      // === FINAL RETURN LOGIC ===
      if (terminateReason === AgentTerminateMode.GOAL) {
        return {
          result: finalResult || 'Task completed.',
          terminate_reason: terminateReason,
        };
      }

      return {
        result:
          finalResult || 'Agent execution was terminated before completion.',
        terminate_reason: terminateReason,
      };
    } catch (error) {
      // Check if the error is an AbortError caused by our internal timeout.
      if (
        error instanceof Error &&
        error.name === 'AbortError' &&
        deadlineTimer.signal.aborted &&
        !signal.aborted // Ensure the external signal was not the cause
      ) {
        terminateReason = AgentTerminateMode.TIMEOUT;

        // Also use the unified recovery logic here
        if (chat && tools) {
          const recoveryResult = await this.executeFinalWarningTurn(
            chat,
            turnCounter, // Use current turnCounter
            AgentTerminateMode.TIMEOUT,
            signal,
            onWaitingForConfirmation,
          );

          if (recoveryResult !== null) {
            // Recovery Succeeded
            terminateReason = AgentTerminateMode.GOAL;
            finalResult = recoveryResult;
            return {
              result: finalResult,
              terminate_reason: terminateReason,
            };
          }
        }

        // Recovery failed or wasn't possible
        finalResult = `Agent timed out after ${maxTimeMinutes} minutes.`;
        this.emitActivity('ERROR', {
          error: finalResult,
          context: 'timeout',
        });
        return {
          result: finalResult,
          terminate_reason: terminateReason,
        };
      }

      this.emitActivity('ERROR', { error: String(error) });
      throw error; // Re-throw other errors or external aborts.
    } finally {
      deadlineTimer.abort();
      logAgentFinish(
        this.config,
        new AgentFinishEvent(
          this.agentId,
          this.definition.name,
          Date.now() - startTime,
          turnCounter,
          terminateReason,
        ),
      );
    }
  }

  private async tryCompressChat(
    chat: GeminiChat,
    prompt_id: string,
  ): Promise<void> {
    const model = this.definition.modelConfig.model ?? DEFAULT_GEMINI_MODEL;

    const { newHistory, info } = await this.compressionService.compress(
      chat,
      prompt_id,
      false,
      model,
      this.config,
      this.hasFailedCompressionAttempt,
    );

    if (
      info.compressionStatus ===
      CompressionStatus.COMPRESSION_FAILED_INFLATED_TOKEN_COUNT
    ) {
      this.hasFailedCompressionAttempt = true;
    } else if (info.compressionStatus === CompressionStatus.COMPRESSED) {
      if (newHistory) {
        chat.setHistory(newHistory);
        this.hasFailedCompressionAttempt = false;
      }
    } else if (info.compressionStatus === CompressionStatus.CONTENT_TRUNCATED) {
      if (newHistory) {
        chat.setHistory(newHistory);
        // Do NOT reset hasFailedCompressionAttempt.
        // We only truncated content because summarization previously failed.
        // We want to keep avoiding expensive summarization calls.
      }
    }
  }

  /**
   * Calls the generative model with the current context and tools.
   *
   * @returns The model's response, including any tool calls or text.
   */
  private async callModel(
    chat: GeminiChat,
    message: Content,
    signal: AbortSignal,
    promptId: string,
  ): Promise<{ functionCalls: FunctionCall[]; textResponse: string }> {
    const modelConfigAlias = getModelConfigAlias(this.definition);

    // Resolve the model config early to get the concrete model string (which may be `auto`).
    const resolvedConfig = this.config.modelConfigService.getResolvedConfig({
      model: modelConfigAlias,
      overrideScope: this.definition.name,
    });
    const requestedModel = resolvedConfig.model;

    let modelToUse: string;
    if (isAutoModel(requestedModel)) {
      // TODO(joshualitt): This try / catch is inconsistent with the routing
      // behavior for the main agent. Ideally, we would have a universal
      // policy for routing failure. Given routing failure does not necessarily
      // mean generation will fail, we may want to share this logic with
      // other places we use model routing.
      try {
        const routingContext: RoutingContext = {
          history: chat.getHistory(/*curated=*/ true),
          request: message.parts || [],
          signal,
          requestedModel,
        };
        const router = this.config.getModelRouterService();
        const decision = await router.route(routingContext);
        modelToUse = decision.model;
      } catch (error) {
        debugLogger.warn(`Error during model routing: ${error}`);
        modelToUse = DEFAULT_GEMINI_MODEL;
      }
    } else {
      modelToUse = requestedModel;
    }

    const role = LlmRole.SUBAGENT;

    const responseStream = await chat.sendMessageStream(
      {
        model: modelToUse,
        overrideScope: this.definition.name,
      },
      message.parts || [],
      promptId,
      signal,
      role,
    );

    const functionCalls: FunctionCall[] = [];
    let textResponse = '';

    for await (const resp of responseStream) {
      if (signal.aborted) break;

      if (resp.type === StreamEventType.CHUNK) {
        const chunk = resp.value;
        const parts = chunk.candidates?.[0]?.content?.parts;

        // Extract and emit any subject "thought" content from the model.
        const { subject } = parseThought(
          parts?.find((p) => p.thought)?.text || '',
        );
        if (subject) {
          this.emitActivity('THOUGHT_CHUNK', { text: subject });
        }

        // Collect any function calls requested by the model.
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }

        // Handle text response (non-thought text)
        const text =
          parts
            ?.filter((p) => !p.thought && p.text)
            .map((p) => p.text)
            .join('') || '';

        if (text) {
          textResponse += text;
        }
      }
    }

    return { functionCalls, textResponse };
  }

  /** Initializes a `GeminiChat` instance for the agent run. */
  private async createChatObject(
    inputs: AgentInputs,
    tools: FunctionDeclaration[],
  ): Promise<GeminiChat> {
    const { promptConfig } = this.definition;

    if (!promptConfig.systemPrompt && !promptConfig.initialMessages) {
      throw new Error(
        'PromptConfig must define either `systemPrompt` or `initialMessages`.',
      );
    }

    const startHistory = this.applyTemplateToInitialMessages(
      promptConfig.initialMessages ?? [],
      inputs,
    );

    // Build system instruction from the templated prompt string.
    const systemInstruction = promptConfig.systemPrompt
      ? await this.buildSystemPrompt(inputs)
      : undefined;

    try {
      return new GeminiChat(
        this.config,
        systemInstruction,
        [{ functionDeclarations: tools }],
        startHistory,
        undefined,
        undefined,
        'subagent',
      );
    } catch (e: unknown) {
      await reportError(
        e,
        `Error initializing Gemini chat for agent ${this.definition.name}.`,
        startHistory,
        'startChat',
      );
      // Re-throw as a more specific error after reporting.
      throw new Error(`Failed to create chat object: ${getErrorMessage(e)}`);
    }
  }

  /**
   * Executes function calls requested by the model and returns the results.
   *
   * @returns A new `Content` object for history and abort status.
   */
  private async processFunctionCalls(
    functionCalls: FunctionCall[],
    signal: AbortSignal,
    promptId: string,
    onWaitingForConfirmation?: (waiting: boolean) => void,
  ): Promise<{
    nextMessage: Content;
    aborted: boolean;
  }> {
    const allowedToolNames = new Set(this.toolRegistry.getAllToolNames());

    let aborted = false;

    const toolRequests: ToolCallRequestInfo[] = [];
    // Map to keep track of tool name by callId for activity emission
    const toolNameMap = new Map<string, string>();
    // Synchronous results (like unauthorized calls)
    const syncResults = new Map<string, Part>();

    for (const [index, functionCall] of functionCalls.entries()) {
      const callId = functionCall.id ?? `${promptId}-${index}`;
      const args = functionCall.args ?? {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const toolName = functionCall.name as string;

      let displayName = toolName;
      let description: string | undefined = undefined;

      try {
        const tool = this.toolRegistry.getTool(toolName);
        if (tool) {
          displayName = tool.displayName ?? toolName;
          const invocation = tool.build(args);
          description = invocation.getDescription();
        }
      } catch {
        // Ignore errors during formatting for activity emission
      }

      this.emitActivity('TOOL_CALL_START', {
        name: toolName,
        displayName,
        description,
        args,
        callId,
      });

      // Handle standard tools
      if (!allowedToolNames.has(toolName)) {
        const error = createUnauthorizedToolError(toolName);
        debugLogger.warn(`[LocalAgentExecutor] Blocked call: ${error}`);

        syncResults.set(callId, {
          functionResponse: {
            name: toolName,
            id: callId,
            response: { error },
          },
        });

        this.emitActivity('ERROR', {
          context: 'tool_call_unauthorized',
          name: toolName,
          callId,
          error,
        });

        continue;
      }

      toolRequests.push({
        callId,
        name: toolName,
        args,
        isClientInitiated: false, // These are coming from the subagent (the "model")
        prompt_id: promptId,
      });
      toolNameMap.set(callId, toolName);
    }

    // Execute standard tool calls using the new scheduler
    if (toolRequests.length > 0) {
      const completedCalls = await scheduleAgentTools(
        this.config,
        toolRequests,
        {
          schedulerId: this.agentId,
          subagent: this.definition.name,
          parentCallId: this.parentCallId,
          toolRegistry: this.toolRegistry,
          signal,
          onWaitingForConfirmation,
        },
      );

      for (const call of completedCalls) {
        const toolName =
          toolNameMap.get(call.request.callId) || call.request.name;
        if (call.status === 'success') {
          this.emitActivity('TOOL_CALL_END', {
            name: toolName,
            id: call.request.callId,
            output: call.response.resultDisplay,
          });
        } else if (call.status === 'error') {
          this.emitActivity('ERROR', {
            context: 'tool_call',
            name: toolName,
            callId: call.request.callId,
            error: call.response.error?.message || 'Unknown error',
          });
        } else if (call.status === 'cancelled') {
          this.emitActivity('ERROR', {
            context: 'tool_call',
            name: toolName,
            callId: call.request.callId,
            error: 'Request cancelled.',
          });
          aborted = true;
        }

        // Add result to syncResults to preserve order later
        syncResults.set(call.request.callId, call.response.responseParts[0]);
      }
    }

    // Reconstruct toolResponseParts in the original order
    const toolResponseParts: Part[] = [];
    for (const [index, functionCall] of functionCalls.entries()) {
      const callId = functionCall.id ?? `${promptId}-${index}`;
      const part = syncResults.get(callId);
      if (part) {
        toolResponseParts.push(part);
      }
    }

    // If all tool calls failed, provide a generic error.
    if (functionCalls.length > 0 && toolResponseParts.length === 0) {
      toolResponseParts.push({
        text: 'All tool calls failed or were unauthorized. Please analyze the errors and try an alternative approach.',
      });
    }

    return {
      nextMessage: { role: 'user', parts: toolResponseParts },
      aborted,
    };
  }

  /**
   * Prepares the list of tool function declarations to be sent to the model.
   */
  private prepareToolsList(): FunctionDeclaration[] {
    const toolsList: FunctionDeclaration[] = [];
    const { toolConfig } = this.definition;

    if (toolConfig) {
      for (const toolRef of toolConfig.tools) {
        if (typeof toolRef === 'object' && !('schema' in toolRef)) {
          // Raw `FunctionDeclaration` object.
          toolsList.push(toolRef);
        }
      }
      // Add schemas from tools that were explicitly registered by name, wildcard, or instance.
      toolsList.push(...this.toolRegistry.getFunctionDeclarations());
    }

    return toolsList;
  }

  /** Builds the system prompt from the agent definition and inputs. */
  private async buildSystemPrompt(inputs: AgentInputs): Promise<string> {
    const { promptConfig } = this.definition;
    if (!promptConfig.systemPrompt) {
      return '';
    }

    // Inject user inputs into the prompt template.
    let finalPrompt = templateString(promptConfig.systemPrompt, inputs);

    // Append environment context (CWD and folder structure).
    const dirContext = await getDirectoryContextString(this.config);
    finalPrompt += `\n\n# Environment Context\n${dirContext}`;

    // Append standard rules for non-interactive execution.
    finalPrompt += `
Important Rules:
* You are running in a non-interactive mode. You CANNOT ask the user for input or clarification.
* Work systematically using available tools to complete your task.
* Always use absolute paths for file operations. Construct them using the provided "Environment Context".
* When you have completed your task, provide a clear summary of your findings and results as your final response.`;

    return finalPrompt;
  }

  /**
   * Applies template strings to initial messages.
   *
   * @param initialMessages The initial messages from the prompt config.
   * @param inputs The validated input parameters for this invocation.
   * @returns A new array of `Content` with templated strings.
   */
  private applyTemplateToInitialMessages(
    initialMessages: Content[],
    inputs: AgentInputs,
  ): Content[] {
    return initialMessages.map((content) => {
      const newParts = (content.parts ?? []).map((part) => {
        if ('text' in part && part.text !== undefined) {
          return { text: templateString(part.text, inputs) };
        }
        return part;
      });
      return { ...content, parts: newParts };
    });
  }

  /**
   * Checks if the agent should terminate due to exceeding configured limits.
   *
   * @returns The reason for termination, or `null` if execution can continue.
   */
  private checkTermination(
    turnCounter: number,
    maxTurns: number,
  ): AgentTerminateMode | null {
    if (turnCounter >= maxTurns) {
      return AgentTerminateMode.MAX_TURNS;
    }

    return null;
  }

  /** Emits an activity event to the configured callback. */
  private emitActivity(
    type: SubagentActivityEvent['type'],
    data: Record<string, unknown>,
  ): void {
    if (this.onActivity) {
      const event: SubagentActivityEvent = {
        isSubagentActivityEvent: true,
        agentName: this.definition.name,
        type,
        data,
      };
      this.onActivity(event);
    }
  }
}

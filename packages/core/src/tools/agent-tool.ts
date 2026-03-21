/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  type ToolResult,
  Kind,
  type ToolLiveOutput,
  type ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { AGENT_TOOL_NAME } from './tool-names.js';
import { AGENT_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { type AgentLoopContext } from '../config/agent-loop-context.js';
import { LocalSubagentInvocation } from '../agents/local-invocation.js';
import { type LocalAgentDefinition, type AgentInputs } from '../agents/types.js';
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';
import { ToolErrorType } from './tool-error.js';

export interface AgentParams {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  resume?: string;
  run_in_background?: boolean;
  isolation?: 'worktree';
  max_turns?: number;
}

/**
 * Agent type definitions for the Agent tool
 */
interface AgentTypeInfo {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
}

/**
 * Built-in agent type configurations
 */
const AGENT_TYPES: Record<string, AgentTypeInfo> = {
  'general-purpose': {
    name: 'general-purpose',
    displayName: 'General Purpose Agent',
    description: 'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)',
    systemPrompt: `You are a helpful AI assistant. Complete the task thoroughly and accurately.
Use available tools as needed. When done, provide a clear summary of what was accomplished.`,
    tools: ['*'], // All tools
  },
  Explore: {
    name: 'Explore',
    displayName: 'Code Explorer',
    description: 'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions. (Tools: All tools except Agent, ExitPlanMode, Edit, Write, NotebookEdit)',
    systemPrompt: `You are an expert code explorer. Your job is to efficiently search and understand codebases.
Focus on finding relevant files, understanding code structure, and answering questions about the code.
Be thorough but concise in your findings.`,
    tools: ['*'], // Will be filtered by executor
  },
  Plan: {
    name: 'Plan',
    displayName: 'Planning Agent',
    description: 'Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, ExitPlanMode, Edit, Write, NotebookEdit)',
    systemPrompt: `You are a software architect. Design implementation plans step-by-step.
Identify critical files and consider architectural trade-offs.
Return a clear, actionable plan with specific file paths and code changes.`,
    tools: ['*'], // Will be filtered by executor
  },
};

/**
 * Tool for launching specialized agents to handle complex tasks.
 * Integrates with the LocalAgentExecutor for subagent execution.
 */
export class AgentTool extends BaseDeclarativeTool<AgentParams, ToolResult> {
  static readonly Name = AGENT_TOOL_NAME;

  constructor(
    private readonly context: AgentLoopContext,
    messageBus: MessageBus,
  ) {
    super(
      AgentTool.Name,
      'Agent',
      AGENT_DEFINITION.base.description!,
      Kind.Agent,
      AGENT_DEFINITION.base.parametersJsonSchema,
      messageBus,
      /* isOutputMarkdown */ true,
      /* canUpdateOutput */ true,
    );
  }

  protected createInvocation(
    params: AgentParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): AgentInvocation {
    return new AgentInvocation(
      this.context.config,
      this.context,
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(AGENT_DEFINITION, modelId);
  }
}

export class AgentInvocation extends BaseToolInvocation<
  AgentParams,
  ToolResult
> {
  private confirmationOutcome: ToolConfirmationOutcome | null = null;

  constructor(
    private readonly config: Config,
    private readonly context: AgentLoopContext,
    params: AgentParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return this.params.description || 'Agent task';
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Check if we have a message bus for policy decisions
    if (!this.messageBus) {
      return false;
    }

    // Agent tool requires user confirmation for isolation mode
    if (this.params.isolation === 'worktree') {
      return {
        type: 'info',
        title: 'Agent with Worktree Isolation',
        prompt: `This agent task will run in an isolated git worktree. Continue?`,
        onConfirm: async (outcome: ToolConfirmationOutcome) => {
          this.confirmationOutcome = outcome;
        },
      };
    }

    return false;
  }

  private getAgentDefinition(): LocalAgentDefinition {
    const { subagent_type, max_turns } = this.params;
    const agentType = AGENT_TYPES[subagent_type] || AGENT_TYPES['general-purpose'];

    // Always use active model for subagent
    const modelId = this.config.getActiveModel();

    const definition: LocalAgentDefinition = {
      name: agentType.name,
      displayName: agentType.displayName,
      description: agentType.description,
      kind: 'local',
      inputConfig: {
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The task to perform' },
          },
          required: ['prompt'],
        },
      },
      promptConfig: {
        systemPrompt: agentType.systemPrompt,
        query: '${prompt}',
      },
      modelConfig: {
        model: modelId,
      },
      runConfig: {
        maxTurns: max_turns || 30,
        maxTimeMinutes: 10,
      },
      toolConfig: {
        tools: agentType.tools,
      },
    };

    return definition;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolLiveOutput) => void,
  ): Promise<ToolResult> {
    const {
      description,
      prompt,
      subagent_type,
      resume,
      run_in_background,
      isolation,
    } = this.params;

    // Check cancellation
    if (this.confirmationOutcome === ToolConfirmationOutcome.Cancel) {
      return {
        llmContent: 'Agent task cancelled by user.',
        returnDisplay: 'Cancelled',
      };
    }

    // Handle resume case
    if (resume) {
      // For now, we don't support resuming agents
      return {
        llmContent: `Agent resume is not yet implemented. Resume ID: ${resume}`,
        returnDisplay: 'Resume not supported',
      };
    }

    // Get agent definition
    const agentDefinition = this.getAgentDefinition();

    // Prepare inputs
    const inputs: AgentInputs = { prompt };

    try {
      if (run_in_background) {
        // Create a virtual execution for background mode
        const handle = ExecutionLifecycleService.createExecution(
          '',
          () => {
            // Kill handler - signal abort
            signal.addEventListener('abort', () => {});
          },
          'none',
          (output, error) => {
            if (error) {
              return `Agent "${description}" failed: ${error.message}`;
            }
            return output || `Agent "${description}" completed`;
          },
        );

        const executionId = handle.pid;
        if (executionId === undefined) {
          return {
            llmContent: 'Failed to create background execution: no execution ID',
            returnDisplay: 'Failed to start agent',
            error: {
              message: 'Failed to allocate execution ID',
              type: ToolErrorType.EXECUTION_FAILED,
            },
          };
        }

        // Run agent in background
        this.runAgentInBackground(
          agentDefinition,
          inputs,
          executionId,
          signal,
        ).catch((error) => {
          ExecutionLifecycleService.completeExecution(executionId, {
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });

        return {
          llmContent: `Agent "${description}" started in background (ID: ${executionId}).
Subagent Type: ${subagent_type}
Model: ${this.config.getActiveModel()}
Isolation: ${isolation || 'None'}`,
          returnDisplay: `Agent started: ${description}`,
          data: {
            pid: executionId,
            command: `agent: ${description}`,
            initialOutput: '',
          },
        };
      }

      // Run agent in foreground
      const invocation = new LocalSubagentInvocation(
        agentDefinition,
        this.context,
        inputs,
        this.messageBus,
        AgentTool.Name,
        'Agent',
      );

      const result = await invocation.execute(signal, updateOutput);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if this was an abort
      if (signal.aborted || errorMessage.includes('Abort')) {
        return {
          llmContent: `Agent "${description}" was cancelled.`,
          returnDisplay: 'Agent cancelled',
        };
      }

      return {
        llmContent: `Agent "${description}" failed: ${errorMessage}`,
        returnDisplay: `Agent failed: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private async runAgentInBackground(
    definition: LocalAgentDefinition,
    inputs: AgentInputs,
    executionId: number,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const invocation = new LocalSubagentInvocation(
        definition,
        this.context,
        inputs,
        this.messageBus,
        AgentTool.Name,
        'Agent',
      );

      // Subscribe to output and forward to execution lifecycle
      const unsubscribe = ExecutionLifecycleService.subscribe(
        executionId,
        (event) => {
          if (event.type === 'data' && typeof event.chunk === 'string') {
            ExecutionLifecycleService.appendOutput(executionId, event.chunk);
          }
        },
      );

      const result = await invocation.execute(signal);

      unsubscribe();

      // Complete the execution
      ExecutionLifecycleService.completeExecution(executionId, {
        exitCode: result.error ? 1 : 0,
        error: result.error
          ? new Error(result.error.message)
          : undefined,
      });
    } catch (error) {
      ExecutionLifecycleService.completeExecution(executionId, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
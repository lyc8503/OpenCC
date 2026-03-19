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
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { AGENT_TOOL_NAME } from './tool-names.js';
import { AGENT_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

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
 * Tool for launching specialized agents to handle complex tasks.
 * Note: This is a placeholder implementation. Full implementation requires
 * integration with the agent execution system.
 */
export class AgentTool extends BaseDeclarativeTool<
  AgentParams,
  ToolResult
> {
  static readonly Name = AGENT_TOOL_NAME;

  constructor(
    _config: Config,
    messageBus: MessageBus,
  ) {
    super(
      AgentTool.Name,
      'Agent',
      AGENT_DEFINITION.base.description!,
      Kind.Agent,
      AGENT_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: AgentParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): AgentInvocation {
    return new AgentInvocation(
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
  constructor(
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

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { description, prompt, subagent_type, model, resume, run_in_background, isolation } = this.params;

    // TODO: Integrate with actual agent execution system
    // For now, return a placeholder message
    return {
      llmContent: `Agent execution is not yet implemented.
Description: ${description}
Subagent Type: ${subagent_type}
Prompt: ${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}
Model: ${model || 'default'}
Resume: ${resume || 'N/A'}
Background: ${run_in_background ? 'Yes' : 'No'}
Isolation: ${isolation || 'None'}`,
      returnDisplay: `Agent task: ${description}`,
    };
  }
}
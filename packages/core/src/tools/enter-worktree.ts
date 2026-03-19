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
  type ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { ENTER_WORKTREE_TOOL_NAME } from './tool-names.js';
import { ENTER_WORKTREE_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

export interface EnterWorktreeParams {
  name?: string;
}

/**
 * Tool for entering a git worktree.
 * Note: This is a placeholder implementation. Full implementation requires
 * integration with git worktree management.
 */
export class EnterWorktreeTool extends BaseDeclarativeTool<
  EnterWorktreeParams,
  ToolResult
> {
  static readonly Name = ENTER_WORKTREE_TOOL_NAME;

  constructor(
    _config: Config,
    messageBus: MessageBus,
  ) {
    super(
      EnterWorktreeTool.Name,
      'Enter Worktree',
      ENTER_WORKTREE_DEFINITION.base.description!,
      Kind.Edit,
      ENTER_WORKTREE_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: EnterWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): EnterWorktreeInvocation {
    return new EnterWorktreeInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(ENTER_WORKTREE_DEFINITION, modelId);
  }
}

export class EnterWorktreeInvocation extends BaseToolInvocation<
  EnterWorktreeParams,
  ToolResult
> {
  private confirmationOutcome: ToolConfirmationOutcome | null = null;

  constructor(
    params: EnterWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    const name = this.params.name || 'random name';
    return `Creating worktree: ${name}`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolInfoConfirmationDetails | false> {
    // This tool requires user confirmation
    return {
      type: 'info',
      title: 'Enter Worktree',
      prompt: `This will create an isolated git worktree${this.params.name ? ` named "${this.params.name}"` : ''}. Continue?`,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        this.confirmationOutcome = outcome;
      },
    };
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (this.confirmationOutcome === ToolConfirmationOutcome.Cancel) {
      return {
        llmContent: 'Worktree creation cancelled by user.',
        returnDisplay: 'Cancelled',
      };
    }

    const name = this.params.name || `worktree-${Date.now()}`;

    // TODO: Integrate with actual git worktree management
    // For now, return a placeholder message
    return {
      llmContent: `Git worktree functionality is not yet implemented. Requested worktree name: ${name}`,
      returnDisplay: `Worktree ${name} creation pending`,
    };
  }
}
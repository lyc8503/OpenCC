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
import { TASK_STOP_TOOL_NAME } from './tool-names.js';
import { TASK_STOP_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

export interface TaskStopParams {
  task_id: string;
  shell_id?: string; // Deprecated, use task_id instead
}

/**
 * Tool for stopping background tasks.
 * Note: This is a placeholder implementation. Full implementation requires
 * integration with the task management system.
 */
export class TaskStopTool extends BaseDeclarativeTool<
  TaskStopParams,
  ToolResult
> {
  static readonly Name = TASK_STOP_TOOL_NAME;

  constructor(
    _config: Config,
    messageBus: MessageBus,
  ) {
    super(
      TaskStopTool.Name,
      'Task Stop',
      TASK_STOP_DEFINITION.base.description!,
      Kind.Edit,
      TASK_STOP_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: TaskStopParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): TaskStopInvocation {
    return new TaskStopInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(TASK_STOP_DEFINITION, modelId);
  }
}

export class TaskStopInvocation extends BaseToolInvocation<
  TaskStopParams,
  ToolResult
> {
  constructor(
    params: TaskStopParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    const taskId = this.params.task_id || this.params.shell_id || 'unknown';
    return `Stopping task: ${taskId}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const taskId = this.params.task_id || this.params.shell_id;

    if (!taskId) {
      return {
        llmContent: 'Error: No task ID provided.',
        returnDisplay: 'Error: Missing task ID',
      };
    }

    // TODO: Integrate with actual task management system
    // For now, return a placeholder message
    return {
      llmContent: `Task stop is not yet implemented. Task ID: ${taskId}`,
      returnDisplay: `Task ${taskId} stop requested`,
    };
  }
}
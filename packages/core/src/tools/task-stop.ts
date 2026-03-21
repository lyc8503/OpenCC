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
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';
import { ShellExecutionService } from '../services/shellExecutionService.js';

export interface TaskStopParams {
  task_id?: string;
  shell_id?: string; // Deprecated, use task_id instead
}

/**
 * Tool for stopping background tasks and shell executions.
 * Integrates with ExecutionLifecycleService and ShellExecutionService
 * to terminate running processes.
 */
export class TaskStopTool extends BaseDeclarativeTool<
  TaskStopParams,
  ToolResult
> {
  static readonly Name = TASK_STOP_TOOL_NAME;

  constructor(_config: Config, messageBus: MessageBus) {
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

    // Try to parse as numeric PID
    const numericId = parseInt(taskId, 10);

    if (isNaN(numericId)) {
      return {
        llmContent: `Error: Invalid task ID format. Expected a numeric process ID, got: ${taskId}`,
        returnDisplay: `Error: Invalid task ID`,
      };
    }

    const isKnown = ExecutionLifecycleService.isKnown(numericId);
    const isActive = ExecutionLifecycleService.isActive(numericId);

    if (!isKnown && !isActive) {
      return {
        llmContent: `Task ${taskId} is not running or has already completed.`,
        returnDisplay: `Task ${taskId} not found or already stopped`,
      };
    }

    try {
      // Try lifecycle service first for tracked executions (virtual/external)
      if (isKnown) {
        ExecutionLifecycleService.kill(numericId);
        return {
          llmContent: `Successfully stopped task ${taskId}.`,
          returnDisplay: `Task ${taskId} stopped`,
        };
      }

      // Fallback to shell execution service for OS-level processes
      await ShellExecutionService.kill(numericId);
      return {
        llmContent: `Successfully stopped shell process ${taskId}.`,
        returnDisplay: `Process ${taskId} stopped`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to stop task ${taskId}: ${errorMessage}`,
        returnDisplay: `Failed to stop task ${taskId}`,
      };
    }
  }
}
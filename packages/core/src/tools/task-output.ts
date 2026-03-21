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
import { TASK_OUTPUT_TOOL_NAME } from './tool-names.js';
import { TASK_OUTPUT_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';

export interface TaskOutputParams {
  task_id: string;
  block?: boolean;
  timeout?: number;
}

/**
 * Tool for retrieving output from background tasks.
 * Integrates with ExecutionLifecycleService to get output from running
 * or recently completed executions.
 */
export class TaskOutputTool extends BaseDeclarativeTool<
  TaskOutputParams,
  ToolResult
> {
  static readonly Name = TASK_OUTPUT_TOOL_NAME;

  constructor(_config: Config, messageBus: MessageBus) {
    super(
      TaskOutputTool.Name,
      'Task Output',
      TASK_OUTPUT_DEFINITION.base.description!,
      Kind.Read,
      TASK_OUTPUT_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: TaskOutputParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): TaskOutputInvocation {
    return new TaskOutputInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(TASK_OUTPUT_DEFINITION, modelId);
  }
}

export class TaskOutputInvocation extends BaseToolInvocation<
  TaskOutputParams,
  ToolResult
> {
  constructor(
    params: TaskOutputParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return `Getting output for task: ${this.params.task_id}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const { task_id, block = true, timeout = 30000 } = this.params;

    if (!task_id) {
      return {
        llmContent: 'Error: No task ID provided.',
        returnDisplay: 'Error: Missing task ID',
      };
    }

    const numericId = parseInt(task_id, 10);
    if (isNaN(numericId)) {
      return {
        llmContent: `Error: Invalid task ID format. Expected a numeric process ID, got: ${task_id}`,
        returnDisplay: `Error: Invalid task ID`,
      };
    }

    const isActive = ExecutionLifecycleService.isActive(numericId);
    const completedResult = ExecutionLifecycleService.getCompletedResult(numericId);
    const isKnown = ExecutionLifecycleService.isKnown(numericId);

    if (!isActive && completedResult) {
      return {
        llmContent: completedResult.output || `Task ${task_id} completed.`,
        returnDisplay: completedResult.output || `Task ${task_id} completed`,
      };
    }

    if (!isActive && !isKnown) {
      return {
        llmContent: `Task ${task_id} does not exist.`,
        returnDisplay: `Task ${task_id} not found`,
      };
    }

    if (block) {
      return this.waitForCompletion(numericId, timeout, signal);
    }

    return this.getCurrentOutput(numericId, completedResult);
  }

  private async waitForCompletion(
    executionId: number,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      let settled = false;
      let output = '';

      const cleanup = () => {
        settled = true;
        timeoutId?.unref();
        unsubscribe?.();
        signal.removeEventListener('abort', abortHandler);
      };

      const abortHandler = () => {
        if (settled) return;
        cleanup();
        resolve({
          llmContent: `Task ${executionId} output retrieval was cancelled.`,
          returnDisplay: 'Cancelled',
        });
      };

      // Subscribe to output events
      const unsubscribe = ExecutionLifecycleService.subscribe(
        executionId,
        (event) => {
          if (settled) return;

          if (event.type === 'data') {
            output += typeof event.chunk === 'string' ? event.chunk : '';
          } else if (event.type === 'exit') {
            cleanup();
            resolve({
              llmContent:
                output ||
                `Task ${executionId} completed with exit code ${event.exitCode ?? 0}.`,
              returnDisplay: output || `Task ${executionId} completed`,
            });
          }
        },
      );

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (settled) return;
        cleanup();
        resolve({
          llmContent:
            output ||
            `Task ${executionId} is still running. Timeout reached after ${timeoutMs}ms.`,
          returnDisplay: output || `Task still running (timeout)`,
        });
      }, timeoutMs);

      signal.addEventListener('abort', abortHandler, { once: true });
    });
  }

  private getCurrentOutput(
    executionId: number,
    completedResult?: { output: string },
  ): Promise<ToolResult> {
    if (completedResult) {
      return Promise.resolve({
        llmContent: completedResult.output || `Task ${executionId} completed.`,
        returnDisplay: completedResult.output || `Task ${executionId} completed`,
      });
    }

    return new Promise((resolve) => {
      let output = '';

      const unsubscribe = ExecutionLifecycleService.subscribe(
        executionId,
        (event) => {
          if (event.type === 'data') {
            output += typeof event.chunk === 'string' ? event.chunk : '';
          }
        },
      );

      // Immediately unsubscribe after getting snapshot
      unsubscribe();

      resolve({
        llmContent:
          output ||
          `Task ${executionId} is still running. No output available yet.`,
        returnDisplay: output || `Task ${executionId} running`,
      });
    });
  }
}
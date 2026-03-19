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

export interface TaskOutputParams {
  task_id: string;
  block?: boolean;
  timeout?: number;
}

/**
 * Tool for retrieving output from background tasks.
 * Note: This is a placeholder implementation. Full implementation requires
 * integration with the task management system.
 */
export class TaskOutputTool extends BaseDeclarativeTool<
  TaskOutputParams,
  ToolResult
> {
  static readonly Name = TASK_OUTPUT_TOOL_NAME;

  constructor(
    _config: Config,
    messageBus: MessageBus,
  ) {
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

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    // TODO: Integrate with actual task management system
    // For now, return a placeholder message
    return {
      llmContent: `Task output retrieval is not yet implemented. Task ID: ${this.params.task_id}`,
      returnDisplay: `Task ${this.params.task_id} output not available`,
    };
  }
}
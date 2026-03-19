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
import { NOTEBOOK_EDIT_TOOL_NAME } from './tool-names.js';
import { NOTEBOOK_EDIT_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

export interface NotebookEditParams {
  notebook_path: string;
  cell_id?: string;
  new_source: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: 'replace' | 'insert' | 'delete';
}

/**
 * Tool for editing Jupyter notebooks.
 * Note: This is a placeholder implementation. Full implementation requires
 * integration with Jupyter notebook file handling.
 */
export class NotebookEditTool extends BaseDeclarativeTool<
  NotebookEditParams,
  ToolResult
> {
  static readonly Name = NOTEBOOK_EDIT_TOOL_NAME;

  constructor(
    _config: Config,
    messageBus: MessageBus,
  ) {
    super(
      NotebookEditTool.Name,
      'Notebook Edit',
      NOTEBOOK_EDIT_DEFINITION.base.description!,
      Kind.Edit,
      NOTEBOOK_EDIT_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected override validateToolParamValues(
    params: NotebookEditParams,
  ): string | null {
    if (!params.notebook_path) {
      return "The 'notebook_path' parameter is required.";
    }
    if (!params.new_source && params.edit_mode !== 'delete') {
      return "The 'new_source' parameter is required.";
    }
    return null;
  }

  protected createInvocation(
    params: NotebookEditParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): NotebookEditInvocation {
    return new NotebookEditInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(NOTEBOOK_EDIT_DEFINITION, modelId);
  }
}

export class NotebookEditInvocation extends BaseToolInvocation<
  NotebookEditParams,
  ToolResult
> {
  constructor(
    params: NotebookEditParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    const mode = this.params.edit_mode || 'replace';
    return `Notebook edit (${mode}): ${this.params.notebook_path}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { notebook_path, cell_id, new_source, cell_type, edit_mode } = this.params;
    const mode = edit_mode || 'replace';

    // TODO: Integrate with actual Jupyter notebook file handling
    // For now, return a placeholder message
    return {
      llmContent: `Jupyter notebook editing is not yet implemented.
Notebook: ${notebook_path}
Cell ID: ${cell_id || 'N/A'}
Mode: ${mode}
Cell Type: ${cell_type || 'N/A'}
Source length: ${new_source?.length || 0} characters`,
      returnDisplay: `Notebook edit pending: ${notebook_path}`,
    };
  }
}
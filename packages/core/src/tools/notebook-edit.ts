/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  type ToolResult,
  Kind,
  type ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { NOTEBOOK_EDIT_TOOL_NAME } from './tool-names.js';
import { NOTEBOOK_EDIT_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { ToolErrorType } from './tool-error.js';
import { checkExhaustive } from '../utils/checks.js';

export interface NotebookEditParams {
  notebook_path: string;
  cell_id?: string;
  new_source: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: 'replace' | 'insert' | 'delete';
}

/**
 * Represents a Jupyter notebook cell
 */
interface NotebookCell {
  id?: string;
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
}

/**
 * Represents a Jupyter notebook structure
 */
interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
}

/**
 * Generates a random cell ID
 */
function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Tool for editing Jupyter notebooks (.ipynb files).
 * Supports replacing, inserting, and deleting cells.
 */
export class NotebookEditTool extends BaseDeclarativeTool<
  NotebookEditParams,
  ToolResult
> {
  static readonly Name = NOTEBOOK_EDIT_TOOL_NAME;

  constructor(_config: Config, messageBus: MessageBus) {
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
    // new_source is required per schema, but we allow delete mode to skip it
    if (!params.new_source && params.edit_mode !== 'delete') {
      return "The 'new_source' parameter is required for replace and insert modes.";
    }
    // For replace mode, cell_id is required
    if (params.edit_mode === 'replace' && params.cell_id === undefined) {
      return "The 'cell_id' parameter is required for replace mode.";
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
  private confirmationOutcome: ToolConfirmationOutcome | null = null;
  private notebookContent: Notebook | null = null;

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

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // This tool requires user confirmation
    return {
      type: 'info',
      title: 'Edit Notebook',
      prompt: `Edit notebook ${this.params.notebook_path}? Mode: ${this.params.edit_mode || 'replace'}`,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        this.confirmationOutcome = outcome;
      },
    };
  }

  private async loadNotebook(filePath: string): Promise<Notebook> {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    const notebook = JSON.parse(content) as Notebook;

    // Validate basic structure
    if (
      typeof notebook.nbformat !== 'number' ||
      !Array.isArray(notebook.cells)
    ) {
      throw new Error('Invalid notebook format');
    }

    return notebook;
  }

  private normalizeSource(source: string): string[] {
    // Convert single string to array of lines
    if (!source.includes('\n')) {
      return [source];
    }
    const lines = source.split('\n');
    // Ensure each line ends with newline except the last one (Jupyter convention)
    return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line));
  }

  private findCellIndex(
    notebook: Notebook,
    cellId: string,
  ): number {
    // If cellId is a numeric string, treat it as a 0-indexed cell number
    const cellNumber = parseInt(cellId, 10);
    if (!isNaN(cellNumber)) {
      if (cellNumber < 0 || cellNumber >= notebook.cells.length) {
        return -1;
      }
      return cellNumber;
    }

    // Otherwise, find by string ID (exact match or partial match)
    return notebook.cells.findIndex(
      (cell) => cell.id === cellId || cell.id?.includes(cellId),
    );
  }

  private applyEdit(notebook: Notebook): Notebook {
    const { cell_id, new_source, cell_type, edit_mode } = this.params;
    const mode = edit_mode || 'replace';

    switch (mode) {
      case 'replace': {
        const index = this.findCellIndex(notebook, cell_id!);
        if (index === -1) {
          // Provide a helpful error message based on whether it was numeric or string
          const cellNumber = parseInt(cell_id!, 10);
          if (!isNaN(cellNumber)) {
            throw new Error(
              `Cell at index ${cellNumber} not found. Notebook has ${notebook.cells.length} cells (0-${notebook.cells.length - 1}).`,
            );
          }
          throw new Error(`Cell with ID "${cell_id}" not found`);
        }
        notebook.cells[index] = {
          ...notebook.cells[index],
          cell_type: (cell_type as 'code' | 'markdown') || notebook.cells[index].cell_type,
          source: this.normalizeSource(new_source),
        };
        break;
      }

      case 'insert': {
        const newCell: NotebookCell = {
          id: generateCellId(),
          cell_type: (cell_type as 'code' | 'markdown') || 'code',
          source: this.normalizeSource(new_source),
          metadata: {},
          execution_count: null,
          outputs: [],
        };

        if (cell_id) {
          // Insert after the specified cell
          const index = this.findCellIndex(notebook, cell_id);
          if (index === -1) {
            // Provide a helpful error message
            const cellNumber = parseInt(cell_id, 10);
            if (!isNaN(cellNumber)) {
              throw new Error(
                `Cell at index ${cellNumber} not found. Notebook has ${notebook.cells.length} cells (0-${notebook.cells.length - 1}).`,
              );
            }
            throw new Error(`Cell with ID "${cell_id}" not found`);
          }
          notebook.cells.splice(index + 1, 0, newCell);
        } else {
          // Append at the end
          notebook.cells.push(newCell);
        }
        break;
      }

      case 'delete': {
        if (!cell_id) {
          throw new Error('cell_id is required for delete mode');
        }
        const index = this.findCellIndex(notebook, cell_id);
        if (index === -1) {
          // Provide a helpful error message
          const cellNumber = parseInt(cell_id, 10);
          if (!isNaN(cellNumber)) {
            throw new Error(
              `Cell at index ${cellNumber} not found. Notebook has ${notebook.cells.length} cells (0-${notebook.cells.length - 1}).`,
            );
          }
          throw new Error(`Cell with ID "${cell_id}" not found`);
        }
        notebook.cells.splice(index, 1);
        break;
      }

      default:
        checkExhaustive(mode, `Unknown edit mode: ${mode}`);
    }

    return notebook;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (this.confirmationOutcome === ToolConfirmationOutcome.Cancel) {
      return {
        llmContent: 'Notebook edit cancelled by user.',
        returnDisplay: 'Cancelled',
      };
    }

    const { notebook_path, edit_mode } = this.params;
    const mode = edit_mode || 'replace';

    try {
      // Load the notebook
      this.notebookContent = await this.loadNotebook(notebook_path);

      // Apply the edit
      const editedNotebook = this.applyEdit(this.notebookContent);

      // Write back to file
      await fsPromises.writeFile(
        notebook_path,
        JSON.stringify(editedNotebook, null, 2),
        'utf-8',
      );

      const actionDescription =
        mode === 'replace'
          ? `Updated cell in notebook`
          : mode === 'insert'
            ? `Inserted new cell in notebook`
            : `Deleted cell from notebook`;

      return {
        llmContent: `${actionDescription}: ${notebook_path}`,
        returnDisplay: `${actionDescription}: ${path.basename(notebook_path)}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ENOENT')) {
        return {
          llmContent: `Notebook not found: ${notebook_path}`,
          returnDisplay: 'Notebook not found',
          error: {
            message: errorMessage,
            type: ToolErrorType.FILE_NOT_FOUND,
          },
        };
      }

      return {
        llmContent: `Failed to edit notebook ${notebook_path}: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.FILE_WRITE_FAILURE,
        },
      };
    }
  }
}
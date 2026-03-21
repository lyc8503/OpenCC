/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotebookEditTool, type NotebookEditParams } from './notebook-edit.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import fsPromises from 'node:fs/promises';
import { ToolConfirmationOutcome } from './tools.js';

vi.mock('../config/config.js');
vi.mock('node:fs/promises');

describe('NotebookEditTool', () => {
  let mockConfig: Config;
  let tool: NotebookEditTool;

  const mockNotebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        id: 'cell-1',
        cell_type: 'code',
        source: ['print("hello")'],
        metadata: {},
        execution_count: 1,
        outputs: [],
      },
      {
        id: 'cell-2',
        cell_type: 'markdown',
        source: ['# Title'],
        metadata: {},
      },
    ],
  };

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new NotebookEditTool(mockConfig, createMockMessageBus());
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        new_source: 'print("hello")',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept optional params', () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'cell-1',
        new_source: 'print("hello")',
        cell_type: 'code',
        edit_mode: 'replace',
      };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });

    it('should throw if notebook_path is missing', () => {
      const params = { new_source: 'print("hello")' } as NotebookEditParams;
      expect(() => tool.build(params)).toThrow();
    });

    it('should throw if new_source is missing for non-delete mode', () => {
      const params = {
        notebook_path: '/path/to/notebook.ipynb',
      } as NotebookEditParams;
      expect(() => tool.build(params)).toThrow();
    });

    it('should not require new_source for delete mode', () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'cell-1',
        new_source: '', // Required by schema but ignored for delete mode
        edit_mode: 'delete',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });
  });

  describe('getDescription', () => {
    it('should return description with notebook path', () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        new_source: 'print("hello")',
      };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toContain('notebook.ipynb');
    });

    it('should include edit mode in description', () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        new_source: 'print("hello")',
        edit_mode: 'insert',
      };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toContain('insert');
    });
  });

  describe('execute', () => {
    it('should return cancelled if user cancels', async () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        new_source: 'print("hello")',
      };
      const invocation = tool.build(params);

      // Simulate user cancellation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.Cancel);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('cancelled');
    });

    it('should replace cell in notebook', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValueOnce(
        JSON.stringify(mockNotebook),
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce();

      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'cell-1',
        new_source: 'print("world")',
        edit_mode: 'replace',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Updated cell');
    });

    it('should replace cell using numeric index', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValueOnce(
        JSON.stringify(mockNotebook),
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce();

      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: '0', // Numeric index for first cell
        new_source: 'print("updated by index")',
        edit_mode: 'replace',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Updated cell');
    });

    it('should insert new cell in notebook', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValueOnce(
        JSON.stringify(mockNotebook),
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce();

      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'cell-1',
        new_source: '# New cell',
        cell_type: 'markdown',
        edit_mode: 'insert',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Inserted new cell');
    });

    it('should delete cell from notebook', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValueOnce(
        JSON.stringify(mockNotebook),
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce();

      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'cell-2',
        new_source: '', // Required by schema but ignored for delete mode
        edit_mode: 'delete',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Deleted cell');
    });

    it('should return error for missing cell', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValueOnce(
        JSON.stringify(mockNotebook),
      );

      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        cell_id: 'nonexistent',
        new_source: 'print("test")',
        edit_mode: 'replace',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('not found');
    });

    it('should return error for missing file', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fsPromises.readFile).mockRejectedValueOnce(error);

      const params: NotebookEditParams = {
        notebook_path: '/path/to/nonexistent.ipynb',
        cell_id: 'cell-1',
        new_source: 'print("test")',
        edit_mode: 'replace',
      };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('not found');
    });
  });
});
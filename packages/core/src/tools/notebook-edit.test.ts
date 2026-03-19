/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotebookEditTool, type NotebookEditParams } from './notebook-edit.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

vi.mock('../config/config.js');

describe('NotebookEditTool', () => {
  let mockConfig: Config;
  let tool: NotebookEditTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new NotebookEditTool(mockConfig, createMockMessageBus());
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
    it('should return a result with notebook info', async () => {
      const params: NotebookEditParams = {
        notebook_path: '/path/to/notebook.ipynb',
        new_source: 'print("hello")',
      };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('notebook.ipynb');
      expect(result.returnDisplay).toContain('notebook.ipynb');
    });
  });
});
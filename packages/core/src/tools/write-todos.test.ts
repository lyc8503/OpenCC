/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { WriteTodosTool, type WriteTodosToolParams } from './write-todos.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

describe('WriteTodosTool', () => {
  const tool = new WriteTodosTool(createMockMessageBus());
  const signal = new AbortController().signal;

  describe('validation', () => {
    it('should not throw for valid parameters', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          { content: 'Task 1', status: 'pending', activeForm: 'Doing task 1' },
          {
            content: 'Task 2',
            status: 'in_progress',
            activeForm: 'Doing task 2',
          },
          {
            content: 'Task 3',
            status: 'completed',
            activeForm: 'Doing task 3',
          },
        ],
      };
      await expect(tool.buildAndExecute(params, signal)).resolves.toBeDefined();
    });

    it('should not throw for an empty list', async () => {
      const params: WriteTodosToolParams = {
        todos: [],
      };
      await expect(tool.buildAndExecute(params, signal)).resolves.toBeDefined();
    });

    it('should throw an error if todos is not an array', async () => {
      const params = {
        todos: 'not-an-array',
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos must be array',
      );
    });

    it('should throw an error if a todo item is not an object', async () => {
      const params = {
        todos: ['not-an-object'],
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos/0 must be object',
      );
    });

    it('should throw an error if a todo content is missing or empty', async () => {
      const params: WriteTodosToolParams = {
        todos: [{ content: '  ', status: 'pending', activeForm: 'Doing task' }],
      };
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'Each todo must have a non-empty content string',
      );
    });

    it('should throw an error if a todo status is invalid', async () => {
      const params = {
        todos: [
          {
            content: 'Task 1',
            status: 'invalid-status',
            activeForm: 'Doing task 1',
          },
        ],
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos/0/status must be equal to one of the allowed values',
      );
    });

    it('should throw an error if more than one task is in_progress', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          {
            content: 'Task 1',
            status: 'in_progress',
            activeForm: 'Doing task 1',
          },
          {
            content: 'Task 2',
            status: 'in_progress',
            activeForm: 'Doing task 2',
          },
        ],
      };
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'Invalid parameters: Only one task can be "in_progress" at a time.',
      );
    });
  });

  describe('execute', () => {
    it('should return a success message for clearing the list', async () => {
      const params: WriteTodosToolParams = {
        todos: [],
      };
      const result = await tool.buildAndExecute(params, signal);
      expect(result.llmContent).toBe('Successfully cleared the todo list.');
      expect(result.returnDisplay).toEqual({ todos: [] });
    });

    it('should return a formatted todo list on success', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          {
            content: 'First task',
            status: 'completed',
            activeForm: 'Doing first task',
          },
          {
            content: 'Second task',
            status: 'in_progress',
            activeForm: 'Doing second task',
          },
          {
            content: 'Third task',
            status: 'pending',
            activeForm: 'Doing third task',
          },
        ],
      };
      const result = await tool.buildAndExecute(params, signal);
      const expectedOutput = `Successfully updated the todo list. The current list is now:
1. [completed] First task
2. [in_progress] Second task
3. [pending] Third task`;
      expect(result.llmContent).toBe(expectedOutput);
      expect(result.returnDisplay).toEqual(params);
    });
  });
});

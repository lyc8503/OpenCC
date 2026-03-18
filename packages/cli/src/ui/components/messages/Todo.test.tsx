/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect } from 'vitest';
import { Box } from 'ink';
import { TodoTray } from './Todo.js';
import { CoreToolCallStatus, type Todo } from '@google/gemini-cli-core';
import { UIStateContext, type UIState } from '../../contexts/UIStateContext.js';
import { type HistoryItem } from '../../types.js';

const createTodoHistoryItem = (todos: Todo[]): HistoryItem =>
  ({
    type: 'tool_group',
    id: '1',
    tools: [
      {
        name: 'write_todos',
        callId: 'tool-1',
        status: CoreToolCallStatus.Success,
        resultDisplay: {
          todos,
        },
      },
    ],
  }) as unknown as HistoryItem;

describe.each([true, false])(
  '<TodoTray /> (showFullTodos: %s)',
  async (showFullTodos: boolean) => {
    const renderWithUiState = async (uiState: Partial<UIState>) => {
      const result = render(
        <UIStateContext.Provider value={uiState as UIState}>
          <TodoTray />
        </UIStateContext.Provider>,
      );
      await result.waitUntilReady();
      return result;
    };

    it('renders null when no todos are in the history', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [],
        showFullTodos,
      });
      expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
      unmount();
    });

    it('renders null when todo list is empty', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [createTodoHistoryItem([])],
        showFullTodos,
      });
      expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
      unmount();
    });

    it('renders when todos exist but none are in progress', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [
          createTodoHistoryItem([
            {
              content: 'Pending Task',
              status: 'pending',
              activeForm: 'Pending Task',
            },
            {
              content: 'In Progress Task',
              status: 'cancelled',
              activeForm: 'In Progress Task',
            },
            {
              content: 'Completed Task',
              status: 'completed',
              activeForm: 'Completed Task',
            },
          ]),
        ],
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders when todos exist and one is in progress', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [
          createTodoHistoryItem([
            {
              content: 'Pending Task',
              status: 'pending',
              activeForm: 'Pending Task',
            },
            { content: 'Task 2', status: 'in_progress', activeForm: 'Task 2' },
            {
              content: 'In Progress Task',
              status: 'cancelled',
              activeForm: 'In Progress Task',
            },
            {
              content: 'Completed Task',
              status: 'completed',
              activeForm: 'Completed Task',
            },
          ]),
        ],
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders a todo list with long descriptions that wrap when full view is on', async () => {
      const { lastFrame, waitUntilReady, unmount } = render(
        <Box width="50">
          <UIStateContext.Provider
            value={
              {
                history: [
                  createTodoHistoryItem([
                    {
                      content:
                        'This is a very long description for a pending task that should wrap around multiple lines when the terminal width is constrained.',
                      status: 'in_progress',
                      activeForm: 'Processing long task',
                    },
                    {
                      content:
                        'Another completed task with an equally verbose description to test wrapping behavior.',
                      status: 'completed',
                      activeForm: 'Processing completed task',
                    },
                  ]),
                ],
                showFullTodos,
              } as UIState
            }
          >
            <TodoTray />
          </UIStateContext.Provider>
        </Box>,
      );
      await waitUntilReady();
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders the most recent todo list when multiple write_todos calls are in history', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [
          createTodoHistoryItem([
            {
              content: 'Older Task 1',
              status: 'completed',
              activeForm: 'Older Task 1',
            },
            {
              content: 'Older Task 2',
              status: 'pending',
              activeForm: 'Older Task 2',
            },
          ]),
          createTodoHistoryItem([
            {
              content: 'Newer Task 1',
              status: 'pending',
              activeForm: 'Newer Task 1',
            },
            {
              content: 'Newer Task 2',
              status: 'in_progress',
              activeForm: 'Newer Task 2',
            },
          ]),
        ],
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders full list when all todos are inactive', async () => {
      const { lastFrame, unmount } = await renderWithUiState({
        history: [
          createTodoHistoryItem([
            { content: 'Task 1', status: 'completed', activeForm: 'Task 1' },
            { content: 'Task 2', status: 'cancelled', activeForm: 'Task 2' },
          ]),
        ],
        showFullTodos,
      });
      expect(lastFrame({ allowEmpty: true })).toMatchSnapshot();
      unmount();
    });
  },
);

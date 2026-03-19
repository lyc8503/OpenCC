/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskStopTool, type TaskStopParams } from './task-stop.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

vi.mock('../config/config.js');

describe('TaskStopTool', () => {
  let mockConfig: Config;
  let tool: TaskStopTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new TaskStopTool(mockConfig, createMockMessageBus());
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: TaskStopParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept deprecated shell_id param', () => {
      const params: TaskStopParams = { shell_id: 'old-shell-id' };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description with task_id', () => {
      const params: TaskStopParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Stopping task: test-task-123');
    });

    it('should return description with shell_id if task_id not provided', () => {
      const params: TaskStopParams = { shell_id: 'old-shell-id' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Stopping task: old-shell-id');
    });
  });

  describe('execute', () => {
    it('should return a result with task_id', async () => {
      const params: TaskStopParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('test-task-123');
      expect(result.returnDisplay).toContain('test-task-123');
    });

    it('should return error when no task_id provided', async () => {
      const params: TaskStopParams = {};
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Error');
    });
  });
});
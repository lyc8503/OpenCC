/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskStopTool, type TaskStopParams } from './task-stop.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';

vi.mock('../config/config.js');
vi.mock('../services/executionLifecycleService.js');
vi.mock('../services/shellExecutionService.js');

describe('TaskStopTool', () => {
  let mockConfig: Config;
  let tool: TaskStopTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new TaskStopTool(mockConfig, createMockMessageBus());
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: TaskStopParams = { task_id: '12345' };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept deprecated shell_id param', () => {
      const params: TaskStopParams = { shell_id: '67890' };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description with task_id', () => {
      const params: TaskStopParams = { task_id: '12345' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Stopping task: 12345');
    });

    it('should return description with shell_id if task_id not provided', () => {
      const params: TaskStopParams = { shell_id: '67890' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Stopping task: 67890');
    });
  });

  describe('execute', () => {
    it('should return error when no task_id provided', async () => {
      const params: TaskStopParams = {};
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Error');
      expect(result.llmContent).toContain('No task ID');
    });

    it('should return error for non-numeric task_id', async () => {
      const params: TaskStopParams = { task_id: 'invalid-id' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Invalid task ID');
    });

    it('should return not found for inactive task', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(false);

      const params: TaskStopParams = { task_id: '12345' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('not running');
    });

    it('should kill active task', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(true);
      vi.mocked(ExecutionLifecycleService.kill).mockReturnValue(undefined);

      const params: TaskStopParams = { task_id: '12345' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(ExecutionLifecycleService.kill).toHaveBeenCalledWith(12345);
      expect(result.llmContent).toContain('Successfully stopped');
    });
  });
});
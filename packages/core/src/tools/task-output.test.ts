/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskOutputTool, type TaskOutputParams } from './task-output.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';

vi.mock('../config/config.js');
vi.mock('../services/executionLifecycleService.js');

describe('TaskOutputTool', () => {
  let mockConfig: Config;
  let tool: TaskOutputTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new TaskOutputTool(mockConfig, createMockMessageBus());
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: TaskOutputParams = { task_id: '12345' };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept optional block and timeout params', () => {
      const params: TaskOutputParams = {
        task_id: '12345',
        block: false,
        timeout: 60000,
      };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description with task_id', () => {
      const params: TaskOutputParams = { task_id: '12345' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe(
        'Getting output for task: 12345',
      );
    });
  });

  describe('execute', () => {
    it('should throw error when building without task_id', () => {
      const params = {} as TaskOutputParams;
      expect(() => tool.build(params)).toThrow();
    });

    it('should return error for non-numeric task_id', async () => {
      const params: TaskOutputParams = { task_id: 'invalid-id' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Invalid task ID');
    });

    it('should return not found for unknown inactive task', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(false);
      vi.mocked(ExecutionLifecycleService.isKnown).mockReturnValue(false);
      vi.mocked(ExecutionLifecycleService.getCompletedResult).mockReturnValue(
        undefined,
      );

      const params: TaskOutputParams = { task_id: '12345' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('does not exist');
    });

    it('should return completed output for completed task', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(false);
      vi.mocked(ExecutionLifecycleService.isKnown).mockReturnValue(true);
      vi.mocked(ExecutionLifecycleService.getCompletedResult).mockReturnValue({
        rawOutput: Buffer.from('completed output'),
        output: 'completed output',
        exitCode: 0,
        signal: null,
        error: null,
        aborted: false,
        pid: 12345,
        executionMethod: 'child_process',
      });

      const params: TaskOutputParams = { task_id: '12345' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('completed output');
      expect(result.returnDisplay).toContain('completed output');
    });

    it('should get current output for active task (non-blocking)', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(true);
      vi.mocked(ExecutionLifecycleService.subscribe).mockImplementation(
        (_id, callback) => {
          callback({ type: 'data', chunk: 'test output' });
          return () => {};
        },
      );

      const params: TaskOutputParams = { task_id: '12345', block: false };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('test output');
    });

    it('should wait for task completion (blocking)', async () => {
      vi.mocked(ExecutionLifecycleService.isActive).mockReturnValue(true);
      vi.mocked(ExecutionLifecycleService.subscribe).mockImplementation(
        (_id, callback) => {
          // Simulate task completion after short delay
          setTimeout(() => {
            callback({ type: 'data', chunk: 'output line 1\n' });
            callback({ type: 'data', chunk: 'output line 2\n' });
            callback({ type: 'exit', exitCode: 0, signal: null });
          }, 10);
          return () => {};
        },
      );

      const params: TaskOutputParams = {
        task_id: '12345',
        block: true,
        timeout: 1000,
      };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('output line 1');
    });
  });
});
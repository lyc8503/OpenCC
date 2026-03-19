/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskOutputTool, type TaskOutputParams } from './task-output.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

vi.mock('../config/config.js');

describe('TaskOutputTool', () => {
  let mockConfig: Config;
  let tool: TaskOutputTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new TaskOutputTool(mockConfig, createMockMessageBus());
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: TaskOutputParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept optional block and timeout params', () => {
      const params: TaskOutputParams = {
        task_id: 'test-task-123',
        block: false,
        timeout: 60000,
      };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description with task_id', () => {
      const params: TaskOutputParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe(
        'Getting output for task: test-task-123',
      );
    });
  });

  describe('execute', () => {
    it('should return a result with task_id', async () => {
      const params: TaskOutputParams = { task_id: 'test-task-123' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('test-task-123');
      expect(result.returnDisplay).toContain('test-task-123');
    });
  });
});
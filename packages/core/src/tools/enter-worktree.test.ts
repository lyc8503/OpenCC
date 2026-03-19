/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnterWorktreeTool, type EnterWorktreeParams } from './enter-worktree.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

vi.mock('../config/config.js');

describe('EnterWorktreeTool', () => {
  let mockConfig: Config;
  let tool: EnterWorktreeTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new EnterWorktreeTool(mockConfig, createMockMessageBus());
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should work without name param', () => {
      const params: EnterWorktreeParams = {};
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });
  });

  describe('getDescription', () => {
    it('should return description with worktree name', () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Creating worktree: my-feature');
    });

    it('should return description with random name when not provided', () => {
      const params: EnterWorktreeParams = {};
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Creating worktree: random name');
    });
  });

  describe('execute', () => {
    it('should return a result with worktree name', async () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('my-feature');
    });
  });
});
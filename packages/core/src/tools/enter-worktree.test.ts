/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EnterWorktreeTool,
  type EnterWorktreeParams,
} from './enter-worktree.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import fs from 'node:fs';
import { ToolConfirmationOutcome } from './tools.js';

// Mock fs before importing
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../config/config.js');

// Use vi.hoisted to create the mock before module evaluation
const mockExecAsync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecAsync,
}));

describe('EnterWorktreeTool', () => {
  let mockConfig: Config;
  let tool: EnterWorktreeTool;

  beforeEach(() => {
    mockConfig = {
      getTargetDir: () => '/test/repo',
    } as unknown as Config;
    tool = new EnterWorktreeTool(mockConfig, createMockMessageBus());
    vi.resetAllMocks();
    mockExecAsync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(invocation.getDescription()).toBe(
        'Creating worktree: random name',
      );
    });
  });

  describe('execute', () => {
    it('should return cancelled if user cancels', async () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
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

    it('should return error for non-git directory', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Not a git repository');
    });

    it('should create worktree successfully', async () => {
      // Mock git repository check
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' }) // rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'true' }) // is-inside-work-tree
        .mockResolvedValueOnce({ stdout: 'main' }) // abbrev-ref HEAD
        .mockResolvedValueOnce({ stdout: '' }); // worktree add

      // Mock fs operations
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => false,
      } as fs.Stats);

      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Successfully created worktree');
    });

    it('should return error if already in worktree', async () => {
      // Mock git repository check
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' }) // rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'true' }); // is-inside-work-tree

      // Mock .git is a file (indicates worktree)
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('Already in a worktree');
    });
  });
});
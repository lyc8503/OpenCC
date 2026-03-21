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
  let setTargetDirMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setTargetDirMock = vi.fn();
    mockConfig = {
      getTargetDir: () => '/test/repo',
      setTargetDir: setTargetDirMock,
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

  describe('shouldConfirmExecute', () => {
    it('should return confirmation dialog', async () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);

      const result = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('type', 'info');
      expect(result).toHaveProperty('title', 'Enter Worktree');
      expect(result).toHaveProperty('prompt');
      expect((result as { prompt: string }).prompt).toContain('my-feature');
    });

    it('should include name in prompt when provided', async () => {
      const params: EnterWorktreeParams = { name: 'test-worktree' };
      const invocation = tool.build(params);

      const result = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );

      expect((result as { prompt: string }).prompt).toContain('test-worktree');
    });

    it('should not require confirmation when cancelled', async () => {
      const params: EnterWorktreeParams = { name: 'my-feature' };
      const invocation = tool.build(params);

      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.Cancel);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('cancelled');
    });
  });

  describe('execute', () => {
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
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('path_not_in_workspace');
    });

    it('should create worktree successfully and switch directory', async () => {
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
      expect(result.llmContent).toContain('my-feature');
      expect(result.llmContent).toContain('/test/repo/.claude/worktrees/my-feature');
      expect(result.returnDisplay).toContain('my-feature');
      expect(result.data).toBeDefined();
      expect((result.data as { worktreePath: string }).worktreePath).toContain('my-feature');

      // Verify directory was switched
      expect(setTargetDirMock).toHaveBeenCalledWith(
        expect.stringContaining('my-feature'),
      );
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
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('execution_failed');
    });

    it('should generate random name when name not provided', async () => {
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

      const params: EnterWorktreeParams = {};
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
      // Random name should contain 'worktree-'
      expect(result.llmContent).toMatch(/worktree-\d+/);
    });

    it('should handle worktree already exists error', async () => {
      // Mock git repository check
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' }) // rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'true' }) // is-inside-work-tree
        .mockResolvedValueOnce({ stdout: 'main' }) // abbrev-ref HEAD
        .mockRejectedValueOnce(new Error('worktree "existing-name" already exists'));

      // Mock fs operations - worktree already exists
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => false,
      } as fs.Stats);

      const params: EnterWorktreeParams = { name: 'existing-name' };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.error).toBeDefined();
      expect(result.llmContent).toContain('already exists');
    });

    it('should include branch info in result', async () => {
      // Mock git repository check
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git' }) // rev-parse --git-dir
        .mockResolvedValueOnce({ stdout: 'true' }) // is-inside-work-tree
        .mockResolvedValueOnce({ stdout: 'feature/my-branch' }) // abbrev-ref HEAD
        .mockResolvedValueOnce({ stdout: '' }); // worktree add

      // Mock fs operations
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => false,
      } as fs.Stats);

      const params: EnterWorktreeParams = { name: 'my-worktree' };
      const invocation = tool.build(params);

      // Simulate user confirmation
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Branch: worktree/my-worktree');
      expect(result.data).toBeDefined();
      expect((result.data as { branchName: string }).branchName).toBe('worktree/my-worktree');
    });
  });
});

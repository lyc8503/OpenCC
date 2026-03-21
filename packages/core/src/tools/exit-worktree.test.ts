/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ExitWorktreeTool,
  type ExitWorktreeParams,
} from './exit-worktree.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

const mockExecAsync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecAsync,
}));

describe('ExitWorktreeTool', () => {
  let mockConfig: Config;
  let tool: ExitWorktreeTool;
  let setTargetDirMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setTargetDirMock = vi.fn();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('should return an invocation', () => {
      mockConfig = {
        getTargetDir: () => '/test/repo',
        setTargetDir: setTargetDirMock,
      } as unknown as Config;
      tool = new ExitWorktreeTool(mockConfig, createMockMessageBus());

      const params: ExitWorktreeParams = {};
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description', () => {
      mockConfig = {
        getTargetDir: () => '/test/repo',
        setTargetDir: setTargetDirMock,
      } as unknown as Config;
      tool = new ExitWorktreeTool(mockConfig, createMockMessageBus());

      const invocation = tool.build({});
      expect(invocation.getDescription()).toBe(
        'Exiting worktree and returning to original directory',
      );
    });
  });

  describe('execute', () => {
    it('should return error if not in a git repository', async () => {
      mockConfig = {
        getTargetDir: () => '/test/repo',
        setTargetDir: setTargetDirMock,
      } as unknown as Config;
      tool = new ExitWorktreeTool(mockConfig, createMockMessageBus());

      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const invocation = tool.build({});
      const result = await invocation.execute(new AbortController().signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('execution_failed');
      expect(result.llmContent).toContain('Not in a worktree');
    });

    it('should switch target dir when worktree list has multiple entries', async () => {
      mockConfig = {
        getTargetDir: () => '/test/repo/.claude/worktrees/my-feature',
        setTargetDir: setTargetDirMock,
      } as unknown as Config;
      tool = new ExitWorktreeTool(mockConfig, createMockMessageBus());

      // isInWorktree now uses path check, so only mock the getWorktreeList call
      mockExecAsync
        .mockResolvedValueOnce({ stdout: ['worktree /test/repo', 'worktree /test/repo/.claude/worktrees/my-feature'].join(String.fromCharCode(10)) })
        .mockResolvedValueOnce({ stdout: '' });

      const invocation = tool.build({});
      const result = await invocation.execute(new AbortController().signal);

      expect(setTargetDirMock).toHaveBeenCalledWith('/test/repo');
      expect(result.llmContent).toContain('Successfully returned');
    });

    it('should keep worktree if removal fails but still return', async () => {
      mockConfig = {
        getTargetDir: () => '/test/repo/.claude/worktrees/my-feature',
        setTargetDir: setTargetDirMock,
      } as unknown as Config;
      tool = new ExitWorktreeTool(mockConfig, createMockMessageBus());

      // isInWorktree now uses path check, so only mock the getWorktreeList call
      mockExecAsync
        .mockResolvedValueOnce({ stdout: ['worktree /test/repo', 'worktree /test/repo/.claude/worktrees/my-feature'].join(String.fromCharCode(10)) })
        .mockRejectedValueOnce(new Error('Cannot remove'));

      const invocation = tool.build({});
      const result = await invocation.execute(new AbortController().signal);

      expect(setTargetDirMock).toHaveBeenCalled();
      expect(result.llmContent).toContain('Successfully returned');
      expect(result.llmContent).toContain('kept');
    });
  });
});

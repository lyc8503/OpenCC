/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTool, type AgentParams } from './agent-tool.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import { ExecutionLifecycleService } from '../services/executionLifecycleService.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import { ToolConfirmationOutcome } from './tools.js';

vi.mock('../config/config.js');
vi.mock('../services/executionLifecycleService.js');
vi.mock('../agents/local-invocation.js');

describe('AgentTool', () => {
  let mockConfig: Config;
  let mockContext: AgentLoopContext;
  let tool: AgentTool;

  beforeEach(() => {
    mockConfig = {
      getActiveModel: () => 'claude-sonnet-4-6',
    } as unknown as Config;
    mockContext = {
      config: mockConfig,
    } as unknown as AgentLoopContext;
    tool = new AgentTool(mockContext, createMockMessageBus());
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should accept optional params', () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
        model: 'haiku',
        run_in_background: true,
        isolation: 'worktree',
      };
      const invocation = tool.build(params);
      expect(invocation.params).toEqual(params);
    });
  });

  describe('getDescription', () => {
    it('should return description from params', () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
      };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Search codebase');
    });

    it('should return default description when not provided', () => {
      const params: AgentParams = {
        description: '',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
      };
      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe('Agent task');
    });
  });

  describe('execute', () => {
    it('should return cancelled if user cancels (isolation mode)', async () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
        isolation: 'worktree',
      };
      const invocation = tool.build(params);

      // Simulate user cancellation for isolation mode
      const confirmResult = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.Cancel);
      }

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('cancelled');
    });

    it('should indicate resume not supported', async () => {
      const params: AgentParams = {
        description: 'Resume task',
        prompt: 'Continue the task',
        subagent_type: 'general-purpose',
        resume: 'previous-agent-id',
      };
      const invocation = tool.build(params);

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('not yet implemented');
    });

    it('should start agent in background', async () => {
      vi.mocked(ExecutionLifecycleService.createExecution).mockReturnValue({
        pid: 12345,
        result: Promise.resolve({
          rawOutput: Buffer.from(''),
          output: '',
          exitCode: 0,
          signal: null,
          error: null,
          aborted: false,
          executionMethod: 'none',
        }),
      });

      const params: AgentParams = {
        description: 'Background task',
        prompt: 'Run in background',
        subagent_type: 'general-purpose',
        run_in_background: true,
      };
      const invocation = tool.build(params);

      const result = await invocation.execute(new AbortController().signal);
      expect(result.llmContent).toContain('started in background');
      expect(result.data?.pid).toBe(12345);
    });
  });

  describe('agent types', () => {
    it('should support general-purpose agent', () => {
      const params: AgentParams = {
        description: 'General task',
        prompt: 'Do something',
        subagent_type: 'general-purpose',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support Explore agent', () => {
      const params: AgentParams = {
        description: 'Explore code',
        prompt: 'Find patterns',
        subagent_type: 'Explore',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support Plan agent', () => {
      const params: AgentParams = {
        description: 'Plan implementation',
        prompt: 'Design a solution',
        subagent_type: 'Plan',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support claude-code-guide agent', () => {
      const params: AgentParams = {
        description: 'Help with Claude Code',
        prompt: 'How do I use hooks?',
        subagent_type: 'claude-code-guide',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should fallback to general-purpose for unknown type', () => {
      const params: AgentParams = {
        description: 'Unknown task',
        prompt: 'Do something',
        subagent_type: 'unknown-type',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });
  });

  describe('model selection', () => {
    it('should use default model when not specified', () => {
      const params: AgentParams = {
        description: 'Task',
        prompt: 'Do something',
        subagent_type: 'general-purpose',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support haiku model', () => {
      const params: AgentParams = {
        description: 'Quick task',
        prompt: 'Fast response',
        subagent_type: 'Explore',
        model: 'haiku',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support opus model', () => {
      const params: AgentParams = {
        description: 'Complex task',
        prompt: 'Deep analysis',
        subagent_type: 'Plan',
        model: 'opus',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });

    it('should support sonnet model', () => {
      const params: AgentParams = {
        description: 'Balanced task',
        prompt: 'Standard analysis',
        subagent_type: 'general-purpose',
        model: 'sonnet',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
    });
  });
});
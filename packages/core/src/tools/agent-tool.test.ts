/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTool, type AgentParams } from './agent-tool.js';
import type { Config } from '../config/config.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';

vi.mock('../config/config.js');

describe('AgentTool', () => {
  let mockConfig: Config;
  let tool: AgentTool;

  beforeEach(() => {
    mockConfig = {} as unknown as Config;
    tool = new AgentTool(mockConfig, createMockMessageBus());
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
    it('should return a result with agent info', async () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
      };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('Search codebase');
      expect(result.llmContent).toContain('Explore');
      expect(result.returnDisplay).toContain('Search codebase');
    });

    it('should include model in result when provided', async () => {
      const params: AgentParams = {
        description: 'Search codebase',
        prompt: 'Find all API endpoints',
        subagent_type: 'Explore',
        model: 'haiku',
      };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('haiku');
    });
  });
});
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptProvider } from './promptProvider.js';
import type { Config } from '../config/config.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

vi.mock('../utils/gitUtils', () => ({
  isGitRepository: vi.fn().mockReturnValue(false),
}));

describe('PromptProvider', () => {
  let mockConfig: Config;
  let mockContext: AgentLoopContext;
  let mockToolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('GEMINI_SYSTEM_MD', '');
    vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', '');

    mockToolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue([]),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockConfig = {
      get config() {
        return this as unknown as Config;
      },
      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      isInteractive: vi.fn().mockReturnValue(true),
      getSkillManager: vi.fn().mockReturnValue({
        getSkills: vi.fn().mockReturnValue([]),
      }),
      getAgentRegistry: vi.fn().mockReturnValue({
        getAllDefinitions: vi.fn().mockReturnValue([]),
      }),
    } as unknown as Config;

    mockContext = {
      config: mockConfig,
      toolRegistry: mockToolRegistry,
      promptId: 'test-prompt-id',
      messageBus: {} as AgentLoopContext['messageBus'],
      geminiClient: {} as AgentLoopContext['geminiClient'],
      sandboxManager: {} as AgentLoopContext['sandboxManager'],
    } as AgentLoopContext;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should generate a system prompt with preamble', () => {
    const provider = new PromptProvider();
    const prompt = provider.getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('Claude agent');
    expect(prompt).toContain('software engineering tasks');
  });

  it('should include user memory in the prompt', () => {
    const provider = new PromptProvider();
    const prompt = provider.getCoreSystemPrompt(
      mockContext,
      'Some memory content',
    );

    expect(prompt).toContain('Contextual Instructions');
    expect(prompt).toContain('Some memory content');
  });

  it('should generate compression prompt', () => {
    const provider = new PromptProvider();
    const prompt = provider.getCompressionPrompt(mockContext);

    expect(prompt).toContain('continuation summary');
    expect(prompt).toContain('Task Overview');
    expect(prompt).toContain('Current State');
    expect(prompt).toContain('Next Steps');
    expect(prompt).toContain('<summary>');
  });
});
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCoreSystemPrompt } from './prompts.js';
import fs from 'node:fs';
import type { Config } from '../config/config.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

vi.mock('node:fs');
vi.mock('../utils/gitUtils', () => ({
  isGitRepository: vi.fn().mockReturnValue(false),
}));

describe('Core System Prompt Substitution', () => {
  let mockConfig: Config;
  let mockContext: AgentLoopContext;
  let mockToolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('GEMINI_SYSTEM_MD', 'true');

    mockToolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue(['Write', 'Read']),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockConfig = {
      get config() {
        return this;
      },
      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      isInteractive: vi.fn().mockReturnValue(true),
      getAgentRegistry: vi.fn().mockReturnValue({
        getAllDefinitions: vi.fn().mockReturnValue([]),
      }),
      getSkillManager: vi.fn().mockReturnValue({
        getSkills: vi.fn().mockReturnValue([]),
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

  it('should substitute ${SubAgents} in custom system prompt', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('Agents: ${SubAgents}');

    vi.mocked(mockConfig.getAgentRegistry().getAllDefinitions).mockReturnValue([
      {
        name: 'test-agent',
        description: 'Test Agent Description',
      },
    ]);

    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('Agents:');
    expect(prompt).toContain('# Available Sub-Agents');
    expect(prompt).toContain('test-agent');
    expect(prompt).not.toContain('${SubAgents}');
  });

  it('should substitute ${AvailableTools} in custom system prompt', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('Tools:\n${AvailableTools}');

    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('Tools:');
    expect(prompt).toContain('- Write');
    expect(prompt).toContain('- Read');
    expect(prompt).not.toContain('${AvailableTools}');
  });

  it('should substitute tool names using the ${toolName}_ToolName pattern', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'Use ${Write_ToolName} and ${Read_ToolName}.',
    );

    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('Use Write and Read.');
    expect(prompt).not.toContain('${Write_ToolName}');
    expect(prompt).not.toContain('${Read_ToolName}');
  });

  it('should not substitute disabled tool names', () => {
    const emptyToolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue([]),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockContext = {
      ...mockContext,
      toolRegistry: emptyToolRegistry,
    };
    vi.mocked(
      mockConfig.getToolRegistry as ReturnType<typeof vi.fn>,
    ).mockReturnValue(emptyToolRegistry);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('Use ${write_file_ToolName}.');

    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toBe('Use ${write_file_ToolName}.');
  });
});
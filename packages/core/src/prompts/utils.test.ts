/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolvePathFromEnv,
  isSectionEnabled,
  applySubstitutions,
} from './utils.js';
import type { Config } from '../config/config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';

vi.mock('../utils/paths.js', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
}));

vi.mock('../utils/debugLogger.js', () => ({
  debugLogger: {
    warn: vi.fn(),
  },
}));

describe('resolvePathFromEnv', () => {
  it('should return default values for undefined input', () => {
    const result = resolvePathFromEnv(undefined);
    expect(result).toEqual({
      isSwitch: false,
      value: null,
      isDisabled: false,
    });
  });

  it('should return default values for empty string input', () => {
    const result = resolvePathFromEnv('');
    expect(result).toEqual({
      isSwitch: false,
      value: null,
      isDisabled: false,
    });
  });

  it('should return default values for whitespace-only input', () => {
    const result = resolvePathFromEnv('   ');
    expect(result).toEqual({
      isSwitch: false,
      value: null,
      isDisabled: false,
    });
  });

  it('should recognize "true" as an enabled switch', () => {
    const result = resolvePathFromEnv('true');
    expect(result).toEqual({
      isSwitch: true,
      value: 'true',
      isDisabled: false,
    });
  });

  it('should recognize "1" as an enabled switch', () => {
    const result = resolvePathFromEnv('1');
    expect(result).toEqual({
      isSwitch: true,
      value: '1',
      isDisabled: false,
    });
  });

  it('should recognize "false" as a disabled switch', () => {
    const result = resolvePathFromEnv('false');
    expect(result).toEqual({
      isSwitch: true,
      value: 'false',
      isDisabled: true,
    });
  });

  it('should recognize "0" as a disabled switch', () => {
    const result = resolvePathFromEnv('0');
    expect(result).toEqual({
      isSwitch: true,
      value: '0',
      isDisabled: true,
    });
  });

  it('should handle case-insensitive switch values', () => {
    const result = resolvePathFromEnv('TRUE');
    expect(result).toEqual({
      isSwitch: true,
      value: 'true',
      isDisabled: false,
    });
  });

  it('should handle case-insensitive FALSE', () => {
    const result = resolvePathFromEnv('FALSE');
    expect(result).toEqual({
      isSwitch: true,
      value: 'false',
      isDisabled: true,
    });
  });

  it('should trim whitespace before evaluating switch values', () => {
    const result = resolvePathFromEnv('  true  ');
    expect(result).toEqual({
      isSwitch: true,
      value: 'true',
      isDisabled: false,
    });
  });

  it('should resolve a regular path', () => {
    const result = resolvePathFromEnv('/some/absolute/path');
    expect(result.isSwitch).toBe(false);
    expect(result.value).toBe('/some/absolute/path');
    expect(result.isDisabled).toBe(false);
  });

  it('should resolve a tilde path to the home directory', () => {
    const result = resolvePathFromEnv('~/my/custom/path');
    expect(result.isSwitch).toBe(false);
    expect(result.value).toContain('/mock/home');
    expect(result.value).toContain('my/custom/path');
    expect(result.isDisabled).toBe(false);
  });

  it('should resolve a bare tilde to the home directory', () => {
    const result = resolvePathFromEnv('~');
    expect(result.isSwitch).toBe(false);
    expect(result.value).toBe('/mock/home');
    expect(result.isDisabled).toBe(false);
  });

  it('should handle home directory resolution failure gracefully', async () => {
    const { homedir } = await import('../utils/paths.js');
    vi.mocked(homedir).mockImplementationOnce(() => {
      throw new Error('No home directory');
    });

    const result = resolvePathFromEnv('~/some/path');
    expect(result).toEqual({
      isSwitch: false,
      value: null,
      isDisabled: false,
    });
  });
});

describe('isSectionEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return true when the env var is not set', () => {
    expect(isSectionEnabled('SOME_KEY')).toBe(true);
  });

  it('should return true when the env var is set to "1"', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', '1');
    expect(isSectionEnabled('SOME_KEY')).toBe(true);
  });

  it('should return true when the env var is set to "true"', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', 'true');
    expect(isSectionEnabled('SOME_KEY')).toBe(true);
  });

  it('should return false when the env var is set to "0"', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', '0');
    expect(isSectionEnabled('SOME_KEY')).toBe(false);
  });

  it('should return false when the env var is set to "false"', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', 'false');
    expect(isSectionEnabled('SOME_KEY')).toBe(false);
  });

  it('should handle case-insensitive key conversion', () => {
    vi.stubEnv('GEMINI_PROMPT_MY_SECTION', '0');
    expect(isSectionEnabled('my_section')).toBe(false);
  });

  it('should handle whitespace around the env var value', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', '  false  ');
    expect(isSectionEnabled('SOME_KEY')).toBe(false);
  });

  it('should return true for any non-falsy value', () => {
    vi.stubEnv('GEMINI_PROMPT_SOME_KEY', 'enabled');
    expect(isSectionEnabled('SOME_KEY')).toBe(true);
  });
});

describe('applySubstitutions', () => {
  let mockContext: AgentLoopContext;

  beforeEach(() => {
    const mockConfig = {
      getAgentRegistry: vi.fn().mockReturnValue({
        getAllDefinitions: vi.fn().mockReturnValue([]),
      }),
    } as unknown as Config;

    mockContext = {
      config: mockConfig,
      toolRegistry: {
        getAllToolNames: vi.fn().mockReturnValue([]),
        getAllTools: vi.fn().mockReturnValue([]),
      } as unknown as ToolRegistry,
    } as unknown as AgentLoopContext;
  });

  it('should not replace ${SubAgents} when no sub-agents are defined', () => {
    const result = applySubstitutions('Agents: ${SubAgents}', mockContext, '');
    // Since no sub-agents are defined, the placeholder remains unchanged
    expect(result).toBe('Agents: ${SubAgents}');
  });

  it('should render sub-agents when available', () => {
    (
      mockContext.config as unknown as { getAgentRegistry: ReturnType<typeof vi.fn> }
    ).getAgentRegistry = vi.fn().mockReturnValue({
      getAllDefinitions: vi.fn().mockReturnValue([
        { name: 'test-agent', description: 'A test agent' },
      ]),
    });

    const result = applySubstitutions('Agents: ${SubAgents}', mockContext, '');
    expect(result).toContain('# Available Sub-Agents');
    expect(result).toContain('test-agent');
    expect(result).toContain('A test agent');
  });

  it('should replace ${AvailableTools} with tool names list', () => {
    (mockContext as unknown as { toolRegistry: ToolRegistry }).toolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue(['read_file', 'write_file']),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    const result = applySubstitutions(
      'Tools: ${AvailableTools}',
      mockContext,
      '',
    );
    expect(result).toContain('- read_file');
    expect(result).toContain('- write_file');
  });

  it('should show no tools message when no tools available', () => {
    const result = applySubstitutions(
      'Tools: ${AvailableTools}',
      mockContext,
      '',
    );
    expect(result).toContain('No tools are currently available.');
  });

  it('should replace tool-specific ${toolName_ToolName} variables', () => {
    (mockContext as unknown as { toolRegistry: ToolRegistry }).toolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue(['read_file']),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    const result = applySubstitutions(
      'Use ${read_file_ToolName} to read',
      mockContext,
      '',
    );
    expect(result).toBe('Use read_file to read');
  });

  it('should handle a prompt with no substitution placeholders', () => {
    const result = applySubstitutions(
      'A plain prompt with no variables.',
      mockContext,
      '',
    );
    expect(result).toBe('A plain prompt with no variables.');
  });
});
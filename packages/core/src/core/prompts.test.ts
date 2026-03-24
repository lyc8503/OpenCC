/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCoreSystemPrompt } from './prompts.js';
import { resolvePathFromEnv } from '../prompts/utils.js';
import { isGitRepository } from '../utils/gitUtils.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Config } from '../config/config.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import { GEMINI_DIR } from '../utils/paths.js';
import { debugLogger } from '../utils/debugLogger.js';

vi.mock('../utils/gitUtils', () => ({
  isGitRepository: vi.fn().mockReturnValue(false),
}));
vi.mock('node:fs');

describe('Core System Prompt (prompts.ts)', () => {
  let mockConfig: Config;
  let mockContext: AgentLoopContext;
  let mockToolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('SANDBOX', undefined);
    vi.stubEnv('GEMINI_SYSTEM_MD', undefined);
    vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', undefined);

    mockToolRegistry = {
      getAllToolNames: vi.fn().mockReturnValue(['Grep', 'Glob', 'TodoWrite']),
      getAllTools: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockConfig = {
      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      isInteractive: vi.fn().mockReturnValue(true),
      getSkillManager: vi.fn().mockReturnValue({
        getSkills: vi.fn().mockReturnValue([]),
      }),
      getAgentRegistry: vi.fn().mockReturnValue({
        getAllDefinitions: vi.fn().mockReturnValue([]),
      }),
      get config() {
        return this;
      },
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

  it('should generate a system prompt with basic structure', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('Claude agent');
    expect(prompt).toContain('software engineering tasks');
  });

  it('should include system section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## System');
    expect(prompt).toContain('permission mode');
    expect(prompt).toContain('system-reminder');
  });

  it('should include doing tasks section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Doing tasks');
    expect(prompt).toContain('software engineering tasks');
    expect(prompt).toContain('over-engineering');
  });

  it('should include executing actions with care section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Executing actions with care');
    expect(prompt).toContain('reversibility');
  });

  it('should include using your tools section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Using your tools');
    expect(prompt).toContain('Read instead of cat');
  });

  it('should include tone and style section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Tone and style');
    expect(prompt).toContain('short and concise');
  });

  it('should include output efficiency section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Output efficiency');
    expect(prompt).toContain('Go straight to the point');
  });

  it('should include auto memory section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## auto memory');
    expect(prompt).toContain('MEMORY.md');
  });

  it('should include environment section', () => {
    const prompt = getCoreSystemPrompt(mockContext);

    expect(prompt).toContain('## Environment');
    expect(prompt).toContain('Primary working directory');
  });

  it('should append userMemory with separator when provided', () => {
    const memory = 'This is custom user memory.\nBe extra polite.';
    const prompt = getCoreSystemPrompt(mockContext, memory);

    expect(prompt).toContain('Contextual Instructions');
    expect(prompt).toContain(memory);
  });

  it('should render hierarchical memory with XML tags', () => {
    const memory = {
      global: 'global context',
      extension: 'extension context',
      project: 'project context',
    };
    const prompt = getCoreSystemPrompt(mockContext, memory);

    expect(prompt).toContain(
      '<global_context>\nglobal context\n</global_context>',
    );
    expect(prompt).toContain(
      '<extension_context>\nextension context\n</extension_context>',
    );
    expect(prompt).toContain(
      '<project_context>\nproject context\n</project_context>',
    );
  });

  describe('GEMINI_SYSTEM_MD environment variable', () => {
    it.each(['false', '0'])(
      'should use default prompt when GEMINI_SYSTEM_MD is "%s"',
      (value) => {
        vi.stubEnv('GEMINI_SYSTEM_MD', value);
        const prompt = getCoreSystemPrompt(mockContext);
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(prompt).not.toContain('custom system prompt');
      },
    );

    it('should throw error if GEMINI_SYSTEM_MD points to a non-existent file', () => {
      const customPath = '/non/existent/path/system.md';
      vi.stubEnv('GEMINI_SYSTEM_MD', customPath);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => getCoreSystemPrompt(mockContext)).toThrow(
        `missing system prompt file '${path.resolve(customPath)}'`,
      );
    });

    it.each(['true', '1'])(
      'should read from default path when GEMINI_SYSTEM_MD is "%s"',
      (value) => {
        const defaultPath = path.resolve(path.join(GEMINI_DIR, 'system.md'));
        vi.stubEnv('GEMINI_SYSTEM_MD', value);
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

        const prompt = getCoreSystemPrompt(mockContext);
        expect(fs.readFileSync).toHaveBeenCalledWith(defaultPath, 'utf8');
        expect(prompt).toBe('custom system prompt');
      },
    );

    it('should read from custom path when GEMINI_SYSTEM_MD provides one', () => {
      const customPath = path.resolve('/custom/path/SyStEm.Md');
      vi.stubEnv('GEMINI_SYSTEM_MD', customPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

      const prompt = getCoreSystemPrompt(mockContext);
      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf8');
      expect(prompt).toBe('custom system prompt');
    });
  });

  describe('GEMINI_WRITE_SYSTEM_MD environment variable', () => {
    it.each(['false', '0'])(
      'should not write to file when GEMINI_WRITE_SYSTEM_MD is "%s"',
      (value) => {
        vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', value);
        getCoreSystemPrompt(mockContext);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      },
    );

    it.each(['true', '1'])(
      'should write to default path when GEMINI_WRITE_SYSTEM_MD is "%s"',
      (value) => {
        const defaultPath = path.resolve(path.join(GEMINI_DIR, 'system.md'));
        vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', value);
        getCoreSystemPrompt(mockContext);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          defaultPath,
          expect.any(String),
        );
      },
    );
  });
});

describe('resolvePathFromEnv helper function', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when envVar is undefined, empty, or whitespace', () => {
    it.each([
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace only', '   \n\t  '],
    ])('should return null for %s', (_, input) => {
      const result = resolvePathFromEnv(input);
      expect(result).toEqual({
        isSwitch: false,
        value: null,
        isDisabled: false,
      });
    });
  });

  describe('when envVar is a boolean-like string', () => {
    it.each([
      ['"0" as disabled switch', '0', '0', true],
      ['"false" as disabled switch', 'false', 'false', true],
      ['"1" as enabled switch', '1', '1', false],
      ['"true" as enabled switch', 'true', 'true', false],
      ['"FALSE" (case-insensitive)', 'FALSE', 'false', true],
      ['"TRUE" (case-insensitive)', 'TRUE', 'true', false],
    ])('should handle %s', (_, input, expectedValue, isDisabled) => {
      const result = resolvePathFromEnv(input);
      expect(result).toEqual({
        isSwitch: true,
        value: expectedValue,
        isDisabled,
      });
    });
  });

  describe('when envVar is a file path', () => {
    it.each([['/absolute/path/file.txt'], ['relative/path/file.txt']])(
      'should resolve path: %s',
      (input) => {
        const result = resolvePathFromEnv(input);
        expect(result).toEqual({
          isSwitch: false,
          value: path.resolve(input),
          isDisabled: false,
        });
      },
    );

    it.each([
      ['~/documents/file.txt', 'documents/file.txt'],
      ['~', ''],
    ])('should expand tilde path: %s', (input, homeRelativePath) => {
      const homeDir = '/Users/test';
      vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
      const result = resolvePathFromEnv(input);
      expect(result).toEqual({
        isSwitch: false,
        value: path.resolve(
          homeRelativePath ? path.join(homeDir, homeRelativePath) : homeDir,
        ),
        isDisabled: false,
      });
    });

    it('should handle os.homedir() errors gracefully', () => {
      vi.spyOn(os, 'homedir').mockImplementation(() => {
        throw new Error('Cannot resolve home directory');
      });
      const consoleSpy = vi
        .spyOn(debugLogger, 'warn')
        .mockImplementation(() => {});

      const result = resolvePathFromEnv('~/documents/file.txt');
      expect(result).toEqual({
        isSwitch: false,
        value: null,
        isDisabled: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not resolve home directory for path: ~/documents/file.txt',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type { HierarchicalMemory } from '../config/memory.js';
import { GEMINI_DIR } from '../utils/paths.js';
import * as snippets from './snippets.js';
import {
  resolvePathFromEnv,
  applySubstitutions,
  isSectionEnabled,
  type ResolvedPath,
} from './utils.js';
import { isGitRepository } from '../utils/gitUtils.js';
import {
  WRITE_TODOS_TOOL_NAME,
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
} from '../tools/tool-names.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';

/**
 * Orchestrates prompt generation by gathering context and building options.
 */
export class PromptProvider {
  /**
   * Generates the core system prompt.
   */
  getCoreSystemPrompt(
    context: AgentLoopContext,
    userMemory?: string | HierarchicalMemory,
    interactiveOverride?: boolean,
  ): string {
    const systemMdResolution = resolvePathFromEnv(
      process.env['GEMINI_SYSTEM_MD'],
    );

    const interactiveMode =
      interactiveOverride ?? context.config.isInteractive();
    const toolNames = context.toolRegistry.getAllToolNames();
    const enabledToolNames = new Set(toolNames);

    let basePrompt: string;

    // --- Template File Override ---
    if (systemMdResolution.value && !systemMdResolution.isDisabled) {
      let systemMdPath = path.resolve(path.join(GEMINI_DIR, 'system.md'));
      if (!systemMdResolution.isSwitch) {
        systemMdPath = systemMdResolution.value;
      }
      if (!fs.existsSync(systemMdPath)) {
        throw new Error(`missing system prompt file '${systemMdPath}'`);
      }
      basePrompt = fs.readFileSync(systemMdPath, 'utf8');
      basePrompt = applySubstitutions(basePrompt, context, '');
    } else {
      // --- Standard Composition ---
      const memoryDir = path.join(
        os.homedir() || os.tmpdir(),
        GEMINI_DIR,
        'projects',
        'memory',
      );

      const options: snippets.SystemPromptOptions = {
        preamble: this.withSection('preamble', () => ({
          interactive: interactiveMode,
        })),
        systemSection: isSectionEnabled('systemSection'),
        doingTasks: isSectionEnabled('doingTasks'),
        executingActionsWithCare: isSectionEnabled('executingActionsWithCare'),
        usingYourTools: this.withSection('usingYourTools', () => ({
          enableTodoWrite: enabledToolNames.has(WRITE_TODOS_TOOL_NAME),
          enableAgent: true,
          enableGrep: enabledToolNames.has(GREP_TOOL_NAME),
          enableGlob: enabledToolNames.has(GLOB_TOOL_NAME),
        })),
        toneAndStyle: isSectionEnabled('toneAndStyle'),
        outputEfficiency: isSectionEnabled('outputEfficiency'),
        autoMemory: this.withSection('autoMemory', () => ({
          memoryDir,
        })),
        environment: this.withSection('environment', () => ({
          workingDir: process.cwd(),
          isGitRepo: isGitRepository(process.cwd()),
          platform: process.platform,
          shell: process.env['SHELL'] ?? 'unknown',
          osVersion: `${os.type()} ${os.release()}`,
          modelName: 'Sonnet 4.6',
          modelId: 'claude-sonnet-4-6',
        })),
      };

      basePrompt = snippets.getCoreSystemPrompt(options);
    }

    // --- Finalization (Shell) ---
    const finalPrompt = snippets.renderFinalShell(basePrompt, userMemory);

    // Sanitize erratic newlines from composition
    const sanitizedPrompt = finalPrompt.replace(/\n{3,}/g, '\n\n');

    // Write back to file if requested
    this.maybeWriteSystemMd(
      sanitizedPrompt,
      systemMdResolution,
      path.resolve(path.join(GEMINI_DIR, 'system.md')),
    );

    return sanitizedPrompt;
  }

  getCompressionPrompt(_context: AgentLoopContext): string {
    return snippets.getCompressionPrompt();
  }

  private withSection<T>(
    key: string,
    factory: () => T,
    guard: boolean = true,
  ): T | undefined {
    return guard && isSectionEnabled(key) ? factory() : undefined;
  }

  private maybeWriteSystemMd(
    basePrompt: string,
    resolution: ResolvedPath,
    defaultPath: string,
  ): void {
    const writeSystemMdResolution = resolvePathFromEnv(
      process.env['GEMINI_WRITE_SYSTEM_MD'],
    );
    if (writeSystemMdResolution.value && !writeSystemMdResolution.isDisabled) {
      const writePath = writeSystemMdResolution.isSwitch
        ? defaultPath
        : writeSystemMdResolution.value;
      fs.mkdirSync(path.dirname(writePath), { recursive: true });
      fs.writeFileSync(writePath, basePrompt);
    }
  }
}
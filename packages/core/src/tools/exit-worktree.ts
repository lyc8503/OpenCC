/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  type ToolResult,
  Kind,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { EXIT_WORKTREE_TOOL_NAME } from './tool-names.js';
import { EXIT_WORKTREE_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { ToolErrorType } from './tool-error.js';

const execAsync = promisify(exec);

export interface ExitWorktreeParams {}

export class ExitWorktreeTool extends BaseDeclarativeTool<
  ExitWorktreeParams,
  ToolResult
> {
  static readonly Name = EXIT_WORKTREE_TOOL_NAME;

  constructor(private readonly config: Config, messageBus: MessageBus) {
    super(
      ExitWorktreeTool.Name,
      'Exit Worktree',
      EXIT_WORKTREE_DEFINITION.base.description!,
      Kind.Edit,
      EXIT_WORKTREE_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: ExitWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): ExitWorktreeInvocation {
    return new ExitWorktreeInvocation(
      this.config,
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(EXIT_WORKTREE_DEFINITION, modelId);
  }
}

export class ExitWorktreeInvocation extends BaseToolInvocation<
  ExitWorktreeParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: ExitWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return 'Exiting worktree and returning to original directory';
  }

  private isInWorktree(): boolean {
    // Simple check: if target dir contains .claude/worktrees/, we're in a worktree
    return this.config.getTargetDir().includes('.claude/worktrees/');
  }

  private async getWorktreeList(cwd: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd });
      return stdout.split('\n');
    } catch {
      return [];
    }
  }

  private parseWorktreeList(lines: string[]): Array<{ path: string; isMain: boolean }> {
    const worktrees: Array<{ path: string; isMain: boolean }> = [];
    let currentPath = '';
    let isMain = true;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentPath) {
          worktrees.push({ path: currentPath, isMain });
        }
        currentPath = line.substring(9);
        isMain = worktrees.length === 0;
      }
    }

    if (currentPath) {
      worktrees.push({ path: currentPath, isMain });
    }

    return worktrees;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const currentDir = this.config.getTargetDir();

    if (!this.isInWorktree()) {
      return {
        llmContent: 'Not in a worktree. Cannot exit.',
        returnDisplay: 'Not in a worktree',
        error: {
          message: 'Not currently in a worktree',
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }

    try {
      const lines = await this.getWorktreeList(currentDir);
      const worktrees = this.parseWorktreeList(lines);

      const mainWorktree = worktrees.find((w) => w.isMain);
      if (!mainWorktree) {
        return {
          llmContent: 'Could not find original working directory.',
          returnDisplay: 'Failed to find original directory',
          error: {
            message: 'Could not find original working directory from git worktree list',
            type: ToolErrorType.EXECUTION_FAILED,
          },
        };
      }

      const originalPath = mainWorktree.path;
      const currentWorktreePath = currentDir;

      this.config.setTargetDir(originalPath);

      let worktreeRemoved = false;
      try {
        await execAsync(
          `git worktree remove "${currentWorktreePath}" --force`,
          { cwd: originalPath },
        );
        worktreeRemoved = true;
      } catch {
        worktreeRemoved = false;
      }

      const message = worktreeRemoved
        ? 'Worktree has been removed.'
        : 'Worktree has been kept (it may contain uncommitted changes).';

      return {
        llmContent: `Successfully returned to original directory: ${originalPath}\nWorktree: ${currentWorktreePath}\n${message}`,
        returnDisplay: 'Returned to original directory',
        data: {
          returnedToPath: originalPath,
          worktreePath: currentWorktreePath,
          worktreeRemoved,
        } as Record<string, unknown>,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        llmContent: `Failed to exit worktree: ${errorMessage}`,
        returnDisplay: 'Failed to exit worktree',
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

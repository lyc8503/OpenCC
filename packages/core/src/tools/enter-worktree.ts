/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  type ToolResult,
  Kind,
  type ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { ENTER_WORKTREE_TOOL_NAME } from './tool-names.js';
import { ENTER_WORKTREE_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { ToolErrorType } from './tool-error.js';

const execAsync = promisify(exec);

export interface EnterWorktreeParams {
  name?: string;
}

/**
 * Result of a worktree operation
 */
interface WorktreeResult {
  worktreePath: string;
  branchName: string;
  originalPath: string;
}

/**
 * Tool for entering a git worktree.
 * Creates an isolated git worktree for development work.
 */
export class EnterWorktreeTool extends BaseDeclarativeTool<
  EnterWorktreeParams,
  ToolResult
> {
  static readonly Name = ENTER_WORKTREE_TOOL_NAME;

  constructor(private readonly config: Config, messageBus: MessageBus) {
    super(
      EnterWorktreeTool.Name,
      'Enter Worktree',
      ENTER_WORKTREE_DEFINITION.base.description!,
      Kind.Edit,
      ENTER_WORKTREE_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
  }

  protected createInvocation(
    params: EnterWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): EnterWorktreeInvocation {
    return new EnterWorktreeInvocation(
      this.config,
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(ENTER_WORKTREE_DEFINITION, modelId);
  }
}

export class EnterWorktreeInvocation extends BaseToolInvocation<
  EnterWorktreeParams,
  ToolResult
> {
  private confirmationOutcome: ToolConfirmationOutcome | null = null;
  private worktreeResult: WorktreeResult | null = null;

  constructor(
    private readonly config: Config,
    params: EnterWorktreeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    const name = this.params.name || 'random name';
    return `Creating worktree: ${name}`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolInfoConfirmationDetails | false> {
    // This tool requires user confirmation
    return {
      type: 'info',
      title: 'Enter Worktree',
      prompt: `This will create an isolated git worktree${this.params.name ? ` named "${this.params.name}"` : ''}. Continue?`,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        this.confirmationOutcome = outcome;
      },
    };
  }

  private async isGitRepository(dir: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: dir });
      return true;
    } catch {
      return false;
    }
  }

  private async isInWorktree(dir: string): Promise<boolean> {
    try {
      await execAsync(
        'git rev-parse --is-inside-work-tree',
        { cwd: dir },
      );
      // If we're in a worktree, .git will be a file, not a directory
      const gitPath = path.join(dir, '.git');
      const stat = fs.statSync(gitPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async getCurrentBranch(dir: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: dir },
      );
      return stdout.trim();
    } catch {
      return 'main';
    }
  }

  private async createWorktree(
    baseDir: string,
    name: string,
    baseBranch: string,
  ): Promise<WorktreeResult> {
    // Create .claude/worktrees directory if it doesn't exist
    const worktreesDir = path.join(baseDir, '.claude', 'worktrees');

    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    const worktreePath = path.join(worktreesDir, name);
    const branchName = `worktree/${name}`;

    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
      throw new Error(`Worktree "${name}" already exists at ${worktreePath}`);
    }

    // Create the worktree with a new branch
    await execAsync(
      `git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`,
      { cwd: baseDir },
    );

    return {
      worktreePath,
      branchName,
      originalPath: baseDir,
    };
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (this.confirmationOutcome === ToolConfirmationOutcome.Cancel) {
      return {
        llmContent: 'Worktree creation cancelled by user.',
        returnDisplay: 'Cancelled',
      };
    }

    const baseDir = this.config.getTargetDir();
    const name = this.params.name || `worktree-${Date.now()}`;

    // Check if we're in a git repository
    const isGit = await this.isGitRepository(baseDir);
    if (!isGit) {
      return {
        llmContent: `Not a git repository: ${baseDir}`,
        returnDisplay: 'Not a git repository',
        error: {
          message: 'Target directory is not a git repository',
          type: ToolErrorType.PATH_NOT_IN_WORKSPACE,
        },
      };
    }

    // Check if we're already in a worktree
    const inWorktree = await this.isInWorktree(baseDir);
    if (inWorktree) {
      return {
        llmContent: 'Already in a worktree. Cannot create nested worktrees.',
        returnDisplay: 'Already in a worktree',
        error: {
          message: 'Cannot create nested worktrees',
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }

    try {
      // Get current branch to base the worktree on
      const currentBranch = await this.getCurrentBranch(baseDir);

      // Create the worktree
      this.worktreeResult = await this.createWorktree(
        baseDir,
        name,
        currentBranch,
      );

      return {
        llmContent: `Successfully created worktree "${name}" at ${this.worktreeResult.worktreePath}.
Branch: ${this.worktreeResult.branchName}
Original directory: ${this.worktreeResult.originalPath}

The session has been switched to the new worktree. Use ExitWorktree to return to the original directory.`,
        returnDisplay: `Created worktree: ${name}`,
        data: {
          worktreePath: this.worktreeResult.worktreePath,
          branchName: this.worktreeResult.branchName,
          originalPath: this.worktreeResult.originalPath,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        llmContent: `Failed to create worktree "${name}": ${errorMessage}`,
        returnDisplay: `Failed to create worktree`,
        error: {
          message: errorMessage,
          type: ToolErrorType.FILE_WRITE_FAILURE,
        },
      };
    }
  }
}
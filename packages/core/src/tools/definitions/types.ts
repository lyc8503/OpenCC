/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type FunctionDeclaration } from '@google/genai';

/**
 * Defines a tool's identity using a structured declaration.
 */
export interface ToolDefinition {
  /** The base declaration for the tool. */
  base: FunctionDeclaration;
}

/**
 * Explicit mapping of all core tools.
 */
export interface CoreToolSet {
  Agent: FunctionDeclaration;
  Read: FunctionDeclaration;
  Write: FunctionDeclaration;
  Grep: FunctionDeclaration;
  Glob: FunctionDeclaration;
  Bash: (
    enableInteractiveShell: boolean,
    enableEfficiency: boolean,
  ) => FunctionDeclaration;
  Edit: FunctionDeclaration;
  WebSearch: FunctionDeclaration;
  WebFetch: FunctionDeclaration;
  TodoWrite: FunctionDeclaration;
  AskUserQuestion: FunctionDeclaration;
  EnterPlanMode: FunctionDeclaration;
  ExitPlanMode: (plansDir: string) => FunctionDeclaration;
  Skill: (skillNames: string[]) => FunctionDeclaration;
  TaskOutput: FunctionDeclaration;
  TaskStop: FunctionDeclaration;
  EnterWorktree: FunctionDeclaration;
  ExitWorktree: FunctionDeclaration;
  NotebookEdit: FunctionDeclaration;
}

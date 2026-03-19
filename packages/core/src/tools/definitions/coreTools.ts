/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Orchestrator for tool definitions.
 * Provides unified tool definitions for all models.
 */

import type { ToolDefinition, CoreToolSet } from './types.js';
import { TOOL_SET } from './model-family-sets/tool-set.js';
import {
  getShellDeclaration,
  getExitPlanModeDeclaration,
  getActivateSkillDeclaration,
} from './dynamic-declaration-helpers.js';

// Re-export names for compatibility
export {
  AGENT_TOOL_NAME,
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  SHELL_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  EDIT_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  WRITE_TODOS_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  ACTIVATE_SKILL_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  TASK_OUTPUT_TOOL_NAME,
  TASK_STOP_TOOL_NAME,
  ENTER_WORKTREE_TOOL_NAME,
  NOTEBOOK_EDIT_TOOL_NAME,
  // Shared parameter names
  PARAM_FILE_PATH,
  PARAM_DIR_PATH,
  PARAM_PATTERN,
  PARAM_CASE_SENSITIVE,
  PARAM_RESPECT_GIT_IGNORE,
  PARAM_RESPECT_GEMINI_IGNORE,
  PARAM_FILE_FILTERING_OPTIONS,
  PARAM_DESCRIPTION,
  // Tool-specific parameter names
  READ_FILE_PARAM_START_LINE,
  READ_FILE_PARAM_END_LINE,
  WRITE_FILE_PARAM_CONTENT,
  GREP_PARAM_INCLUDE_PATTERN,
  GREP_PARAM_EXCLUDE_PATTERN,
  GREP_PARAM_NAMES_ONLY,
  GREP_PARAM_MAX_MATCHES_PER_FILE,
  GREP_PARAM_TOTAL_MAX_MATCHES,
  GREP_PARAM_FIXED_STRINGS,
  GREP_PARAM_CONTEXT,
  GREP_PARAM_AFTER,
  GREP_PARAM_BEFORE,
  GREP_PARAM_NO_IGNORE,
  EDIT_PARAM_INSTRUCTION,
  EDIT_PARAM_OLD_STRING,
  EDIT_PARAM_NEW_STRING,
  EDIT_PARAM_ALLOW_MULTIPLE,
  SHELL_PARAM_COMMAND,
  SHELL_PARAM_IS_BACKGROUND,
  WEB_SEARCH_PARAM_QUERY,
  WEB_FETCH_PARAM_PROMPT,
  TODOS_PARAM_TODOS,
  TODOS_ITEM_PARAM_DESCRIPTION,
  TODOS_ITEM_PARAM_STATUS,
  ASK_USER_PARAM_QUESTIONS,
  ASK_USER_QUESTION_PARAM_QUESTION,
  ASK_USER_QUESTION_PARAM_HEADER,
  ASK_USER_QUESTION_PARAM_TYPE,
  ASK_USER_QUESTION_PARAM_OPTIONS,
  ASK_USER_QUESTION_PARAM_MULTI_SELECT,
  ASK_USER_QUESTION_PARAM_PLACEHOLDER,
  ASK_USER_OPTION_PARAM_LABEL,
  ASK_USER_OPTION_PARAM_DESCRIPTION,
  PLAN_MODE_PARAM_REASON,
  EXIT_PLAN_PARAM_PLAN_PATH,
  SKILL_PARAM_NAME,
  TASK_OUTPUT_PARAM_TASK_ID,
  TASK_OUTPUT_PARAM_BLOCK,
  TASK_OUTPUT_PARAM_TIMEOUT,
  TASK_STOP_PARAM_TASK_ID,
  ENTER_WORKTREE_PARAM_NAME,
  NOTEBOOK_EDIT_PARAM_PATH,
  NOTEBOOK_EDIT_PARAM_CELL_ID,
  NOTEBOOK_EDIT_PARAM_NEW_SOURCE,
  NOTEBOOK_EDIT_PARAM_CELL_TYPE,
  NOTEBOOK_EDIT_PARAM_EDIT_MODE,
} from './base-declarations.js';

// Re-export tool set
export { TOOL_SET } from './model-family-sets/tool-set.js';

/**
 * Returns the unified tool set for all models.
 */
export function getToolSet(): CoreToolSet {
  return TOOL_SET;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const READ_FILE_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Read,
};

export const WRITE_FILE_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Write,
};

export const GREP_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Grep,
};

export const RIP_GREP_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Grep,
};

export const WEB_SEARCH_DEFINITION: ToolDefinition = {
  base: TOOL_SET.WebSearch,
};

export const EDIT_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Edit,
};

export const GLOB_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Glob,
};

export const WEB_FETCH_DEFINITION: ToolDefinition = {
  base: TOOL_SET.WebFetch,
};

export const AGENT_DEFINITION: ToolDefinition = {
  base: TOOL_SET.Agent,
};

export const WRITE_TODOS_DEFINITION: ToolDefinition = {
  base: TOOL_SET.TodoWrite,
};

export const ASK_USER_DEFINITION: ToolDefinition = {
  base: TOOL_SET.AskUserQuestion,
};

export const ENTER_PLAN_MODE_DEFINITION: ToolDefinition = {
  base: TOOL_SET.EnterPlanMode,
};

export const TASK_OUTPUT_DEFINITION: ToolDefinition = {
  base: TOOL_SET.TaskOutput,
};

export const TASK_STOP_DEFINITION: ToolDefinition = {
  base: TOOL_SET.TaskStop,
};

export const ENTER_WORKTREE_DEFINITION: ToolDefinition = {
  base: TOOL_SET.EnterWorktree,
};

export const NOTEBOOK_EDIT_DEFINITION: ToolDefinition = {
  base: TOOL_SET.NotebookEdit,
};

// ============================================================================
// DYNAMIC TOOL DEFINITIONS
// ============================================================================

export {
  getShellToolDescription,
  getCommandDescription,
} from './dynamic-declaration-helpers.js';

export function getShellDefinition(
  enableInteractiveShell: boolean,
  enableEfficiency: boolean,
): ToolDefinition {
  return {
    base: getShellDeclaration(enableInteractiveShell, enableEfficiency),
  };
}

export function getExitPlanModeDefinition(plansDir: string): ToolDefinition {
  return {
    base: getExitPlanModeDeclaration(plansDir),
  };
}

export function getActivateSkillDefinition(
  skillNames: string[],
): ToolDefinition {
  return {
    base: getActivateSkillDeclaration(skillNames),
  };
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
} from './definitions/coreTools.js';

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
};

export const EDIT_TOOL_NAMES = new Set([EDIT_TOOL_NAME, WRITE_FILE_TOOL_NAME]);

/**
 * Tools that can access local files or remote resources and should be
 * treated with extra caution when updating policies.
 */
export const SENSITIVE_TOOLS = new Set([
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  EDIT_TOOL_NAME,
  SHELL_TOOL_NAME,
]);

// Tool Display Names
export const WRITE_FILE_DISPLAY_NAME = 'WriteFile';
export const EDIT_DISPLAY_NAME = 'Edit';
export const ASK_USER_DISPLAY_NAME = 'Ask User';
export const READ_FILE_DISPLAY_NAME = 'ReadFile';
export const GLOB_DISPLAY_NAME = 'FindFiles';

/** Prefix used for tools discovered via the tool DiscoveryCommand. */
export const DISCOVERED_TOOL_PREFIX = 'discovered_tool_';

/**
 * List of all built-in tool names.
 */
import {
  isMcpToolName,
  parseMcpToolName,
  MCP_TOOL_PREFIX,
} from './mcp-tool.js';

export const ALL_BUILTIN_TOOL_NAMES = [
  AGENT_TOOL_NAME,
  GLOB_TOOL_NAME,
  WRITE_TODOS_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  EDIT_TOOL_NAME,
  SHELL_TOOL_NAME,
  GREP_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  ACTIVATE_SKILL_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
  TASK_OUTPUT_TOOL_NAME,
  TASK_STOP_TOOL_NAME,
  ENTER_WORKTREE_TOOL_NAME,
  NOTEBOOK_EDIT_TOOL_NAME,
] as const;

/**
 * Read-only tools available in Plan Mode.
 * This list is used to dynamically generate the Plan Mode prompt,
 * filtered by what tools are actually enabled in the current configuration.
 */
export const PLAN_MODE_TOOLS = [
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  ACTIVATE_SKILL_TOOL_NAME,
] as const;

/**
 * Validates if a tool name is syntactically valid.
 * Checks against built-in tools, discovered tools, and MCP naming conventions.
 */
export function isValidToolName(
  name: string,
  options: { allowWildcards?: boolean } = {},
): boolean {
  // Built-in tools
  if ((ALL_BUILTIN_TOOL_NAMES as readonly string[]).includes(name)) {
    return true;
  }

  // Discovered tools
  if (name.startsWith(DISCOVERED_TOOL_PREFIX)) {
    return true;
  }

  // Policy wildcards
  if (options.allowWildcards && name === '*') {
    return true;
  }

  // Handle standard MCP FQNs (mcp_server_tool or wildcards mcp_*, mcp_server_*)
  if (isMcpToolName(name)) {
    // Global wildcard: mcp_*
    if (name === `${MCP_TOOL_PREFIX}*` && options.allowWildcards) {
      return true;
    }

    // Explicitly reject names with empty server component (e.g. mcp__tool)
    if (name.startsWith(`${MCP_TOOL_PREFIX}_`)) {
      return false;
    }

    const parsed = parseMcpToolName(name);
    // Ensure that both components are populated. parseMcpToolName splits at the second _,
    // so `mcp__tool` has serverName="", toolName="tool"
    if (parsed.serverName && parsed.toolName) {
      // Basic slug validation for server and tool names.
      // We allow dots (.) and colons (:) as they are valid in function names and
      // used for truncation markers.
      const slugRegex = /^[a-z0-9_.:-]+$/i;

      if (!slugRegex.test(parsed.serverName)) {
        return false;
      }

      if (parsed.toolName === '*') {
        return options.allowWildcards === true;
      }

      // A tool name consisting only of underscores is invalid.
      if (/^_*$/.test(parsed.toolName)) {
        return false;
      }

      return slugRegex.test(parsed.toolName);
    }

    return false;
  }

  return false;
}

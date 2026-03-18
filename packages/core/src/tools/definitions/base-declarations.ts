/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Identity registry for all core tools.
 * Sits at the bottom of the dependency tree to prevent circular imports.
 */

// ============================================================================
// SHARED PARAMETER NAMES (used by multiple tools)
// ============================================================================

export const PARAM_FILE_PATH = 'file_path';
export const PARAM_DIR_PATH = 'path';
export const PARAM_PATTERN = 'pattern';
export const PARAM_CASE_SENSITIVE = '-i';
export const PARAM_RESPECT_GIT_IGNORE = 'respect_git_ignore';
export const PARAM_RESPECT_GEMINI_IGNORE = 'respect_gemini_ignore';
export const PARAM_FILE_FILTERING_OPTIONS = 'file_filtering_options';
export const PARAM_DESCRIPTION = 'description';

// ============================================================================
// TOOL NAMES & TOOL-SPECIFIC PARAMETER NAMES
// ============================================================================

// -- glob --
export const GLOB_TOOL_NAME = 'Glob';

// -- Grep --
export const GREP_TOOL_NAME = 'Grep';
export const GREP_PARAM_INCLUDE_PATTERN = 'glob';
export const GREP_PARAM_EXCLUDE_PATTERN = 'exclude_pattern';
export const GREP_PARAM_NAMES_ONLY = 'output_mode';
export const GREP_PARAM_MAX_MATCHES_PER_FILE = 'max_matches_per_file';
export const GREP_PARAM_TOTAL_MAX_MATCHES = 'head_limit';
// ripgrep only
export const GREP_PARAM_FIXED_STRINGS = 'fixed_strings';
export const GREP_PARAM_CONTEXT = 'context';
export const GREP_PARAM_AFTER = '-A';
export const GREP_PARAM_BEFORE = '-B';
export const GREP_PARAM_NO_IGNORE = 'no_ignore';

// -- Read --
export const READ_FILE_TOOL_NAME = 'Read';
export const READ_FILE_PARAM_START_LINE = 'offset';
export const READ_FILE_PARAM_END_LINE = 'limit';

// -- Bash --
export const SHELL_TOOL_NAME = 'Bash';
export const SHELL_PARAM_COMMAND = 'command';
export const SHELL_PARAM_IS_BACKGROUND = 'run_in_background';

// -- Write --
export const WRITE_FILE_TOOL_NAME = 'Write';
export const WRITE_FILE_PARAM_CONTENT = 'content';

// -- Edit --
export const EDIT_TOOL_NAME = 'Edit';
export const EDIT_PARAM_INSTRUCTION = 'instruction';
export const EDIT_PARAM_OLD_STRING = 'old_string';
export const EDIT_PARAM_NEW_STRING = 'new_string';
export const EDIT_PARAM_ALLOW_MULTIPLE = 'replace_all';

// -- WebSearch --
export const WEB_SEARCH_TOOL_NAME = 'WebSearch';
export const WEB_SEARCH_PARAM_QUERY = 'query';

// -- TodoWrite --
export const WRITE_TODOS_TOOL_NAME = 'TodoWrite';
export const TODOS_PARAM_TODOS = 'todos';
export const TODOS_ITEM_PARAM_DESCRIPTION = 'content';
export const TODOS_ITEM_PARAM_STATUS = 'status';

// -- WebFetch --
export const WEB_FETCH_TOOL_NAME = 'WebFetch';
export const WEB_FETCH_PARAM_PROMPT = 'prompt';
export const WEB_FETCH_PARAM_URL = 'url';

// -- Skill --
export const ACTIVATE_SKILL_TOOL_NAME = 'Skill';
export const SKILL_PARAM_NAME = 'skill';

// -- AskUserQuestion --
export const ASK_USER_TOOL_NAME = 'AskUserQuestion';
export const ASK_USER_PARAM_QUESTIONS = 'questions';
// ask_user question item params
export const ASK_USER_QUESTION_PARAM_QUESTION = 'question';
export const ASK_USER_QUESTION_PARAM_HEADER = 'header';
export const ASK_USER_QUESTION_PARAM_TYPE = 'type';
export const ASK_USER_QUESTION_PARAM_OPTIONS = 'options';
export const ASK_USER_QUESTION_PARAM_MULTI_SELECT = 'multiSelect';
export const ASK_USER_QUESTION_PARAM_PLACEHOLDER = 'placeholder';
// ask_user option item params
export const ASK_USER_OPTION_PARAM_LABEL = 'label';
export const ASK_USER_OPTION_PARAM_DESCRIPTION = 'description';

// -- ExitPlanMode --
export const EXIT_PLAN_MODE_TOOL_NAME = 'ExitPlanMode';
export const EXIT_PLAN_PARAM_PLAN_PATH = 'plan_path';

// -- EnterPlanMode --
export const ENTER_PLAN_MODE_TOOL_NAME = 'EnterPlanMode';
export const PLAN_MODE_PARAM_REASON = 'reason';

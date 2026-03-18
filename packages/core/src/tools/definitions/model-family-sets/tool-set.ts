/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unified tool manifest for all models.
 * Contains complete descriptions and schemas for all core tools.
 */

import type { CoreToolSet } from '../types.js';
import {
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  EDIT_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  WRITE_TODOS_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  ASK_USER_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  // Shared parameter names
  PARAM_FILE_PATH,
  PARAM_DIR_PATH,
  PARAM_PATTERN,
  PARAM_CASE_SENSITIVE,
  // Tool-specific parameter names
  READ_FILE_PARAM_START_LINE,
  READ_FILE_PARAM_END_LINE,
  WRITE_FILE_PARAM_CONTENT,
  GREP_PARAM_INCLUDE_PATTERN,
  GREP_PARAM_NAMES_ONLY,
  GREP_PARAM_TOTAL_MAX_MATCHES,
  GREP_PARAM_CONTEXT,
  EDIT_PARAM_OLD_STRING,
  EDIT_PARAM_NEW_STRING,
  EDIT_PARAM_ALLOW_MULTIPLE,
  WEB_SEARCH_PARAM_QUERY,
  WEB_FETCH_PARAM_PROMPT,
  WEB_FETCH_PARAM_URL,
  TODOS_PARAM_TODOS,
  TODOS_ITEM_PARAM_DESCRIPTION,
  TODOS_ITEM_PARAM_STATUS,
  ASK_USER_PARAM_QUESTIONS,
  ASK_USER_QUESTION_PARAM_QUESTION,
  ASK_USER_QUESTION_PARAM_HEADER,
  ASK_USER_QUESTION_PARAM_OPTIONS,
  ASK_USER_QUESTION_PARAM_MULTI_SELECT,
  ASK_USER_OPTION_PARAM_LABEL,
  ASK_USER_OPTION_PARAM_DESCRIPTION,
} from '../base-declarations.js';
import {
  getShellDeclaration,
  getExitPlanModeDeclaration,
  getActivateSkillDeclaration,
} from '../dynamic-declaration-helpers.js';

/**
 * Unified tool set for all models.
 */
export const TOOL_SET: CoreToolSet = {
  Read: {
    name: READ_FILE_TOOL_NAME,
    description: `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n format, with line numbers starting at 1
- This tool allows Claude Code to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Claude Code is a multimodal LLM.
- This tool can read PDF files (.pdf). For large PDFs (more than 10 pages), you MUST provide the pages parameter to read specific page ranges (e.g., pages: "1-5"). Reading a large PDF without the pages parameter will fail. Maximum 20 pages per request.
- This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.
- This tool can only read files, not directories. To read a directory, use an ls command via the Bash tool.
- You can call multiple tools in a single response. It is always better to speculatively read multiple potentially useful files in parallel.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot, ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [PARAM_FILE_PATH]: {
          description: 'The absolute path to the file to read',
          type: 'string',
        },
        [READ_FILE_PARAM_START_LINE]: {
          description:
            'The number of lines to skip before starting to read. Equivalent to "offset".',
          type: 'number',
        },
        [READ_FILE_PARAM_END_LINE]: {
          description: 'The number of lines to read. Equivalent to "limit".',
          type: 'number',
        },
      },
      required: [PARAM_FILE_PATH],
      additionalProperties: false,
    },
  },

  Write: {
    name: WRITE_FILE_TOOL_NAME,
    description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file. This tool will fail if you did not read the file first.
- Prefer the Edit tool for modifying existing files — it's safer and more reliable.
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [PARAM_FILE_PATH]: {
          description:
            'The absolute path to the file to write (must be absolute, not relative)',
          type: 'string',
        },
        [WRITE_FILE_PARAM_CONTENT]: {
          description:
            "The content to write to the file. Do not use omission placeholders like '(rest of methods ...)', '...', or 'unchanged code'; provide complete literal content.",
          type: 'string',
        },
        // Internal parameters for user interaction flow
        modified_by_user: {
          description:
            'Internal: Whether the content was modified by the user.',
          type: 'boolean',
        },
        ai_proposed_content: {
          description:
            'Internal: The originally proposed content before user modification.',
          type: 'string',
        },
      },
      required: [PARAM_FILE_PATH, WRITE_FILE_PARAM_CONTENT],
      additionalProperties: false,
    },
  },

  Grep: {
    name: GREP_TOOL_NAME,
    description: `A powerful search tool built on ripgrep

  Usage:
  - ALWAYS use Grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a Bash command. The Grep tool has been optimized for correct permissions and access.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Use Agent tool for open-ended searches requiring multiple rounds
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\``,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [PARAM_PATTERN]: {
          description:
            'The regular expression pattern to search for in file contents',
          type: 'string',
        },
        [PARAM_DIR_PATH]: {
          description:
            'File or directory to search in (rg PATH). Defaults to current working directory.',
          type: 'string',
        },
        [GREP_PARAM_INCLUDE_PATTERN]: {
          description:
            'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
          type: 'string',
        },
        [GREP_PARAM_NAMES_ONLY]: {
          description:
            'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
        },
        ['-B' as string]: {
          description:
            'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        ['-A' as string]: {
          description:
            'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        [GREP_PARAM_CONTEXT]: {
          description:
            'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        [PARAM_CASE_SENSITIVE]: {
          description: 'Case insensitive search (rg -i)',
          type: 'boolean',
        },
        ['type' as string]: {
          description:
            'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
          type: 'string',
        },
        [GREP_PARAM_TOTAL_MAX_MATCHES]: {
          description:
            'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 0 (unlimited).',
          type: 'number',
        },
        ['offset' as string]: {
          description:
            'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
          type: 'number',
        },
        ['multiline' as string]: {
          description:
            'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
          type: 'boolean',
        },
      },
      required: [PARAM_PATTERN],
      additionalProperties: false,
    },
  },

  Glob: {
    name: GLOB_TOOL_NAME,
    description: `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead
- You can call multiple tools in a single response. It is always better to speculatively perform multiple searches in parallel if they are potentially useful.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [PARAM_PATTERN]: {
          description: 'The glob pattern to match files against',
          type: 'string',
        },
        [PARAM_DIR_PATH]: {
          description:
            'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
          type: 'string',
        },
      },
      required: [PARAM_PATTERN],
      additionalProperties: false,
    },
  },

  Bash: (enableInteractiveShell, enableEfficiency) =>
    getShellDeclaration(enableInteractiveShell, enableEfficiency),

  Edit: {
    name: EDIT_TOOL_NAME,
    description: `Performs exact string replacements in files.

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [PARAM_FILE_PATH]: {
          description: 'The absolute path to the file to modify',
          type: 'string',
        },
        [EDIT_PARAM_OLD_STRING]: {
          description: 'The text to replace',
          type: 'string',
        },
        [EDIT_PARAM_NEW_STRING]: {
          description:
            'The text to replace it with (must be different from old_string)',
          type: 'string',
        },
        [EDIT_PARAM_ALLOW_MULTIPLE]: {
          description: 'Replace all occurrences of old_string (default false)',
          default: false,
          type: 'boolean',
        },
      },
      required: [PARAM_FILE_PATH, EDIT_PARAM_OLD_STRING, EDIT_PARAM_NEW_STRING],
      additionalProperties: false,
    },
  },

  WebSearch: {
    name: WEB_SEARCH_TOOL_NAME,
    description: `Allows Claude to search the web and use the results to inform responses. Provides up-to-date information for current events and recent data. Returns search result information formatted as search result blocks, including links as markdown hyperlinks.
CRITICAL REQUIREMENT - You MUST follow this:
- When answering the user's question, you MUST include a "Sources:" section at the end of your response
- In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
- IMPORTANT: Never skip including sources in your response`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [WEB_SEARCH_PARAM_QUERY]: {
          type: 'string',
          description:
            'The search query to find information on the web. Must be at least 2 characters.',
          minLength: 2,
        },
        ['allowed_domains' as string]: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only include search results from these domains',
        },
        ['blocked_domains' as string]: {
          type: 'array',
          items: { type: 'string' },
          description: 'Never include search results from these domains',
        },
      },
      required: [WEB_SEARCH_PARAM_QUERY],
      additionalProperties: false,
    },
  },

  WebFetch: {
    name: WEB_FETCH_TOOL_NAME,
    description: `Fetches content from a specified URL and processes it using an AI model. Takes a URL and a prompt as input, fetches the URL content, converts HTML to markdown, and processes the content with the prompt using a small, fast model. Returns the model's response about the content.
CRITICAL REQUIREMENT - You MUST follow this:
- Only include "Sources:" section if using WebSearch tool too
- This tool WILL FAIL for authenticated or private URLs. Before using this tool, check if the URL points to an authenticated service (e.g., Google Docs, Confluence, Jira, GitHub). If so, look for a specialized MCP tool that provides authenticated access.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [WEB_FETCH_PARAM_URL]: {
          description: 'The URL to fetch content from',
          format: 'uri',
          type: 'string',
        },
        [WEB_FETCH_PARAM_PROMPT]: {
          description:
            'The prompt to run on the fetched content. Can contain up to 20 URLs.',
          type: 'string',
        },
      },
      // Either url or prompt must be provided
      oneOf: [
        { required: [WEB_FETCH_PARAM_URL] },
        { required: [WEB_FETCH_PARAM_PROMPT] },
      ],
      additionalProperties: false,
    },
  },

  TodoWrite: {
    name: WRITE_TODOS_TOOL_NAME,
    description: `Use this tool to create a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool

Use this tool proactively in these scenarios:

- Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
- Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
- Plan mode - When using plan mode, create a task list to track the work
- User explicitly requests todo list - When the user directly asks you to use the todo list
- User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)

## When NOT to Use This Tool

Skip using this tool when:
- There is only a single, straightforward task
- The task is trivial and tracking it provides no organizational benefit
- The task can be completed in less than 3 trivial steps

## Task Fields

- **content**: The imperative form describing what needs to be done (e.g., "Fix authentication bug")
- **activeForm**: Present continuous form shown in the spinner when in_progress (e.g., "Fixing authentication bug")

All tasks are created with status \`pending\`.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [TODOS_PARAM_TODOS]: {
          type: 'array',
          description:
            'The complete list of todo items. This will replace the existing list.',
          items: {
            type: 'object',
            description: 'A single todo item.',
            properties: {
              [TODOS_ITEM_PARAM_DESCRIPTION]: {
                type: 'string',
                description:
                  'The imperative form describing what needs to be done',
                minLength: 1,
              },
              [TODOS_ITEM_PARAM_STATUS]: {
                type: 'string',
                description: 'The current status of the task.',
                enum: ['pending', 'in_progress', 'completed'],
              },
              activeForm: {
                type: 'string',
                description:
                  'Present continuous form shown in spinner when in_progress',
                minLength: 1,
              },
            },
            required: [
              TODOS_ITEM_PARAM_DESCRIPTION,
              TODOS_ITEM_PARAM_STATUS,
              'activeForm',
            ],
            additionalProperties: false,
          },
        },
      },
      required: [TODOS_PARAM_TODOS],
      additionalProperties: false,
    },
  },

  AskUserQuestion: {
    name: ASK_USER_TOOL_NAME,
    description: `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label

Plan mode note: In plan mode, use this tool to clarify requirements or choose between approaches BEFORE finalizing your plan. Do NOT use this tool to ask "Is my plan ready?" or "Should I proceed?" - use ExitPlanMode for plan approval.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        [ASK_USER_PARAM_QUESTIONS]: {
          description: 'Questions to ask the user (1-4 questions)',
          minItems: 1,
          maxItems: 4,
          type: 'array',
          items: {
            type: 'object',
            properties: {
              [ASK_USER_QUESTION_PARAM_QUESTION]: {
                description:
                  'The complete question to ask the user. Should be clear, specific, and end with a question mark.',
                type: 'string',
              },
              [ASK_USER_QUESTION_PARAM_HEADER]: {
                description:
                  'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".',
                type: 'string',
              },
              [ASK_USER_QUESTION_PARAM_OPTIONS]: {
                description:
                  'The available choices for this question. Must have 2-4 options.',
                minItems: 2,
                maxItems: 4,
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    [ASK_USER_OPTION_PARAM_LABEL]: {
                      description:
                        'The display text for this option that the user will see and select.',
                      type: 'string',
                    },
                    [ASK_USER_OPTION_PARAM_DESCRIPTION]: {
                      description:
                        'Explanation of what this option means or what will happen if chosen.',
                      type: 'string',
                    },
                    preview: {
                      description:
                        'Optional preview content shown in a monospace box when this option is focused.',
                      type: 'string',
                    },
                  },
                  required: [
                    ASK_USER_OPTION_PARAM_LABEL,
                    ASK_USER_OPTION_PARAM_DESCRIPTION,
                  ],
                  additionalProperties: false,
                },
              },
              [ASK_USER_QUESTION_PARAM_MULTI_SELECT]: {
                description:
                  'Set to true to allow the user to select multiple options instead of just one.',
                default: false,
                type: 'boolean',
              },
            },
            required: [
              ASK_USER_QUESTION_PARAM_QUESTION,
              ASK_USER_QUESTION_PARAM_HEADER,
              ASK_USER_QUESTION_PARAM_OPTIONS,
              ASK_USER_QUESTION_PARAM_MULTI_SELECT,
            ],
            additionalProperties: false,
          },
        },
      },
      required: [ASK_USER_PARAM_QUESTIONS],
      additionalProperties: false,
    },
  },

  EnterPlanMode: {
    name: ENTER_PLAN_MODE_TOOL_NAME,
    description: `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

#### When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
2. **Multiple Valid Approaches**: The task can be solved in several different ways
3. **Code Modifications**: Changes that affect existing behavior or structure
4. **Architectural Decisions**: The task requires choosing between patterns or technologies
5. **Multi-File Changes**: The task will likely touch more than 2-3 files
6. **Unclear Requirements**: You need to explore before understanding the full scope
7. **User Preferences Matter**: The implementation could reasonably go multiple ways

#### When NOT to Use This Tool

Only skip EnterPlanMode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the user has given very specific, detailed instructions
- Pure research/exploration tasks (use the Agent tool with explore agent instead)

#### Important Notes

- This tool REQUIRES user approval - they must consent to entering plan mode
- If unsure whether to use it, err on the side of planning - it's better to get alignment upfront than to redo work
- Users appreciate being consulted before significant changes are made to their codebase`,
    parametersJsonSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },

  ExitPlanMode: (plansDir) => getExitPlanModeDeclaration(plansDir),
  Skill: (skillNames) => getActivateSkillDeclaration(skillNames),
};

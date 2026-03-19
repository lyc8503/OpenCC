/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unified tool manifest for all models.
 * Contains complete descriptions and schemas for all core tools.
 * Aligned with REF_PROMPT.md (Claude Code's tool definitions).
 */

import type { CoreToolSet } from '../types.js';
import {
  getShellDeclaration,
  getExitPlanModeDeclaration,
  getActivateSkillDeclaration,
} from '../dynamic-declaration-helpers.js';

/**
 * Unified tool set for all models.
 * Tool definitions match REF_PROMPT.md exactly.
 */
export const TOOL_SET: CoreToolSet = {
  Agent: {
    name: 'Agent',
    description: `Launch a new agent to handle complex, multi-step tasks autonomously.

The Agent tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

Available agent types and the tools they have access to:
- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)
- Explore: Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions. (Tools: All tools except Agent, ExitPlanMode, Edit, Write, NotebookEdit)
- Plan: Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, ExitPlanMode, Edit, Write, NotebookEdit)

When using the Agent tool, you must specify a subagent_type parameter to select which agent type to use.

When NOT to use the Agent tool:
- If you want to read a specific file path, use the Read or Glob tool instead of the Agent tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Glob tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Agent tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above

Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do
- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- You can optionally run agents in the background using the run_in_background parameter. When an agent runs in the background, you will be automatically notified when it completes — do NOT sleep, poll, or proactively check on its progress. Continue with other work or respond to the user instead.
- **Foreground vs background**: Use foreground (default) when you need the agent's results before you can proceed — e.g., research agents whose findings inform your next steps. Use background when you have genuinely independent work to do in parallel.
- To continue a previously spawned agent, use the resume parameter with the agent's ID. When resumed, the agent continues with its full context preserved. When NOT resuming, each invocation starts fresh — provide a complete task description.
- Provide clear, detailed prompts so the agent can work autonomously and return exactly the information you need.
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
- You can optionally set isolation: "worktree" to run the agent in a temporary git worktree, giving it an isolated copy of the repository. The worktree is automatically cleaned up if the agent makes no changes; if changes are made, the worktree path and branch are returned in the result.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        description: {
          description: 'A short (3-5 word) description of the task',
          type: 'string',
        },
        prompt: {
          description: 'The task for the agent to perform',
          type: 'string',
        },
        subagent_type: {
          description: 'The type of specialized agent to use for this task',
          type: 'string',
        },
        model: {
          description: 'Optional model to use for this agent. If not specified, inherits from parent. Prefer haiku for quick, straightforward tasks to minimize cost and latency.',
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku'],
        },
        resume: {
          description: 'Optional agent ID to resume from. If provided, the agent will continue from the previous execution transcript.',
          type: 'string',
        },
        run_in_background: {
          description: 'Set to true to run this agent in the background. The tool result will include an output_file path - use Read tool or Bash tail to check on output.',
          type: 'boolean',
        },
        isolation: {
          description: 'Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.',
          type: 'string',
          enum: ['worktree'],
        },
        max_turns: {
          description: 'Maximum number of agentic turns (API round-trips) before stopping. Used internally for warmup.',
          type: 'integer',
          exclusiveMinimum: 0,
        },
      },
      required: ['description', 'prompt', 'subagent_type'],
      additionalProperties: false,
    },
  },

  Read: {
    name: 'Read',
    description: `Reads a file from the local filesystem. You can access any file directly by using this tool. Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

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
        file_path: {
          description: 'The absolute path to the file to read',
          type: 'string',
        },
        offset: {
          description: 'The line number to start reading from. Only provide if the file is too large to read at once',
          type: 'number',
        },
        limit: {
          description: 'The number of lines to read. Only provide if the file is too large to read at once.',
          type: 'number',
        },
        pages: {
          description: 'Page range for PDF files (e.g., "1-5", "3", "10-20"). Only applicable to PDF files. Maximum 20 pages per request.',
          type: 'string',
        },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
  },

  Write: {
    name: 'Write',
    description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- Prefer the Edit tool for modifying existing files — it only sends the diff. Only use this tool to create new files or for complete rewrites.
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        file_path: {
          description: 'The absolute path to the file to write (must be absolute, not relative)',
          type: 'string',
        },
        content: {
          description: 'The content to write to the file',
          type: 'string',
        },
      },
      required: ['file_path', 'content'],
      additionalProperties: false,
    },
  },

  Grep: {
    name: 'Grep',
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
        pattern: {
          description: 'The regular expression pattern to search for in file contents',
          type: 'string',
        },
        path: {
          description: 'File or directory to search in (rg PATH). Defaults to current working directory.',
          type: 'string',
        },
        glob: {
          description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
          type: 'string',
        },
        output_mode: {
          description: 'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
        },
        '-B': {
          description: 'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        '-A': {
          description: 'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        '-C': {
          description: 'Alias for context.',
          type: 'number',
        },
        context: {
          description: 'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
          type: 'number',
        },
        '-n': {
          description: 'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
          type: 'boolean',
        },
        '-i': {
          description: 'Case insensitive search (rg -i)',
          type: 'boolean',
        },
        type: {
          description: 'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
          type: 'string',
        },
        head_limit: {
          description: 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 0 (unlimited).',
          type: 'number',
        },
        offset: {
          description: 'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
          type: 'number',
        },
        multiline: {
          description: 'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
          type: 'boolean',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },

  Glob: {
    name: 'Glob',
    description: `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead
- You can call multiple tools in a single response. It is always better to speculatively perform multiple searches in parallel if they are potentially useful.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        pattern: {
          description: 'The glob pattern to match files against',
          type: 'string',
        },
        path: {
          description: 'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
          type: 'string',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },

  Bash: (enableInteractiveShell, enableEfficiency) =>
    getShellDeclaration(enableInteractiveShell, enableEfficiency),

  Edit: {
    name: 'Edit',
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
        file_path: {
          description: 'The absolute path to the file to modify',
          type: 'string',
        },
        old_string: {
          description: 'The text to replace',
          type: 'string',
        },
        new_string: {
          description: 'The text to replace it with (must be different from old_string)',
          type: 'string',
        },
        replace_all: {
          description: 'Replace all occurrences of old_string (default false)',
          default: false,
          type: 'boolean',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
  },

  WebSearch: {
    name: 'WebSearch',
    description: `- Allows Claude to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks, including links as markdown hyperlinks
- Use this tool for accessing information beyond Claude's knowledge cutoff
- Searches are performed automatically within a single API call

CRITICAL REQUIREMENT - You MUST follow this:
- When answering the user's question, you MUST include a "Sources:" section at the end of your response
- In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
- This is MANDATORY - never skip including sources in your response

Usage notes:
- Domain filtering is supported to include or block specific websites
- Web search is only available in the US`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          description: 'The search query to use',
          type: 'string',
          minLength: 2,
        },
        allowed_domains: {
          description: 'Only include search results from these domains',
          type: 'array',
          items: { type: 'string' },
        },
        blocked_domains: {
          description: 'Never include search results from these domains',
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  WebFetch: {
    name: 'WebFetch',
    description: `- Fetches content from a specified URL and processes it using an AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
- IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions.
- The URL must be a fully-formed valid URL
- HTTP URLs will be automatically upgraded to HTTPS
- The prompt should describe what information you want to extract from the page
- This tool is read-only and does not modify any files
- Results may be summarized if the content is very large
- Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
- When a URL redirects to a different host, the tool will inform you and provide the redirect URL in a special format. You should then make a new WebFetch request with the redirect URL to fetch the content.
- For GitHub URLs, prefer using the gh CLI via Bash instead (e.g., gh pr view, gh issue view, gh api).`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: {
          description: 'The URL to fetch content from',
          type: 'string',
          format: 'uri',
        },
        prompt: {
          description: 'The prompt to run on the fetched content',
          type: 'string',
        },
      },
      required: ['url', 'prompt'],
      additionalProperties: false,
    },
  },

  TodoWrite: {
    name: 'TodoWrite',
    description: `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user. It also helps the user understand the progress of the task and overall progress of their requests.

#### When to Use This Tool

Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

#### When NOT to Use This Tool

Skip using this tool when:

1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

#### Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

   **IMPORTANT**: Task descriptions must have two forms:
   - content: The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")
   - activeForm: The present continuous form shown during execution (e.g., "Running tests", "Building the project")

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Exactly ONE task must be in_progress at any time (not less, not more)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        todos: {
          description: 'The updated todo list',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                minLength: 1,
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
              },
              activeForm: {
                type: 'string',
                minLength: 1,
              },
            },
            required: ['content', 'status', 'activeForm'],
            additionalProperties: false,
          },
        },
      },
      required: ['todos'],
      additionalProperties: false,
    },
  },

  AskUserQuestion: {
    name: 'AskUserQuestion',
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
        questions: {
          description: 'Questions to ask the user (1-4 questions)',
          minItems: 1,
          maxItems: 4,
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: {
                description: 'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"',
                type: 'string',
              },
              header: {
                description: 'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".',
                type: 'string',
              },
              options: {
                description: 'The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no \'Other\' option, that will be provided automatically.',
                minItems: 2,
                maxItems: 4,
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: {
                      description: 'The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.',
                      type: 'string',
                    },
                    description: {
                      description: 'Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.',
                      type: 'string',
                    },
                    markdown: {
                      description: 'Optional preview content shown in a monospace box when this option is focused. Use for ASCII mockups, code snippets, or diagrams that help users visually compare options. Supports multi-line text with newlines.',
                      type: 'string',
                    },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
              },
              multiSelect: {
                description: 'Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.',
                default: false,
                type: 'boolean',
              },
            },
            required: ['question', 'header', 'options', 'multiSelect'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    },
  },

  EnterPlanMode: {
    name: 'EnterPlanMode',
    description: `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

#### When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
   - Example: "Add a logout button" - where should it go? What should happen on click?
   - Example: "Add form validation" - what rules? What error messages?

2. **Multiple Valid Approaches**: The task can be solved in several different ways
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

3. **Code Modifications**: Changes that affect existing behavior or structure
   - Example: "Update the login flow" - what exactly should change?
   - Example: "Refactor this component" - what's the target architecture?

4. **Architectural Decisions**: The task requires choosing between patterns or technologies
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

5. **Multi-File Changes**: The task will likely touch more than 2-3 files
   - Example: "Refactor the authentication system"
   - Example: "Add a new API endpoint with tests"

6. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

7. **User Preferences Matter**: The implementation could reasonably go multiple ways
   - If you would use AskUserQuestion to clarify the approach, use EnterPlanMode instead
   - Plan mode lets you explore first, then present options with context

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

  TaskOutput: {
    name: 'TaskOutput',
    description: `- Retrieves output from a running or completed task (background shell, agent, or remote session)
- Takes a task_id parameter identifying the task
- Returns the task output along with status information
- Use block=true (default) to wait for task completion
- Use block=false for non-blocking check of current status
- Task IDs can be found using the /tasks command
- Works with all task types: background shells, async agents, and remote sessions`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        task_id: {
          description: 'The task ID to get output from',
          type: 'string',
        },
        block: {
          description: 'Whether to wait for completion',
          default: true,
          type: 'boolean',
        },
        timeout: {
          description: 'Max wait time in ms',
          default: 30000,
          type: 'number',
          minimum: 0,
          maximum: 600000,
        },
      },
      required: ['task_id'],
      additionalProperties: false,
    },
  },

  TaskStop: {
    name: 'TaskStop',
    description: `- Stops a running background task by its ID
- Takes a task_id parameter identifying the task to stop
- Returns a success or failure status
- Use this tool when you need to terminate a long-running task`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        task_id: {
          description: 'The ID of the background task to stop',
          type: 'string',
        },
        shell_id: {
          description: 'Deprecated: use task_id instead',
          type: 'string',
        },
      },
      additionalProperties: false,
    },
  },

  EnterWorktree: {
    name: 'EnterWorktree',
    description: `Use this tool ONLY when the user explicitly asks to work in a worktree. This tool creates an isolated git worktree and switches the current session into it.

#### When to Use

- The user explicitly says "worktree" (e.g., "start a worktree", "work in a worktree", "create a worktree", "use a worktree")

#### When NOT to Use

- The user asks to create a branch, switch branches, or work on a different branch — use git commands instead
- The user asks to fix a bug or work on a feature — use normal git workflow unless they specifically mention worktrees
- Never use this tool unless the user explicitly mentions "worktree"

#### Requirements

- Must be in a git repository, OR have WorktreeCreate/WorktreeRemove hooks configured in settings.json
- Must not already be in a worktree

#### Behavior

- In a git repository: creates a new git worktree inside \`.claude/worktrees/\` with a new branch based on HEAD
- Outside a git repository: delegates to WorktreeCreate/WorktreeRemove hooks for VCS-agnostic isolation
- Switches the session's working directory to the new worktree
- On session exit, the user will be prompted to keep or remove the worktree

#### Parameters

- \`name\` (optional): A name for the worktree. If not provided, a random name is generated.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: {
          description: 'Optional name for the worktree. A random name is generated if not provided.',
          type: 'string',
        },
      },
      additionalProperties: false,
    },
  },

  NotebookEdit: {
    name: 'NotebookEdit',
    description: `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        notebook_path: {
          description: 'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
          type: 'string',
        },
        cell_id: {
          description: 'The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.',
          type: 'string',
        },
        new_source: {
          description: 'The new source for the cell',
          type: 'string',
        },
        cell_type: {
          description: 'The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.',
          type: 'string',
          enum: ['code', 'markdown'],
        },
        edit_mode: {
          description: 'The type of edit to make (replace, insert, delete). Defaults to replace.',
          type: 'string',
          enum: ['replace', 'insert', 'delete'],
        },
      },
      required: ['notebook_path', 'new_source'],
      additionalProperties: false,
    },
  },
};
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageBus } from '../confirmation-bus/message-bus.js';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { downloadRipGrep } from '@joshua.litt/get-ripgrep';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { getErrorMessage, isNodeError } from '../utils/errors.js';
import type { Config } from '../config/config.js';
import { fileExists } from '../utils/fileUtils.js';
import { Storage } from '../config/storage.js';
import { GREP_TOOL_NAME } from './tool-names.js';
import { debugLogger } from '../utils/debugLogger.js';
import {
  FileExclusions,
  COMMON_DIRECTORY_EXCLUDES,
} from '../utils/ignorePatterns.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { execStreaming } from '../utils/shell-utils.js';
import {
  DEFAULT_TOTAL_MAX_MATCHES,
  DEFAULT_SEARCH_TIMEOUT_MS,
} from './constants.js';
import { RIP_GREP_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { type GrepMatch, formatGrepResults } from './grep-utils.js';

function getRgCandidateFilenames(): readonly string[] {
  return process.platform === 'win32' ? ['rg.exe', 'rg'] : ['rg'];
}

async function resolveExistingRgPath(): Promise<string | null> {
  const binDir = Storage.getGlobalBinDir();
  for (const fileName of getRgCandidateFilenames()) {
    const candidatePath = path.join(binDir, fileName);
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

let ripgrepAcquisitionPromise: Promise<string | null> | null = null;
/**
 * Ensures a ripgrep binary is available.
 *
 * NOTE:
 * - The Gemini CLI currently prefers a managed ripgrep binary downloaded
 *   into its global bin directory.
 * - Even if ripgrep is available on the system PATH, it is intentionally
 *   not used at this time.
 *
 * Preference for system-installed ripgrep is blocked on:
 * - checksum verification of external binaries
 * - internalization of the get-ripgrep dependency
 *
 * See:
 * - feat(core): Prefer rg in system path (#11847)
 * - Move get-ripgrep to third_party (#12099)
 */
async function ensureRipgrepAvailable(): Promise<string | null> {
  const existingPath = await resolveExistingRgPath();
  if (existingPath) {
    return existingPath;
  }
  if (!ripgrepAcquisitionPromise) {
    ripgrepAcquisitionPromise = (async () => {
      try {
        await downloadRipGrep(Storage.getGlobalBinDir());
        return await resolveExistingRgPath();
      } finally {
        ripgrepAcquisitionPromise = null;
      }
    })();
  }
  return ripgrepAcquisitionPromise;
}

/**
 * Checks if `rg` exists, if not then attempt to download it.
 */
export async function canUseRipgrep(): Promise<boolean> {
  return (await ensureRipgrepAvailable()) !== null;
}

/**
 * Ensures `rg` is downloaded, or throws.
 */
export async function ensureRgPath(): Promise<string> {
  const downloadedPath = await ensureRipgrepAvailable();
  if (downloadedPath) {
    return downloadedPath;
  }
  throw new Error('Cannot use ripgrep.');
}

/**
 * Parameters for the GrepTool
 * Parameter names match the tool schema (aligned with Claude Code's REF_PROMPT.md)
 */
export interface RipGrepToolParams {
  /**
   * The regular expression pattern to search for in file contents
   */
  pattern: string;

  /**
   * File or directory to search in (rg PATH). Defaults to current working directory.
   */
  path?: string;

  /**
   * Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob
   */
  glob?: string;

  /**
   * Output mode: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';

  /**
   * Case insensitive search (rg -i). When true, search is case-insensitive.
   */
  '-i'?: boolean;

  /**
   * Number of lines to show after each match (rg -A). Requires output_mode: "content".
   */
  '-A'?: number;

  /**
   * Number of lines to show before each match (rg -B). Requires output_mode: "content".
   */
  '-B'?: number;

  /**
   * Number of lines to show before and after each match (rg -C). Requires output_mode: "content".
   */
  context?: number;

  /**
   * Alias for context parameter.
   */
  '-C'?: number;

  /**
   * File type to search (rg --type). Common types: js, py, rust, go, java, etc.
   */
  type?: string;

  /**
   * Limit output to first N lines/entries, equivalent to "| head -N".
   */
  head_limit?: number;

  /**
   * Skip first N lines/entries before applying head_limit.
   */
  offset?: number;

  /**
   * Enable multiline mode where . matches newlines and patterns can span lines.
   */
  multiline?: boolean;

  /**
   * Show line numbers in output (rg -n). Defaults to true.
   */
  '-n'?: boolean;
}

class GrepToolInvocation extends BaseToolInvocation<
  RipGrepToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    private readonly fileDiscoveryService: FileDiscoveryService,
    params: RipGrepToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const pathParam = this.params.path || '.';
      // Default to case-insensitive search (true) unless explicitly set to false
      const caseInsensitive = this.params['-i'] !== false;
      const afterLines = this.params['-A'];
      const beforeLines = this.params['-B'];
      const contextLines = this.params['-C'] ?? this.params.context;
      const headLimit = this.params.head_limit ?? DEFAULT_TOTAL_MAX_MATCHES;
      const offset = this.params.offset ?? 0;
      const multiline = this.params.multiline ?? false;
      const showLineNumbers = this.params['-n'] ?? true;

      const searchDirAbs = path.resolve(this.config.getTargetDir(), pathParam);

      // Check existence and type asynchronously
      try {
        const stats = await fsPromises.stat(searchDirAbs);
        if (!stats.isDirectory() && !stats.isFile()) {
          return {
            llmContent: `Path is not a valid directory or file: ${searchDirAbs}`,
            returnDisplay: 'Error: Path is not a valid directory or file.',
          };
        }
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return {
            llmContent: `Path does not exist: ${searchDirAbs}`,
            returnDisplay: 'Error: Path does not exist.',
            error: {
              message: `Path does not exist: ${searchDirAbs}`,
              type: ToolErrorType.FILE_NOT_FOUND,
            },
          };
        }
        return {
          llmContent: `Failed to access path stats for ${searchDirAbs}: ${getErrorMessage(error)}`,
          returnDisplay: 'Error: Failed to access path.',
        };
      }

      const searchDirDisplay = pathParam;

      const totalMaxMatches = headLimit ?? DEFAULT_TOTAL_MAX_MATCHES;
      if (this.config.getDebugMode()) {
        debugLogger.log(`[GrepTool] Total result limit: ${totalMaxMatches}`);
      }

      // Create a timeout controller to prevent indefinitely hanging searches
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, DEFAULT_SEARCH_TIMEOUT_MS);

      // Link the passed signal to our timeout controller
      const onAbort = () => timeoutController.abort();
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      let allMatches: GrepMatch[];
      try {
        allMatches = await this.performRipgrepSearch({
          pattern: this.params.pattern,
          path: searchDirAbs,
          include_pattern: this.params.glob,
          case_sensitive: !caseInsensitive,
          context: contextLines,
          after: afterLines,
          before: beforeLines,
          multiline: multiline,
          show_line_numbers: showLineNumbers,
          maxMatches: headLimit + offset,
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', onAbort);
      }

      const fileDiscoveryService = this.fileDiscoveryService;
      const uniqueFiles = Array.from(
        new Set(allMatches.map((m) => m.filePath)),
      );
      const absoluteFilePaths = uniqueFiles.map((f) =>
        path.resolve(searchDirAbs, f),
      );
      const allowedFiles = fileDiscoveryService.filterFiles(absoluteFilePaths);
      const allowedSet = new Set(allowedFiles);
      allMatches = allMatches.filter((m) =>
        allowedSet.has(path.resolve(searchDirAbs, m.filePath)),
      );

      const matchCount = allMatches.filter((m) => !m.isContext).length;
      allMatches = await this.enrichWithRipgrepAutoContext(
        allMatches,
        matchCount,
        headLimit,
        searchDirAbs,
        timeoutController.signal,
      );

      // Apply offset: skip first N matches
      if (offset > 0) {
        allMatches = allMatches.slice(offset);
      }

      const searchLocationDescription = `in path "${searchDirDisplay}"`;

      return await formatGrepResults(
        allMatches,
        this.params,
        searchLocationDescription,
        headLimit,
      );
    } catch (error) {
      debugLogger.warn(`Error during GrepLogic execution: ${error}`);
      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error during grep search operation: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
      };
    }
  }

  private async enrichWithRipgrepAutoContext(
    allMatches: GrepMatch[],
    matchCount: number,
    totalMaxMatches: number,
    searchDirAbs: string,
    signal: AbortSignal,
  ): Promise<GrepMatch[]> {
    if (
      matchCount >= 1 &&
      matchCount <= 3 &&
      this.params.output_mode !== 'files_with_matches' &&
      this.params.context === undefined &&
      this.params['-B'] === undefined &&
      this.params['-A'] === undefined
    ) {
      const contextLines = matchCount === 1 ? 50 : 15;
      const uniqueFiles = Array.from(
        new Set(allMatches.map((m) => m.absolutePath)),
      );

      let enrichedMatches = await this.performRipgrepSearch({
        pattern: this.params.pattern,
        path: uniqueFiles,
        basePath: searchDirAbs,
        include_pattern: this.params.glob,
        case_sensitive: !this.params['-i'],
        context: contextLines,
        show_line_numbers: this.params['-n'] ?? true,
        multiline: this.params.multiline ?? false,
        maxMatches: totalMaxMatches,
        signal,
      });

      const allowedFiles = this.fileDiscoveryService.filterFiles(uniqueFiles);
      const allowedSet = new Set(allowedFiles);
      enrichedMatches = enrichedMatches.filter((m) =>
        allowedSet.has(m.absolutePath),
      );

      // Set context to prevent grep-utils from doing the JS fallback auto-context
      this.params.context = contextLines;
      return enrichedMatches;
    }

    return allMatches;
  }

  private async performRipgrepSearch(options: {
    pattern: string;
    path: string | string[];
    basePath?: string;
    include_pattern?: string;
    case_sensitive?: boolean;
    context?: number;
    after?: number;
    before?: number;
    multiline?: boolean;
    show_line_numbers?: boolean;
    maxMatches: number;
    signal: AbortSignal;
  }): Promise<GrepMatch[]> {
    const {
      pattern,
      path,
      basePath,
      include_pattern,
      case_sensitive,
      context,
      after,
      before,
      multiline,
      show_line_numbers,
      maxMatches,
    } = options;

    const searchPaths = Array.isArray(path) ? path : [path];

    const rgArgs = ['--json'];

    if (!case_sensitive) {
      rgArgs.push('--ignore-case');
    }

    rgArgs.push('--regexp', pattern);

    if (context) {
      rgArgs.push('--context', context.toString());
    }
    if (after) {
      rgArgs.push('--after-context', after.toString());
    }
    if (before) {
      rgArgs.push('--before-context', before.toString());
    }

    if (multiline) {
      rgArgs.push('--multiline', '--multiline-dotall');
    }

    if (show_line_numbers !== false) {
      rgArgs.push('--line-number');
    }

    if (include_pattern) {
      rgArgs.push('--glob', include_pattern);
    }

    const fileExclusions = new FileExclusions(this.config);
    const excludes = fileExclusions.getGlobExcludes([
      ...COMMON_DIRECTORY_EXCLUDES,
      '*.log',
      '*.tmp',
    ]);
    excludes.forEach((exclude) => {
      rgArgs.push('--glob', `!${exclude}`);
    });

    // Add .geminiignore and custom ignore files support
    const geminiIgnorePaths = this.fileDiscoveryService.getIgnoreFilePaths();
    for (const ignorePath of geminiIgnorePaths) {
      rgArgs.push('--ignore-file', ignorePath);
    }

    if (!this.config.getFileFilteringRespectGitIgnore()) {
      rgArgs.push('--no-ignore-vcs', '--no-ignore-exclude');
    }

    rgArgs.push('--threads', '4');
    rgArgs.push(...searchPaths);

    const results: GrepMatch[] = [];
    try {
      const rgPath = await ensureRgPath();
      const generator = execStreaming(rgPath, rgArgs, {
        signal: options.signal,
        allowedExitCodes: [0, 1],
        sandboxManager: this.config.sandboxManager,
      });

      let matchesFound = 0;
      const parseBasePath = basePath || searchPaths[0];

      for await (const line of generator) {
        const match = this.parseRipgrepJsonLine(line, parseBasePath);
        if (match) {
          results.push(match);
          if (!match.isContext) {
            matchesFound++;
          }
          if (matchesFound >= maxMatches) {
            break;
          }
        }
      }

      return results;
    } catch (error: unknown) {
      debugLogger.debug(`GrepLogic: ripgrep failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private parseRipgrepJsonLine(
    line: string,
    basePath: string,
  ): GrepMatch | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const json = JSON.parse(line);
      if (json.type === 'match' || json.type === 'context') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = json.data;
        // Defensive check: ensure text properties exist (skips binary/invalid encoding)
        if (data.path?.text && data.lines?.text) {
          const absoluteFilePath = path.resolve(basePath, data.path.text);
          const relativeCheck = path.relative(basePath, absoluteFilePath);
          if (
            relativeCheck === '..' ||
            relativeCheck.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeCheck)
          ) {
            return null;
          }

          const relativeFilePath = path.relative(basePath, absoluteFilePath);

          return {
            absolutePath: absoluteFilePath,
            filePath: relativeFilePath || path.basename(absoluteFilePath),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            lineNumber: data.line_number,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            line: data.lines.text.trimEnd(),
            isContext: json.type === 'context',
          };
        }
      }
    } catch (error) {
      // Only log if it's not a simple empty line or widely invalid
      if (line.trim().length > 0) {
        debugLogger.warn(
          `Failed to parse ripgrep JSON line: ${line.substring(0, 100)}...`,
          error,
        );
      }
    }
    return null;
  }

  /**
   * Gets a description of the grep operation
   * @param params Parameters for the grep operation
   * @returns A string describing the grep
   */
  getDescription(): string {
    let description = `'${this.params.pattern}'`;
    if (this.params.glob) {
      description += ` in ${this.params.glob}`;
    }
    const pathParam = this.params.path || '.';
    const resolvedPath = path.resolve(this.config.getTargetDir(), pathParam);
    if (resolvedPath === this.config.getTargetDir() || pathParam === '.') {
      description += ` within ./`;
    } else {
      const relativePath = makeRelative(
        resolvedPath,
        this.config.getTargetDir(),
      );
      description += ` within ${shortenPath(relativePath)}`;
    }
    return description;
  }
}

/**
 * Implementation of the Grep tool logic (moved from CLI)
 */
export class RipGrepTool extends BaseDeclarativeTool<
  RipGrepToolParams,
  ToolResult
> {
  static readonly Name = GREP_TOOL_NAME;
  private readonly fileDiscoveryService: FileDiscoveryService;

  constructor(
    private readonly config: Config,
    messageBus: MessageBus,
  ) {
    super(
      RipGrepTool.Name,
      'SearchText',
      RIP_GREP_DEFINITION.base.description!,
      Kind.Search,
      RIP_GREP_DEFINITION.base.parametersJsonSchema,
      messageBus,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
    this.fileDiscoveryService = new FileDiscoveryService(
      config.getTargetDir(),
      config.getFileFilteringOptions(),
    );
  }

  /**
   * Validates the parameters for the tool
   * @param params Parameters to validate
   * @returns An error message string if invalid, null otherwise
   */
  protected override validateToolParamValues(
    params: RipGrepToolParams,
  ): string | null {
    try {
      new RegExp(params.pattern);
    } catch (error) {
      return `Invalid regular expression pattern provided: ${params.pattern}. Error: ${getErrorMessage(error)}`;
    }

    if (params.head_limit !== undefined && params.head_limit < 1) {
      return 'head_limit must be at least 1.';
    }

    if (params.offset !== undefined && params.offset < 0) {
      return 'offset must be at least 0.';
    }

    // Only validate path if one is provided
    const pathParam = params.path;
    if (pathParam) {
      const resolvedPath = path.resolve(
        this.config.getTargetDir(),
        pathParam,
      );

      // Check existence and type
      try {
        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory() && !stats.isFile()) {
          return `Path is not a valid directory or file: ${resolvedPath}`;
        }
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return `Path does not exist: ${resolvedPath}`;
        }
        return `Failed to access path stats for ${resolvedPath}: ${getErrorMessage(error)}`;
      }
    }

    return null; // Parameters are valid
  }

  protected createInvocation(
    params: RipGrepToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<RipGrepToolParams, ToolResult> {
    return new GrepToolInvocation(
      this.config,
      this.fileDiscoveryService,
      params,
      messageBus ?? this.messageBus,
      _toolName,
      _toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(RIP_GREP_DEFINITION, modelId);
  }
}

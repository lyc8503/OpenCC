/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Internal utility for reading multiple files in the CLI.
 * This is not exposed as a tool to the LLM, but used internally
 * for @path command handling.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob, escape } from 'glob';
import {
  type Config,
  type FileDiscoveryService,
  DEFAULT_FILE_FILTERING_OPTIONS,
  detectFileType,
  processSingleFileContent,
  REFERENCE_CONTENT_END,
} from '@google/gemini-cli-core';

/**
 * Parameters for reading multiple files.
 */
export interface ReadManyFilesParams {
  /**
   * Glob patterns for files to include.
   */
  include: string[];

  /**
   * Optional glob patterns for files/directories to exclude.
   */
  exclude?: string[];

  /**
   * Whether to apply default exclusion patterns. Defaults to true.
   */
  useDefaultExcludes?: boolean;

  /**
   * File filtering options.
   */
  fileFilteringOptions?: {
    respect_git_ignore?: boolean;
    respect_gemini_ignore?: boolean;
  };
}

/**
 * Result of reading multiple files.
 */
export interface ReadManyFilesResult {
  /**
   * Array of file contents with metadata.
   */
  files: Array<{
    path: string;
    relativePath: string;
    content: string;
  }>;

  /**
   * Files that were skipped with reasons.
   */
  skipped: Array<{
    path: string;
    reason: string;
  }>;
}

/**
 * Gets default exclusion patterns from config.
 */
function getDefaultExcludes(config?: Config): string[] {
  return config?.getFileExclusions?.()?.getReadManyFilesExcludes?.() ?? [];
}

const DEFAULT_OUTPUT_SEPARATOR_FORMAT = '--- {filePath} ---';
const DEFAULT_OUTPUT_TERMINATOR = `\n${REFERENCE_CONTENT_END}`;

/**
 * Reads multiple files from the filesystem using glob patterns.
 * This is an internal utility function, not exposed as an LLM tool.
 */
export async function readManyFiles(
  params: ReadManyFilesParams,
  config: Config,
  fileDiscovery: FileDiscoveryService,
  signal?: AbortSignal,
): Promise<ReadManyFilesResult> {
  const {
    include,
    exclude = [],
    useDefaultExcludes = true,
    fileFilteringOptions,
  } = params;

  const files: ReadManyFilesResult['files'] = [];
  const skipped: ReadManyFilesResult['skipped'] = [];

  const effectiveExcludes = useDefaultExcludes
    ? [...getDefaultExcludes(config), ...exclude]
    : [...exclude];

  try {
    const allEntries = new Set<string>();
    const workspaceDirs = config.getWorkspaceContext().getDirectories();

    for (const dir of workspaceDirs) {
      const processedPatterns: string[] = [];
      for (const p of include) {
        const normalizedP = p.replace(/\\/g, '/');
        const fullPath = path.join(dir, normalizedP);
        let exists = false;
        try {
          await fs.access(fullPath);
          exists = true;
        } catch {
          exists = false;
        }

        if (exists) {
          processedPatterns.push(escape(normalizedP));
        } else {
          processedPatterns.push(normalizedP);
        }
      }

      const entriesInDir = await glob(processedPatterns, {
        cwd: dir,
        ignore: effectiveExcludes,
        nodir: true,
        dot: true,
        absolute: true,
        nocase: true,
        signal,
      });
      for (const entry of entriesInDir) {
        allEntries.add(entry);
      }
    }

    const relativeEntries = Array.from(allEntries).map((p) =>
      path.relative(config.getTargetDir(), p),
    );

    const filteringOpts = {
      respectGitIgnore:
        fileFilteringOptions?.respect_git_ignore ??
        config.getFileFilteringOptions().respectGitIgnore ??
        DEFAULT_FILE_FILTERING_OPTIONS.respectGitIgnore,
      respectGeminiIgnore:
        fileFilteringOptions?.respect_gemini_ignore ??
        config.getFileFilteringOptions().respectGeminiIgnore ??
        DEFAULT_FILE_FILTERING_OPTIONS.respectGeminiIgnore,
    };

    const { filteredPaths, ignoredCount } = fileDiscovery.filterFilesWithReport(
      relativeEntries,
      filteringOpts,
    );

    for (const relativePath of filteredPaths) {
      const fullPath = path.resolve(config.getTargetDir(), relativePath);

      const validationError = config.validatePathAccess(fullPath, 'read');
      if (validationError) {
        skipped.push({
          path: fullPath,
          reason: 'Security: Path not in workspace',
        });
        continue;
      }

      try {
        const fileType = await detectFileType(fullPath);

        // Skip non-text files unless explicitly requested
        if (
          fileType === 'image' ||
          fileType === 'pdf' ||
          fileType === 'audio'
        ) {
          const fileExtension = path.extname(fullPath).toLowerCase();
          const fileNameWithoutExtension = path.basename(
            fullPath,
            fileExtension,
          );
          const requestedExplicitly = include.some(
            (pattern) =>
              pattern.toLowerCase().includes(fileExtension) ||
              pattern.includes(fileNameWithoutExtension),
          );

          if (!requestedExplicitly) {
            skipped.push({
              path: relativePath,
              reason:
                'asset file (image/pdf/audio) was not explicitly requested',
            });
            continue;
          }
        }

        const fileReadResult = await processSingleFileContent(
          fullPath,
          config.getTargetDir(),
          config.getFileSystemService(),
        );

        if (fileReadResult.error) {
          skipped.push({
            path: relativePath,
            reason: `Read error: ${fileReadResult.error}`,
          });
          continue;
        }

        if (typeof fileReadResult.llmContent === 'string') {
          files.push({
            path: fullPath,
            relativePath,
            content: fileReadResult.llmContent,
          });
        }
      } catch (error) {
        skipped.push({
          path: relativePath,
          reason: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (ignoredCount > 0) {
      skipped.push({
        path: `${ignoredCount} file(s)`,
        reason: 'ignored by project ignore files',
      });
    }
  } catch (error) {
    throw new Error(
      `Error during file search: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { files, skipped };
}

/**
 * Formats the result of readManyFiles into content parts.
 */
export function formatReadManyFilesResult(result: ReadManyFilesResult): {
  parts: Array<{ text: string }>;
  displayText: string;
} {
  const parts: Array<{ text: string }> = [];

  for (const file of result.files) {
    const separator = DEFAULT_OUTPUT_SEPARATOR_FORMAT.replace(
      '{filePath}',
      file.path,
    );
    parts.push({ text: `${separator}\n\n${file.content}\n\n` });
  }

  if (result.files.length > 0) {
    parts.push({ text: DEFAULT_OUTPUT_TERMINATOR });
  }

  let displayText = `Successfully read ${result.files.length} file(s)`;
  if (result.skipped.length > 0) {
    displayText += `, skipped ${result.skipped.length}`;
  }

  return { parts, displayText };
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { Storage } from './storage.js';

/** Default context filename for GEMINI.md context files */
export const DEFAULT_CONTEXT_FILENAME = 'GEMINI.md';

// This variable will hold the currently configured filename for GEMINI.md context files.
// It defaults to DEFAULT_CONTEXT_FILENAME but can be overridden by setGeminiMdFilename.
let currentGeminiMdFilename: string | string[] = DEFAULT_CONTEXT_FILENAME;

/**
 * Sets the current Gemini MD filename(s).
 */
export function setGeminiMdFilename(newFilename: string | string[]): void {
  if (Array.isArray(newFilename)) {
    if (newFilename.length > 0) {
      currentGeminiMdFilename = newFilename.map((name) => name.trim());
    }
  } else if (newFilename && newFilename.trim() !== '') {
    currentGeminiMdFilename = newFilename.trim();
  }
}

/**
 * Gets the primary Gemini MD filename.
 */
export function getCurrentGeminiMdFilename(): string {
  if (Array.isArray(currentGeminiMdFilename)) {
    return currentGeminiMdFilename[0];
  }
  return currentGeminiMdFilename;
}

/**
 * Gets all configured Gemini MD filenames.
 */
export function getAllGeminiMdFilenames(): string[] {
  if (Array.isArray(currentGeminiMdFilename)) {
    return currentGeminiMdFilename;
  }
  return [currentGeminiMdFilename];
}

/**
 * Gets the global memory file path.
 */
export function getGlobalMemoryFilePath(): string {
  return path.join(Storage.getGlobalGeminiDir(), getCurrentGeminiMdFilename());
}

export interface HierarchicalMemory {
  global?: string;
  extension?: string;
  project?: string;
}

/**
 * Flattens hierarchical memory into a single string for display or legacy use.
 */
export function flattenMemory(memory?: string | HierarchicalMemory): string {
  if (!memory) return '';
  if (typeof memory === 'string') return memory;

  const sections: Array<{ name: string; content: string }> = [];
  if (memory.global?.trim()) {
    sections.push({ name: 'Global', content: memory.global.trim() });
  }
  if (memory.extension?.trim()) {
    sections.push({ name: 'Extension', content: memory.extension.trim() });
  }
  if (memory.project?.trim()) {
    sections.push({ name: 'Project', content: memory.project.trim() });
  }

  if (sections.length === 0) return '';

  return sections.map((s) => `--- ${s.name} ---\n${s.content}`).join('\n\n');
}

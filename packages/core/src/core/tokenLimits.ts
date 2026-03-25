/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 192_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 32_768; // 32k

/**
 * Runtime context window overrides (set from settings).
 * This allows user-configured context windows to take precedence.
 */
let runtimeContextWindowOverrides: Map<string, number> = new Map();

/**
 * Set a runtime context window override for a model.
 */
export function setRuntimeContextWindow(model: string, contextWindow: number): void {
  runtimeContextWindowOverrides.set(model, contextWindow);
}

/**
 * Clear a runtime context window override for a model.
 */
export function clearRuntimeContextWindow(model: string): void {
  runtimeContextWindowOverrides.delete(model);
}

/**
 * Get the token limit (context window) for a model.
 * Priority: runtime override (from settings) > default
 */
export function tokenLimit(model: Model): TokenCount {
  // Check runtime override first (from settings)
  const runtimeOverride = runtimeContextWindowOverrides.get(model);
  if (runtimeOverride !== undefined) {
    return runtimeOverride;
  }
  return DEFAULT_TOKEN_LIMIT;
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified fallback handler for OpenAI-based API.
 * Since we don't have complex availability logic anymore,
 * this just handles basic error cases.
 */

import type { Config } from '../config/config.js';
import { debugLogger } from '../utils/debugLogger.js';

export async function handleFallback(
  config: Config,
  _failedModel: string,
  _authType?: string,
  error?: unknown,
): Promise<string | boolean | null> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  debugLogger.warn(`API error occurred: ${errorMessage}`);

  // With OpenAI-based API, we don't have automatic fallback.
  // Just return null to indicate no fallback is available.
  return null;
}

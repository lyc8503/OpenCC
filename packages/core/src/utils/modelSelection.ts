/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified model selection utilities.
 * Always uses the user's currently active model for all operations.
 */

import type { Config } from '../config/config.js';
import type { ModelConfigKey } from '../services/modelConfigService.js';
import type { GenerateContentConfig } from '@google/genai';
import { resolveModel } from '../config/models.js';

/**
 * Result of model selection.
 */
export interface ModelSelectionResult {
  model: string;
  config: GenerateContentConfig;
  maxAttempts?: number;
}

/**
 * Model selection that always uses the user's currently active model.
 * All utility tools (classifier, summarizer, etc.) now use the same model
 * as the main chat model.
 */
export function applyModelSelection(
  config: Config,
  _modelConfigKey: ModelConfigKey,
  _options?: { consumeAttempt?: boolean },
): ModelSelectionResult {
  // Always use the user's currently active model
  const activeModel = config.getActiveModel();

  const { generateContentConfig } =
    config.modelConfigService.getResolvedConfig({ model: activeModel });

  return {
    model: resolveModel(activeModel),
    config: generateContentConfig,
    maxAttempts: config.getMaxAttempts(),
  };
}

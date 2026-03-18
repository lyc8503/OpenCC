/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified model selection utilities.
 * Replaces the complex availability-based model selection with a simple approach
 * where users directly specify their model.
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
 * Simple model selection that just uses the configured model.
 * No availability checks or fallbacks - the user specifies the model directly.
 */
export function applyModelSelection(
  config: Config,
  modelConfigKey: ModelConfigKey,
  _options?: { consumeAttempt?: boolean },
): ModelSelectionResult {
  const { model, generateContentConfig } =
    config.modelConfigService.getResolvedConfig(modelConfigKey);

  return {
    model: resolveModel(model),
    config: generateContentConfig,
    maxAttempts: config.getMaxAttempts(),
  };
}

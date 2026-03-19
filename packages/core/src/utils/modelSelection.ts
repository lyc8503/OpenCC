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
 * Maps utility model aliases to their OpenAI equivalents.
 * When using OpenAI backend, these aliases are used instead of Gemini-specific ones.
 */
const OPENAI_MODEL_ALIAS_MAP: Record<string, string> = {
  'classifier': 'openai-classifier',
  'llm-edit-fixer': 'openai-llm-edit-fixer',
  'next-speaker-checker': 'openai-next-speaker-checker',
  'loop-detection': 'openai-loop-detection',
  'loop-detection-double-check': 'openai-loop-detection-double-check',
  'web-search': 'openai-web-search',
  'web-fetch': 'openai-web-fetch',
  'web-fetch-fallback': 'openai-web-fetch-fallback',
  'prompt-completion': 'openai-prompt-completion',
  'fast-ack-helper': 'openai-fast-ack-helper',
  'edit-corrector': 'openai-edit-corrector',
  'summarizer-default': 'openai-summarizer-default',
  'summarizer-shell': 'openai-summarizer-shell',
};

/**
 * Checks if the active model is an OpenAI model.
 */
function isOpenAIModel(activeModel: string): boolean {
  return !activeModel.startsWith('gemini-');
}

/**
 * Converts a model alias to its OpenAI equivalent if using OpenAI backend.
 */
function getAliasForBackend(modelAlias: string, activeModel: string): string {
  if (isOpenAIModel(activeModel) && OPENAI_MODEL_ALIAS_MAP[modelAlias]) {
    return OPENAI_MODEL_ALIAS_MAP[modelAlias];
  }
  return modelAlias;
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
  // Get the active model to determine which backend we're using
  const activeModel = config.getActiveModel();

  // Convert the model alias if needed for OpenAI backend
  const resolvedModelKey: ModelConfigKey = {
    ...modelConfigKey,
    model: getAliasForBackend(modelConfigKey.model, activeModel),
  };

  const { model, generateContentConfig } =
    config.modelConfigService.getResolvedConfig(resolvedModelKey);

  return {
    model: resolveModel(model),
    config: generateContentConfig,
    maxAttempts: config.getMaxAttempts(),
  };
}

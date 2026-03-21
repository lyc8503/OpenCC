/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenAI and Claude model definitions.
 * Supports OpenAI API compatible endpoints.
 */

// OpenAI Models
export const GPT_4_MODEL = 'gpt-4';
export const GPT_4_TURBO_MODEL = 'gpt-4-turbo';
export const GPT_4O_MODEL = 'gpt-4o';
export const GPT_4O_MINI_MODEL = 'gpt-4o-mini';
export const GPT_35_TURBO_MODEL = 'gpt-3.5-turbo';
export const O1_MODEL = 'o1';
export const O1_MINI_MODEL = 'o1-mini';
export const O1_PREVIEW_MODEL = 'o1-preview';

// Claude Models (via OpenAI-compatible endpoint)
export const CLAUDE_OPUS_4_MODEL = 'claude-opus-4-6';
export const CLAUDE_SONNET_4_MODEL = 'claude-sonnet-4-6';
export const CLAUDE_HAIKU_4_MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_35_SONNET_MODEL = 'claude-3-5-sonnet-20241022';

// Default models
export const DEFAULT_MODEL = GPT_4O_MODEL;
export const DEFAULT_FAST_MODEL = GPT_4O_MINI_MODEL;

// Model aliases
export const MODEL_ALIAS_AUTO = 'auto';
export const MODEL_ALIAS_PRO = 'pro';
export const MODEL_ALIAS_FAST = 'fast';

// Valid models set
export const VALID_MODELS = new Set([
  // OpenAI
  GPT_4_MODEL,
  GPT_4_TURBO_MODEL,
  GPT_4O_MODEL,
  GPT_4O_MINI_MODEL,
  GPT_35_TURBO_MODEL,
  O1_MODEL,
  O1_MINI_MODEL,
  O1_PREVIEW_MODEL,
  // Claude
  CLAUDE_OPUS_4_MODEL,
  CLAUDE_SONNET_4_MODEL,
  CLAUDE_HAIKU_4_MODEL,
  CLAUDE_35_SONNET_MODEL,
]);

/**
 * Model tier configuration.
 */
export interface ModelTierConfig {
  id: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
}

/**
 * Available model configurations.
 */
export const MODEL_CONFIGS: Record<string, ModelTierConfig> = {
  // OpenAI Models
  [GPT_4O_MODEL]: {
    id: GPT_4O_MODEL,
    displayName: 'GPT-4o',
    description:
      'Most capable GPT-4 model, optimized for speed and intelligence',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  [GPT_4O_MINI_MODEL]: {
    id: GPT_4O_MINI_MODEL,
    displayName: 'GPT-4o Mini',
    description: 'Fast and affordable model for simple tasks',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  [GPT_4_TURBO_MODEL]: {
    id: GPT_4_TURBO_MODEL,
    displayName: 'GPT-4 Turbo',
    description: 'Previous generation GPT-4 with vision support',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  [GPT_4_MODEL]: {
    id: GPT_4_MODEL,
    displayName: 'GPT-4',
    description: 'Standard GPT-4 model',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
  },
  [GPT_35_TURBO_MODEL]: {
    id: GPT_35_TURBO_MODEL,
    displayName: 'GPT-3.5 Turbo',
    description: 'Fast and affordable for simple tasks',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
  },
  [O1_MODEL]: {
    id: O1_MODEL,
    displayName: 'o1',
    description: 'Advanced reasoning model',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
  },
  [O1_MINI_MODEL]: {
    id: O1_MINI_MODEL,
    displayName: 'o1-mini',
    description: 'Fast reasoning model for coding tasks',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
  },

  // Claude Models
  [CLAUDE_OPUS_4_MODEL]: {
    id: CLAUDE_OPUS_4_MODEL,
    displayName: 'Claude Opus 4.6',
    description: 'Most capable Claude model for complex tasks',
    contextWindow: 200000,
    maxOutputTokens: 32000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
  },
  [CLAUDE_SONNET_4_MODEL]: {
    id: CLAUDE_SONNET_4_MODEL,
    displayName: 'Claude Sonnet 4.6',
    description: 'Balanced performance and cost',
    contextWindow: 200000,
    maxOutputTokens: 16000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
  },
  [CLAUDE_HAIKU_4_MODEL]: {
    id: CLAUDE_HAIKU_4_MODEL,
    displayName: 'Claude Haiku 4.5',
    description: 'Fast and efficient for simple tasks',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  [CLAUDE_35_SONNET_MODEL]: {
    id: CLAUDE_35_SONNET_MODEL,
    displayName: 'Claude 3.5 Sonnet',
    description: 'Previous generation Claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
};

/**
 * Resolves a model alias to a concrete model name.
 */
export function resolveModel(requestedModel: string): string {
  switch (requestedModel.toLowerCase()) {
    case MODEL_ALIAS_AUTO:
    case MODEL_ALIAS_PRO:
      return DEFAULT_MODEL;
    case MODEL_ALIAS_FAST:
      return DEFAULT_FAST_MODEL;
    default:
      return requestedModel;
  }
}

/**
 * Gets the display name for a model.
 */
export function getModelDisplayName(model: string): string {
  const config = MODEL_CONFIGS[model];
  if (config) {
    return config.displayName;
  }
  return model;
}

/**
 * Gets the model configuration.
 */
export function getModelConfig(model: string): ModelTierConfig | undefined {
  return MODEL_CONFIGS[model];
}

/**
 * Checks if a model is valid.
 * Always returns true to allow any model name.
 */
export function isValidModel(_model: string): boolean {
  return true;
}

/**
 * Checks if a model supports vision.
 */
export function supportsVision(model: string): boolean {
  const config = MODEL_CONFIGS[model];
  return config?.supportsVision ?? false;
}

/**
 * Checks if a model supports tools.
 */
export function supportsTools(model: string): boolean {
  const config = MODEL_CONFIGS[model];
  return config?.supportsTools ?? true;
}

/**
 * Checks if a model supports streaming.
 */
export function supportsStreaming(model: string): boolean {
  const config = MODEL_CONFIGS[model];
  return config?.supportsStreaming ?? true;
}

/**
 * Checks if a model is an OpenAI model.
 */
export function isOpenAIModel(model: string): boolean {
  return model.startsWith('gpt-') || model.startsWith('o1');
}

/**
 * Checks if a model is a Claude model.
 */
export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-');
}

/**
 * Checks if a model supports thinking/reasoning.
 */
export function supportsThinking(model: string): boolean {
  const config = MODEL_CONFIGS[model];
  return config?.supportsThinking ?? false;
}

/**
 * Gets the context window override from environment variable.
 * Environment variable format: CONTEXT_WINDOW_{MODEL_NAME}
 * Example: CONTEXT_WINDOW_GPT_4O=200000
 */
function getContextWindowFromEnv(model: string): number | undefined {
  const envKey = `CONTEXT_WINDOW_${model.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const val = process.env[envKey];
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Gets the context window for a model.
 * Environment variable takes precedence over config (e.g., CONTEXT_WINDOW_GPT_4O=200000).
 */
export function getContextWindow(model: string): number {
  const envOverride = getContextWindowFromEnv(model);
  if (envOverride !== undefined) {
    return envOverride;
  }
  const config = MODEL_CONFIGS[model];
  return config?.contextWindow ?? 128000;
}

/**
 * Gets the max output tokens override from environment variable.
 * Environment variable format: MAX_OUTPUT_TOKENS_{MODEL_NAME}
 * Example: MAX_OUTPUT_TOKENS_GPT_4O=32000
 */
function getMaxOutputTokensFromEnv(model: string): number | undefined {
  const envKey = `MAX_OUTPUT_TOKENS_${model.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const val = process.env[envKey];
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Gets the max output tokens for a model.
 * Environment variable takes precedence over config.
 */
export function getMaxOutputTokens(model: string): number {
  const envOverride = getMaxOutputTokensFromEnv(model);
  if (envOverride !== undefined) {
    return envOverride;
  }
  const config = MODEL_CONFIGS[model];
  return config?.maxOutputTokens ?? 8192;
}

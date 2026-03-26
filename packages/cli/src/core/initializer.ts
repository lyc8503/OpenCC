/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IdeClient,
  IdeConnectionEvent,
  IdeConnectionType,
  logIdeConnection,
  type Config,
  StartSessionEvent,
  logCliConfiguration,
  startupProfiler,
  setRuntimeContextWindow,
  DEFAULT_TOKEN_LIMIT,
  DEFAULT_MAX_OUTPUT_TOKENS,
  debugLogger,
  AuthType,
} from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import { performInitialAuth } from './auth.js';
import { validateTheme } from './theme.js';

export interface InitializationResult {
  authError: string | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
  geminiMdFileCount: number;
}

/**
 * Orchestrates the application's startup initialization.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @returns The results of the initialization.
 */
export async function initializeApp(
  config: Config,
  settings: LoadedSettings,
): Promise<InitializationResult> {
  let authType = settings.merged.security.auth.selectedType;
  
  // Auto-detect: if API key is configured but authType is not set, use API key auth
  if (!authType) {
    const hasApiKey =
      process.env['OPENAI_API_KEY'] ||
      settings.merged.model?.openaiApiKey;
    
    if (hasApiKey) {
      authType = AuthType.USE_API_KEY;
      debugLogger.log('Auto-detected API key, using USE_API_KEY auth');
    }
  }
  
  const authHandle = startupProfiler.start('authenticate');
  const { authError } = await performInitialAuth(config, authType);
  authHandle?.end();
  const themeError = validateTheme(settings);

  // Apply runtime model configuration from settings
  const modelName = settings.merged.model?.name;
  const contextWindow = settings.merged.model?.contextWindow ?? DEFAULT_TOKEN_LIMIT;
  const maxOutputTokens = settings.merged.model?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  // Set context window
  const model = modelName || config.getModel();
  setRuntimeContextWindow(model, contextWindow);
  debugLogger.log('Context window set:', contextWindow, 'for model:', model);

  // Register max output tokens override
  config.modelConfigService.registerRuntimeModelOverride({
    match: { model },
    modelConfig: {
      generateContentConfig: {
        maxOutputTokens,
      },
    },
  });
  debugLogger.log('Max output tokens set:', maxOutputTokens, 'for model:', model);

  const shouldOpenAuthDialog =
    (authType === undefined) || !!authError;

  logCliConfiguration(
    config,
    new StartSessionEvent(config, config.getToolRegistry()),
  );

  if (config.getIdeMode()) {
    const ideClient = await IdeClient.getInstance();
    await ideClient.connect();
    logIdeConnection(config, new IdeConnectionEvent(IdeConnectionType.START));
  }

  return {
    authError,
    themeError,
    shouldOpenAuthDialog,
    geminiMdFileCount: config.getGeminiMdFileCount(),
  };
}

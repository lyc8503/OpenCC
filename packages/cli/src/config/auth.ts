/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  const settings = loadSettings();
  loadEnvironment(settings.merged, process.cwd());

  if (authMethod === AuthType.USE_API_KEY) {
    // Check environment variables first, then settings
    const hasApiKey =
      process.env['OPENAI_API_KEY'] ||
      settings.merged.model?.openaiApiKey;

    if (!hasApiKey) {
      return (
        'When using API key, you must specify the OPENAI_API_KEY environment variable, ' +
        'or configure the API key in the model settings (via /model command).\n' +
        'Update your environment or settings and try again!'
      );
    }
    return null;
  }

  return 'Invalid auth method selected.';
}

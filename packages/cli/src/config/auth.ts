/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  loadEnvironment(loadSettings().merged, process.cwd());

  if (authMethod === AuthType.USE_API_KEY) {
    if (!process.env['OPENAI_API_KEY'] && !process.env['GEMINI_API_KEY']) {
      return (
        'When using API key, you must specify the OPENAI_API_KEY or GEMINI_API_KEY environment variable.\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  return 'Invalid auth method selected.';
}

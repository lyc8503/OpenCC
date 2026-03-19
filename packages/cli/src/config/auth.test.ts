/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAuthMethod } from './auth.js';

vi.mock('./settings.js', () => ({
  loadEnvironment: vi.fn(),
  loadSettings: vi.fn().mockReturnValue({
    merged: vi.fn().mockReturnValue({}),
  }),
}));

describe('validateAuthMethod', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', undefined);
    vi.stubEnv('GEMINI_API_KEY', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      description:
        'should return null for USE_API_KEY if OPENAI_API_KEY is set',
      authType: AuthType.USE_API_KEY,
      envs: { OPENAI_API_KEY: 'test-key' },
      expected: null,
    },
    {
      description:
        'should return null for USE_API_KEY if GEMINI_API_KEY is set',
      authType: AuthType.USE_API_KEY,
      envs: { GEMINI_API_KEY: 'test-key' },
      expected: null,
    },
    {
      description:
        'should return an error message for USE_API_KEY if no API key is set',
      authType: AuthType.USE_API_KEY,
      envs: {},
      expected:
        'When using API key, you must specify the OPENAI_API_KEY or GEMINI_API_KEY environment variable.\n' +
        'Update your environment and try again (no reload needed if using .env)!',
    },
    {
      description: 'should return an error message for an invalid auth method',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authType: 'invalid-method' as any,
      envs: {},
      expected: 'Invalid auth method selected.',
    },
  ])('$description', ({ authType, envs, expected }) => {
    for (const [key, value] of Object.entries(envs)) {
      vi.stubEnv(key, value as string);
    }
    expect(validateAuthMethod(authType)).toBe(expected);
  });
});
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { tokenLimit, DEFAULT_TOKEN_LIMIT } from './tokenLimits.js';

describe('tokenLimit', () => {
  it('should return the correct token limit for default models', () => {
    // OpenAI-compatible API uses a default context window
    expect(tokenLimit('gpt-4o')).toBe(DEFAULT_TOKEN_LIMIT);
    expect(tokenLimit('gpt-4-turbo')).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should return the correct token limit for preview models', () => {
    expect(tokenLimit('gpt-4o-preview')).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should return the default token limit for an unknown model', () => {
    expect(tokenLimit('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should return the default token limit if no model is provided', () => {
    // @ts-expect-error testing invalid input
    expect(tokenLimit(undefined)).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should have the correct default token limit value', () => {
    // Default token limit for OpenAI-compatible API
    expect(DEFAULT_TOKEN_LIMIT).toBe(192_000);
  });
});

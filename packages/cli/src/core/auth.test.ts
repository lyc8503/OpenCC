/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performInitialAuth } from './auth.js';
import { type Config, ValidationRequiredError } from '@google/gemini-cli-core';

describe('auth', () => {
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      refreshAuth: vi.fn(),
    } as unknown as Config;
  });

  it('should return null if authType is undefined', async () => {
    const result = await performInitialAuth(mockConfig, undefined);
    expect(result).toEqual({ authError: null });
    expect(mockConfig.refreshAuth).not.toHaveBeenCalled();
  });

  it('should return null on successful auth', async () => {
    const result = await performInitialAuth(mockConfig, 'api-key');
    expect(result).toEqual({ authError: null });
    expect(mockConfig.refreshAuth).toHaveBeenCalledWith('api-key');
  });

  it('should return error message on failed auth', async () => {
    const error = new Error('Authentication failed');
    vi.mocked(mockConfig.refreshAuth).mockRejectedValue(error);
    const result = await performInitialAuth(mockConfig, 'api-key');
    expect(result).toEqual({
      authError: 'Failed to sign in. Message: Authentication failed',
    });
    expect(mockConfig.refreshAuth).toHaveBeenCalledWith('api-key');
  });

  it('should return null if refreshAuth throws ValidationRequiredError', async () => {
    vi.mocked(mockConfig.refreshAuth).mockRejectedValue(
      new ValidationRequiredError('Validation required'),
    );
    const result = await performInitialAuth(mockConfig, 'api-key');
    expect(result).toEqual({ authError: null });
    expect(mockConfig.refreshAuth).toHaveBeenCalledWith('api-key');
  });
});
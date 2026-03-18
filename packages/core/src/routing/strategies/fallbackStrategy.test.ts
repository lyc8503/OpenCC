/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackStrategy } from './fallbackStrategy.js';
import type { RoutingContext } from '../routingStrategy.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import type { Config } from '../../config/config.js';
import type { LocalLiteRtLmClient } from '../../core/localLiteRtLmClient.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
} from '../../config/models.js';

const createMockConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    getModel: vi.fn().mockReturnValue(DEFAULT_GEMINI_MODEL),
    getGemini31LaunchedSync: vi.fn().mockReturnValue(false),
    ...overrides,
  }) as unknown as Config;

describe('FallbackStrategy', () => {
  const strategy = new FallbackStrategy();
  const mockContext = {} as RoutingContext;
  const mockClient = {} as BaseLlmClient;
  const mockLocalLiteRtLmClient = {} as LocalLiteRtLmClient;
  let mockConfig: Config;

  beforeEach(() => {
    vi.resetAllMocks();
    mockConfig = createMockConfig();
  });

  it('should return the configured model directly (simplified for OpenAI API)', async () => {
    const decision = await strategy.route(
      mockContext,
      mockConfig,
      mockClient,
      mockLocalLiteRtLmClient,
    );
    // With availability service removed, fallback strategy just returns the configured model
    expect(decision).not.toBeNull();
    expect(decision?.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(decision?.metadata.source).toBe('fallback');
    expect(decision?.metadata.reasoning).toContain('Using configured model');
  });

  it('should use requestedModel from context if provided', async () => {
    const requestedModel = 'custom-model';
    const contextWithRequestedModel = {
      requestedModel,
    } as RoutingContext;

    const decision = await strategy.route(
      contextWithRequestedModel,
      mockConfig,
      mockClient,
      mockLocalLiteRtLmClient,
    );

    expect(decision).not.toBeNull();
    expect(decision?.model).toBe(requestedModel);
  });
});

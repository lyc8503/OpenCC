/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockInstance,
  afterEach,
} from 'vitest';
import { handleFallback } from './handler.js';
import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';

// Mock the telemetry logger and event class
vi.mock('../telemetry/index.js', () => ({
  logFlashFallback: vi.fn(),
  FlashFallbackEvent: class {},
}));

// Mock debugLogger to prevent console pollution and allow spying
vi.mock('../utils/debugLogger.js', () => ({
  debugLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

const MOCK_MODEL = 'test-model';

const createMockConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    fallbackHandler: undefined,
    getFallbackModelHandler: vi.fn(),
    setActiveModel: vi.fn(),
    setModel: vi.fn(),
    activateFallbackMode: vi.fn(),
    getActiveModel: vi.fn(() => MOCK_MODEL),
    getModel: vi.fn(() => MOCK_MODEL),
    getUserTier: vi.fn(() => undefined),
    isInteractive: vi.fn(() => false),
    ...overrides,
  }) as unknown as Config;

describe('handleFallback', () => {
  let mockConfig: Config;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = createMockConfig();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('simplified fallback behavior', () => {
    it('returns null for API key auth type', async () => {
      const result = await handleFallback(
        mockConfig,
        MOCK_MODEL,
        AuthType.USE_API_KEY,
      );

      expect(result).toBeNull();
    });

    it('returns null when error is passed', async () => {
      const error = new Error('API error');

      const result = await handleFallback(
        mockConfig,
        MOCK_MODEL,
        AuthType.USE_API_KEY,
        error,
      );

      expect(result).toBeNull();
    });

    it('returns null when no auth type is provided', async () => {
      const result = await handleFallback(mockConfig, MOCK_MODEL);

      expect(result).toBeNull();
    });

    it('returns null when error object is passed', async () => {
      const error = { message: 'Custom error', code: 500 };

      const result = await handleFallback(
        mockConfig,
        MOCK_MODEL,
        AuthType.USE_API_KEY,
        error,
      );

      expect(result).toBeNull();
    });
  });
});

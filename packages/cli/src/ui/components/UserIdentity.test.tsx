/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../test-utils/render.js';
import { UserIdentity } from './UserIdentity.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeFakeConfig,
  AuthType,
  type ContentGeneratorConfig,
} from '@google/gemini-cli-core';

describe('<UserIdentity />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render prompt to use /model if authType is missing', async () => {
    const mockConfig = makeFakeConfig();
    vi.spyOn(mockConfig, 'getContentGeneratorConfig').mockReturnValue(
      {} as unknown as ContentGeneratorConfig,
    );

    const { lastFrame, waitUntilReady, unmount } = renderWithProviders(
      <UserIdentity config={mockConfig} />,
    );
    await waitUntilReady();

    const output = lastFrame();
    expect(output).toContain('No API key configured');
    expect(output).toContain('/model');
    unmount();
  });

  it('should render API key indicator with model', async () => {
    const mockConfig = makeFakeConfig();
    vi.spyOn(mockConfig, 'getContentGeneratorConfig').mockReturnValue({
      authType: AuthType.USE_API_KEY,
    } as unknown as ContentGeneratorConfig);
    vi.spyOn(mockConfig, 'getModel').mockReturnValue('gpt-4o');

    const { lastFrame, waitUntilReady, unmount } = renderWithProviders(
      <UserIdentity config={mockConfig} />,
    );
    await waitUntilReady();

    const output = lastFrame();
    expect(output).toContain('✓ API Key');
    expect(output).toContain('Model: gpt-4o');
    unmount();
  });

  it('should render API key indicator with base URL', async () => {
    const mockConfig = makeFakeConfig();
    vi.spyOn(mockConfig, 'getContentGeneratorConfig').mockReturnValue({
      authType: AuthType.USE_API_KEY,
      baseUrl: 'https://api.example.com/v1',
    } as unknown as ContentGeneratorConfig);
    vi.spyOn(mockConfig, 'getModel').mockReturnValue('gpt-4o');

    const { lastFrame, waitUntilReady, unmount } = renderWithProviders(
      <UserIdentity config={mockConfig} />,
    );
    await waitUntilReady();

    const output = lastFrame();
    expect(output).toContain('✓ API Key');
    expect(output).toContain('https://api.example.com/v1');
    expect(output).toContain('Model: gpt-4o');
    unmount();
  });

  it('should render API key indicator without model if not set', async () => {
    const mockConfig = makeFakeConfig();
    vi.spyOn(mockConfig, 'getContentGeneratorConfig').mockReturnValue({
      authType: AuthType.USE_API_KEY,
    } as unknown as ContentGeneratorConfig);
    vi.spyOn(mockConfig, 'getModel').mockReturnValue('');

    const { lastFrame, waitUntilReady, unmount } = renderWithProviders(
      <UserIdentity config={mockConfig} />,
    );
    await waitUntilReady();

    const output = lastFrame();
    expect(output).toContain('✓ API Key');
    expect(output).not.toContain('Model:');
    unmount();
  });
});

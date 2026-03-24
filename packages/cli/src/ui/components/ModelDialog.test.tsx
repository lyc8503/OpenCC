/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { ModelDialog } from './ModelDialog.js';
import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '../../test-utils/async.js';
import { createMockSettings } from '../../test-utils/settings.js';
import {
  DEFAULT_MODEL,
  GPT_4O_MODEL,
  GPT_4O_MINI_MODEL,
  AuthType,
} from '@google/gemini-cli-core';
import type { Config } from '@google/gemini-cli-core';

// Mock dependencies
const mockGetContextWindow = vi.fn();
const mockGetMaxOutputTokens = vi.fn();

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    getContextWindow: (model: string) => mockGetContextWindow(model),
    getMaxOutputTokens: (model: string) => mockGetMaxOutputTokens(model),
  };
});

describe('<ModelDialog />', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetContextWindow.mockReturnValue(128000);
    mockGetMaxOutputTokens.mockReturnValue(16384);
  });

  const renderComponent = async (
    settingsOverrides = {},
    availableTerminalHeight?: number,
  ) => {
    const settings = createMockSettings(settingsOverrides);

    const result = renderWithProviders(
      <ModelDialog
        settings={settings}
        onClose={mockOnClose}
        onSave={mockOnSave}
        availableTerminalHeight={availableTerminalHeight}
      />,
    );
    await result.waitUntilReady();
    return result;
  };

  it('renders the model configuration dialog correctly', async () => {
    const { lastFrame, unmount } = await renderComponent();
    expect(lastFrame()).toContain('Model Configuration');
    expect(lastFrame()).toContain('Model Name');
    expect(lastFrame()).toContain('OpenAI Base URL');
    expect(lastFrame()).toContain('OpenAI API Key');
    expect(lastFrame()).toContain('Context Window');
    expect(lastFrame()).toContain('Max Output Tokens');
    unmount();
  });

  it('displays default model name when not set', async () => {
    const { lastFrame, unmount } = await renderComponent();
    expect(lastFrame()).toContain(DEFAULT_MODEL);
    unmount();
  });

  it('displays custom model name when set', async () => {
    const { lastFrame, unmount } = await renderComponent({
      model: { name: GPT_4O_MINI_MODEL },
    });
    expect(lastFrame()).toContain(GPT_4O_MINI_MODEL);
    unmount();
  });

  it('displays context window and max output tokens from model config', async () => {
    mockGetContextWindow.mockReturnValue(200000);
    mockGetMaxOutputTokens.mockReturnValue(32000);

    const { lastFrame, unmount } = await renderComponent();
    expect(lastFrame()).toContain('200000');
    expect(lastFrame()).toContain('32000');
    unmount();
  });

  it('displays API key with masking', async () => {
    const { lastFrame, unmount } = await renderComponent({
      openai: { apiKey: 'sk-test-api-key-12345' },
    });

    expect(lastFrame()).toContain('sk-test-a...');
    expect(lastFrame()).not.toContain('sk-test-api-key-12345');
    unmount();
  });

  it('displays base URL when set', async () => {
    const { lastFrame, unmount } = await renderComponent({
      openai: { baseUrl: 'https://api.custom-openai.com/v1' },
    });

    expect(lastFrame()).toContain('https://api.custom-openai.com/v1');
    unmount();
  });

  it('shows scope selector with User and Workspace options', async () => {
    const { lastFrame, unmount } = await renderComponent();
    expect(lastFrame()).toContain('Apply To');
    expect(lastFrame()).toContain('User');
    expect(lastFrame()).toContain('Workspace');
    unmount();
  });

  it('closes dialog on escape', async () => {
    const { stdin, waitUntilReady, unmount } = await renderComponent();

    await act(async () => {
      stdin.write('\u001B'); // Escape
    });
    await act(async () => {
      await waitUntilReady();
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
    unmount();
  });

  it('allows editing model name field', async () => {
    const { stdin, waitUntilReady, unmount } = await renderComponent();

    // Press Enter on first item (Model Name) to start editing
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    // Type new model name
    await act(async () => {
      stdin.write('gpt-4-turbo');
    });
    await waitUntilReady();

    // Press Enter to commit
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
    unmount();
  });

  it('allows editing API key field', async () => {
    const { stdin, waitUntilReady, unmount } = await renderComponent();

    // Navigate to API key field (third item)
    await act(async () => {
      stdin.write('\u001B[B'); // Arrow Down
    });
    await waitUntilReady();
    await act(async () => {
      stdin.write('\u001B[B'); // Arrow Down
    });
    await waitUntilReady();

    // Press Enter to start editing
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    // Type API key
    await act(async () => {
      stdin.write('sk-new-api-key');
    });
    await waitUntilReady();

    // Press Enter to commit
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
    unmount();
  });

  it('allows editing context window field', async () => {
    const { stdin, waitUntilReady, unmount } = await renderComponent();

    // Navigate to Context Window field (fourth item)
    await act(async () => {
      stdin.write('\u001B[B'); // Arrow Down
    });
    await waitUntilReady();
    await act(async () => {
      stdin.write('\u001B[B'); // Arrow Down
    });
    await waitUntilReady();
    await act(async () => {
      stdin.write('\u001B[B'); // Arrow Down
    });
    await waitUntilReady();

    // Press Enter to start editing
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    // Type new value
    await act(async () => {
      stdin.write('200000');
    });
    await waitUntilReady();

    // Press Enter to commit
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
    unmount();
  });

  it('shows modified indicator on edited fields', async () => {
    const { lastFrame, stdin, waitUntilReady, unmount } =
      await renderComponent();

    // Press Enter on first item (Model Name) to start editing
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    // Type new model name
    await act(async () => {
      stdin.write('claude-opus-4-6');
    });
    await waitUntilReady();

    // Press Enter to commit
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    await waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('claude-opus-4-6*');
    });
    unmount();
  });

  it('shows footer message when fields are modified', async () => {
    const { lastFrame, stdin, waitUntilReady, unmount } =
      await renderComponent();

    // Press Enter on first item to start editing
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    // Type new model name
    await act(async () => {
      stdin.write('gpt-4o-mini');
    });
    await waitUntilReady();

    // Press Enter to commit
    await act(async () => {
      stdin.write('');
    });
    await waitUntilReady();

    await waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('Changes saved automatically');
      expect(frame).toContain('OPENAI_API_KEY env var');
    });
    unmount();
  });

  it('adapts layout based on available terminal height', async () => {
    // Small terminal height - should hide scope selector if needed
    const { lastFrame: smallFrame, unmount: smallUnmount } =
      await renderComponent({}, 15);
    expect(smallFrame()).toContain('Model Configuration');
    smallUnmount();

    // Large terminal height - should show scope selector
    const { lastFrame: largeFrame, unmount: largeUnmount } =
      await renderComponent({}, 40);
    expect(largeFrame()).toContain('Apply To');
    largeUnmount();
  });

  it('has the correct title and description for each field', async () => {
    const { lastFrame, unmount } = await renderComponent();
    const frame = lastFrame();

    expect(frame).toContain('Model Name');
    expect(frame).toContain('The AI model to use for conversations');

    expect(frame).toContain('OpenAI Base URL');
    expect(frame).toContain('Custom API endpoint (optional, for proxies)');

    expect(frame).toContain('OpenAI API Key');
    expect(frame).toContain('API key (use env OPENAI_API_KEY or set here)');

    expect(frame).toContain('Context Window');
    expect(frame).toContain('Maximum context window size in tokens');

    expect(frame).toContain('Max Output Tokens');
    expect(frame).toContain('Maximum output tokens per response');

    unmount();
  });
});
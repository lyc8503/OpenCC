/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { countTokensForOpenAI, type OpenAIMessage, type OpenAITool } from './openaiClient.js';

describe('openaiClient token counting', () => {
  it('counts simple text messages with message overhead', async () => {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello world' },
    ];

    const result = await countTokensForOpenAI(messages, 'gpt-4o');

    expect(result.prompt_tokens).toBeGreaterThan(0);
    // Should be more than naive text-only estimate because of message framing overhead
    expect(result.prompt_tokens).toBeGreaterThan(Math.ceil(('You are helpful.'.length + 'Hello world'.length) / 4));
  });

  it('counts tool calls in assistant messages', async () => {
    const messages: OpenAIMessage[] = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"city":"Tokyo"}',
            },
          },
        ],
      },
    ];

    const result = await countTokensForOpenAI(messages, 'gpt-4o');

    expect(result.prompt_tokens).toBeGreaterThan(5);
  });

  it('counts tool schemas in prompt tokens', async () => {
    const messages: OpenAIMessage[] = [
      { role: 'user', content: 'What is the weather?' },
    ];
    const tools: OpenAITool[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
        },
      },
    ];

    const withoutTools = await countTokensForOpenAI(messages, 'gpt-4o');
    const withTools = await countTokensForOpenAI(messages, 'gpt-4o', tools);

    expect(withTools.prompt_tokens).toBeGreaterThan(withoutTools.prompt_tokens);
  });

  it('counts multimodal image content using media heuristic', async () => {
    const messages: OpenAIMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,ZmFrZQ==',
            },
          },
        ],
      },
    ];

    const result = await countTokensForOpenAI(messages, 'gpt-4o');

    expect(result.prompt_tokens).toBeGreaterThan(3000);
  });

  it('counts tool response messages with tool_call_id overhead', async () => {
    const messages: OpenAIMessage[] = [
      {
        role: 'tool',
        tool_call_id: 'call_123',
        content: '{"temperature":25,"condition":"sunny"}',
      },
    ];

    const result = await countTokensForOpenAI(messages, 'gpt-4o');

    expect(result.prompt_tokens).toBeGreaterThan(10);
  });
});

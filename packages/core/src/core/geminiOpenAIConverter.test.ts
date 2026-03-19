/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  convertGeminiToOpenAI,
  convertOpenAIToGemini,
  convertStreamChunkToGemini,
} from './geminiOpenAIConverter.js';
import type { OpenAIChatResponse, OpenAIStreamChunk } from './openaiClient.js';
import { FinishReason, type GenerateContentParameters } from '@google/genai';

describe('geminiOpenAIConverter', () => {
  describe('convertGeminiToOpenAI', () => {
    it('converts basic text content', () => {
      const params: GenerateContentParameters = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.params.messages).toHaveLength(1);
      expect(result.params.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
      expect(result.abortSignal).toBeUndefined();
    });

    it('converts system instruction', () => {
      const params: GenerateContentParameters = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: {
          systemInstruction: 'You are a helpful assistant.',
        },
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.params.messages).toHaveLength(2);
      expect(result.params.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
    });

    it('converts function calls', () => {
      const params: GenerateContentParameters = {
        contents: [
          { role: 'user', parts: [{ text: 'What is the weather?' }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'get_weather',
                  args: { city: 'Tokyo' },
                  id: 'call_123',
                },
              },
            ],
          },
        ],
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.params.messages).toHaveLength(2);
      expect(result.params.messages[1]).toEqual({
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
      });
    });

    it('converts function responses', () => {
      const params: GenerateContentParameters = {
        contents: [
          { role: 'user', parts: [{ text: 'What is the weather?' }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'get_weather',
                  args: { city: 'Tokyo' },
                  id: 'call_123',
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'get_weather',
                  id: 'call_123',
                  response: { temperature: 25, condition: 'sunny' },
                },
              },
            ],
          },
        ],
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.params.messages).toHaveLength(3);
      expect(result.params.messages[2]).toEqual({
        role: 'tool',
        content: '{"temperature":25,"condition":"sunny"}',
        tool_call_id: 'call_123',
      });
    });

    it('converts tools', () => {
      const params: GenerateContentParameters = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_weather',
                  description: 'Get the weather for a city',
                  parameters: {
                    type: 'object',
                    properties: {
                      city: { type: 'string' },
                    },
                    required: ['city'],
                  },
                },
              ],
            },
          ],
        },
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.params.tools).toHaveLength(1);
      expect(result.params.tools?.[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the weather for a city',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
        },
      });
    });

    it('extracts abortSignal from config', () => {
      const controller = new AbortController();
      const params: GenerateContentParameters = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: {
          abortSignal: controller.signal,
        } as GenerateContentParameters['config'] & { abortSignal: AbortSignal },
      };

      const result = convertGeminiToOpenAI(params);

      expect(result.abortSignal).toBe(controller.signal);
    });
  });

  describe('convertOpenAIToGemini', () => {
    it('converts basic response', () => {
      const response: OpenAIChatResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      };

      const result = convertOpenAIToGemini(response);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates?.[0]?.content?.parts).toEqual([
        { text: 'Hello! How can I help you?' },
      ]);
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
      expect(result.usageMetadata).toEqual({
        promptTokenCount: 10,
        candidatesTokenCount: 8,
        totalTokenCount: 18,
      });
    });

    it('converts tool calls', () => {
      const response: OpenAIChatResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
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
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = convertOpenAIToGemini(response);

      expect(result.candidates?.[0]?.content?.parts).toEqual([
        { functionCall: { name: 'get_weather', args: { city: 'Tokyo' } } },
      ]);
    });
  });

  describe('convertStreamChunkToGemini', () => {
    it('converts text chunk', () => {
      const chunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
            },
            finish_reason: null,
          },
        ],
      };

      const result = convertStreamChunkToGemini(chunk);

      expect(result.candidates?.[0]?.content?.parts).toEqual([
        { text: 'Hello' },
      ]);
    });

    it('aggregates tool calls at finish_reason', () => {
      // First chunk - tool call name
      const chunk1: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };

      // Second chunk - partial arguments
      const chunk2: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: '{"city":',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };

      // Third chunk - more arguments
      const chunk3: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: '"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };

      // Final chunk - finish reason
      const chunk4: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'tool_calls',
          },
        ],
      };

      // Simulate the aggregation that happens in _wrapStream
      const aggregated = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();
      aggregated.set(0, {
        id: 'call_123',
        name: 'get_weather',
        arguments: '{"city":"Tokyo"}',
      });

      // First chunk - should yield with empty args (partial)
      const result1 = convertStreamChunkToGemini(chunk1);
      expect(result1.candidates?.[0]?.content?.parts).toEqual([
        { functionCall: { name: 'get_weather', args: {}, id: 'call_123' } },
      ]);

      // Second and third chunks - should not yield tool calls (no name in delta)
      const result2 = convertStreamChunkToGemini(chunk2);
      expect(result2.candidates?.[0]?.content?.parts).toEqual([]);

      const result3 = convertStreamChunkToGemini(chunk3);
      expect(result3.candidates?.[0]?.content?.parts).toEqual([]);

      // Final chunk with complete tool calls
      const result4 = convertStreamChunkToGemini(chunk4, aggregated);
      expect(result4.candidates?.[0]?.content?.parts).toEqual([
        {
          functionCall: {
            name: 'get_weather',
            args: { city: 'Tokyo' },
            id: 'call_123',
          },
        },
      ]);
      expect(result4.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
    });
  });
});

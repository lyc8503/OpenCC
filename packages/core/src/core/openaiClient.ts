/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenAI API client wrapper for the CLI.
 * Supports Chat Completions API with streaming.
 */

import OpenAI from 'openai';
import type { LlmRole } from '../telemetry/llmRole.js';

/**
 * OpenAI API response format compatible with our ContentGenerator interface.
 */
export interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant' | 'user' | 'system';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk format.
 */
export interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant' | 'user' | 'system';
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Message format for OpenAI API.
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>
    | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Tool definition for OpenAI API.
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Parameters for OpenAI chat completion.
 */
export interface OpenAIChatParams {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  top_p?: number;
}

/**
 * Configuration for OpenAI client.
 */
export interface OpenAIClientConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * OpenAI Content Generator implementation.
 * This is a low-level class that works with OpenAI-style parameters.
 * Use OpenAIWrapper to adapt it to the ContentGenerator interface.
 */
export class OpenAIContentGenerator {
  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;

  constructor(config: OpenAIClientConfig, defaultModel: string = 'gpt-4') {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env['OPENAI_API_KEY'],
      baseURL: config.baseUrl || process.env['OPENAI_BASE_URL'],
      organization: config.organization || process.env['OPENAI_ORG_ID'],
      defaultHeaders: config.defaultHeaders,
    });
    this.defaultModel = defaultModel;
    this.defaultMaxTokens = 8192;
  }

  /**
   * Generate a chat completion.
   */
  async generateContent(
    params: OpenAIChatParams,
    userPromptId: string,
    _role: LlmRole,
  ): Promise<OpenAIChatResponse> {
    const model = params.model || this.defaultModel;

    const completion = await this.client.chat.completions.create({
      model,
      messages:
        params.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: params.tools as
        | OpenAI.Chat.Completions.ChatCompletionTool[]
        | undefined,
      tool_choice: params.tool_choice,
      temperature: params.temperature,
      max_tokens: params.max_tokens ?? this.defaultMaxTokens,
      stop: params.stop,
      presence_penalty: params.presence_penalty,
      frequency_penalty: params.frequency_penalty,
      top_p: params.top_p,
    });

    return {
      id: completion.id,
      model: completion.model,
      choices: completion.choices.map((choice) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls
            ?.filter(
              (
                tc,
              ): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
                tc.type === 'function',
            )
            .map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
        },
        finish_reason: choice.finish_reason,
      })),
      usage: completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a streaming chat completion.
   */
  async *generateContentStream(
    params: OpenAIChatParams,
    userPromptId: string,
    _role: LlmRole,
  ): AsyncGenerator<OpenAIStreamChunk> {
    const model = params.model || this.defaultModel;

    const stream = await this.client.chat.completions.create({
      model,
      messages:
        params.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: params.tools as
        | OpenAI.Chat.Completions.ChatCompletionTool[]
        | undefined,
      tool_choice: params.tool_choice,
      temperature: params.temperature,
      max_tokens: params.max_tokens ?? this.defaultMaxTokens,
      stop: params.stop,
      presence_penalty: params.presence_penalty,
      frequency_penalty: params.frequency_penalty,
      top_p: params.top_p,
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        id: chunk.id,
        model: chunk.model,
        choices: chunk.choices.map((choice) => ({
          index: choice.index,
          delta: {
            role: choice.delta.role as
              | 'assistant'
              | 'user'
              | 'system'
              | undefined,
            content: choice.delta.content,
            tool_calls: choice.delta.tool_calls?.map((tc) => ({
              index: tc.index,
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function?.name,
                arguments: tc.function?.arguments,
              },
            })),
          },
          finish_reason: choice.finish_reason,
        })),
      };
    }
  }

  /**
   * Count tokens (approximation using tiktoken or simple estimation).
   * OpenAI doesn't provide a countTokens API, so we estimate.
   */
  async countTokens(
    messages: OpenAIMessage[],
    model?: string,
  ): Promise<{ prompt_tokens: number }> {
    // Simple estimation: ~4 characters per token on average
    const text = messages
      .map((m) => {
        if (m.content === null || m.content === undefined) return '';
        if (typeof m.content === 'string') return m.content;
        return m.content.map((c) => c.text || '').join('');
      })
      .join('');

    const estimatedTokens = Math.ceil(text.length / 4);

    return { prompt_tokens: estimatedTokens };
  }
}

/**
 * Token counting utility for OpenAI models.
 */
export async function countTokensForOpenAI(
  messages: Array<{ role: string; content: string }>,
  model?: string,
): Promise<{ prompt_tokens: number }> {
  // Simple estimation: ~4 characters per token on average
  const totalChars = messages.reduce(
    (sum, m) => sum + (m.content?.length || 0),
    0,
  );
  return { prompt_tokens: Math.ceil(totalChars / 4) };
}

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
import { estimateTokenCountSync } from '../utils/tokenCalculation.js';

/**
 * Extended OpenAI usage type with cached_tokens support.
 */
type OpenAIUsageWithCached = OpenAI.CompletionUsage & {
  cached_tokens?: number;
};

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
  usage?: OpenAIUsageWithCached;
}

/**
 * OpenAI streaming chunk format.
 */
export interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta?: {
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
  usage?: OpenAIUsageWithCached;
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
  timeout?: number;
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
      timeout: config.timeout || 600000, // 10 minutes default
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
    abortSignal?: AbortSignal,
  ): Promise<OpenAIChatResponse> {
    const model = params.model || this.defaultModel;

    const completion = await this.client.chat.completions.create(
      {
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
      },
      {
        signal: abortSignal,
      },
    );

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
            ...completion.usage,
            cached_tokens: (completion.usage as OpenAIUsageWithCached).cached_tokens,
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
    abortSignal?: AbortSignal,
  ): AsyncGenerator<OpenAIStreamChunk> {
    const model = params.model || this.defaultModel;

    const stream = await this.client.chat.completions.create(
      {
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
        stream_options: { include_usage: true },
      },
      {
        signal: abortSignal,
      },
    );

    for await (const chunk of stream) {
      yield {
        id: chunk.id,
        model: chunk.model,
        choices: chunk.choices.map((choice) => ({
          index: choice.index,
          delta: choice.delta ? {
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
          } : undefined,
          finish_reason: choice.finish_reason,
        })),
        usage: chunk.usage
          ? {
              ...chunk.usage,
              cached_tokens: (chunk.usage as OpenAIUsageWithCached).cached_tokens,
            }
          : undefined,
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
    tools?: OpenAITool[],
  ): Promise<{ prompt_tokens: number }> {
    return countTokensForOpenAI(messages, model, tools);
  }
}

function estimateOpenAIMessageTokens(message: OpenAIMessage): number {
  // Rough role/message framing overhead for chat APIs
  let tokens = 4;

  if (message.role) {
    tokens += Math.ceil(message.role.length / 4);
  }
  if (message.name) {
    tokens += Math.ceil(message.name.length / 4);
  }
  if (message.tool_call_id) {
    tokens += Math.ceil(message.tool_call_id.length / 4);
  }

  if (typeof message.content === 'string') {
    tokens += estimateTokenCountSync([{ text: message.content }]);
  } else if (Array.isArray(message.content)) {
    const parts = message.content.map((item) => {
      if (item.type === 'text') {
        return { text: item.text || '' };
      }
      if (item.type === 'image_url' && item.image_url?.url) {
        const url = item.image_url.url;
        if (url.startsWith('data:')) {
          const mimeMatch = url.match(/^data:([^;]+);base64,/);
          return {
            inlineData: {
              mimeType: mimeMatch?.[1] || 'image/*',
              data: '',
            },
          };
        }
        return { text: url };
      }
      return { text: '' };
    });
    tokens += estimateTokenCountSync(parts);
  }

  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += Math.ceil(JSON.stringify(tc).length / 4);
    }
  }

  return tokens;
}

function estimateOpenAIToolTokens(tools?: OpenAITool[]): number {
  if (!tools || tools.length === 0) {
    return 0;
  }
  return Math.ceil(JSON.stringify(tools).length / 4);
}

/**
 * Token counting utility for OpenAI models.
 * Heuristic only: counts message framing, content, tool calls, and tool schemas.
 */
export async function countTokensForOpenAI(
  messages: OpenAIMessage[],
  model?: string,
  tools?: OpenAITool[],
): Promise<{ prompt_tokens: number }> {
  let promptTokens = 0;

  for (const message of messages) {
    promptTokens += estimateOpenAIMessageTokens(message);
  }

  promptTokens += estimateOpenAIToolTokens(tools);

  // Assistant priming / reply prefix overhead
  promptTokens += 2;

  return { prompt_tokens: promptTokens };
}

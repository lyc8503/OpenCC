/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Content Generator module.
 * Provides OpenAI API compatible content generation with Gemini API compatibility.
 */

import type { Config } from '../config/config.js';
import { loadApiKey } from './apiKeyCredentialStorage.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { FakeContentGenerator } from './fakeContentGenerator.js';
import { parseCustomHeaders } from '../utils/customHeaderUtils.js';
import { determineSurface } from '../utils/surface.js';
import { RecordingContentGenerator } from './recordingContentGenerator.js';
import { getVersion } from '../utils/version.js';
import type { LlmRole } from '../telemetry/llmRole.js';
import {
  OpenAIContentGenerator,
  type OpenAIStreamChunk,
} from './openaiClient.js';
import {
  convertGeminiToOpenAI,
  convertOpenAIToGemini,
  convertStreamChunkToGemini,
} from './geminiOpenAIConverter.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';

/**
 * Re-export types for consumers.
 */
export type {
  OpenAIChatParams,
  OpenAIChatResponse,
  OpenAIStreamChunk,
} from './openaiClient.js';

/**
 * Interface abstracting the core functionalities for generating content.
 * Uses Gemini-compatible types for backward compatibility.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens?(
    request: import('@google/genai').CountTokensParameters,
  ): Promise<import('@google/genai').CountTokensResponse>;
}

/**
 * Authentication types - simplified to API key based auth.
 */
export enum AuthType {
  USE_API_KEY = 'api-key',
}

/**
 * Detects the authentication type from environment variables.
 */
export function getAuthTypeFromEnv(): AuthType | undefined {
  if (process.env['OPENAI_API_KEY']) {
    return AuthType.USE_API_KEY;
  }
  // Also support legacy GEMINI_API_KEY for backward compatibility
  if (process.env['GEMINI_API_KEY']) {
    return AuthType.USE_API_KEY;
  }
  return undefined;
}

/**
 * Configuration for content generator.
 */
export type ContentGeneratorConfig = {
  apiKey?: string;
  baseUrl?: string;
  authType?: AuthType;
  customHeaders?: Record<string, string>;
  organization?: string;
};

/**
 * Creates the content generator configuration.
 */
export async function createContentGeneratorConfig(
  config: Config,
  _authType: AuthType | undefined,
  apiKey?: string,
  baseUrl?: string,
  customHeaders?: Record<string, string>,
): Promise<ContentGeneratorConfig> {
  const resolvedApiKey =
    apiKey ||
    process.env['OPENAI_API_KEY'] ||
    process.env['GEMINI_API_KEY'] ||
    (await loadApiKey()) ||
    undefined;

  const resolvedBaseUrl =
    baseUrl ||
    process.env['OPENAI_BASE_URL'] ||
    process.env['GEMINI_BASE_URL'] ||
    undefined;

  return {
    apiKey: resolvedApiKey,
    baseUrl: resolvedBaseUrl,
    authType: AuthType.USE_API_KEY,
    customHeaders,
    organization: process.env['OPENAI_ORG_ID'],
  };
}

/**
 * Wrapper that converts between Gemini and OpenAI formats.
 */
class OpenAIWrapper implements ContentGenerator {
  private generator: OpenAIContentGenerator;

  constructor(generator: OpenAIContentGenerator) {
    this.generator = generator;
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse> {
    const { params: openaiParams, abortSignal } =
      convertGeminiToOpenAI(request);
    const response = await this.generator.generateContent(
      openaiParams,
      userPromptId,
      role,
      abortSignal,
    );
    return convertOpenAIToGemini(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const { params: openaiParams, abortSignal } =
      convertGeminiToOpenAI(request);
    const stream = await this.generator.generateContentStream(
      openaiParams,
      userPromptId,
      role,
      abortSignal,
    );
    // Return an async generator that wraps the stream
    return this._wrapStream(stream);
  }

  private async *_wrapStream(
    stream: AsyncGenerator<OpenAIStreamChunk>,
  ): AsyncGenerator<GenerateContentResponse> {
    // Aggregate tool calls across chunks since OpenAI streams them incrementally
    // Key = index, Value = { id, name, arguments }
    const aggregatedToolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];

      // Aggregate tool calls by index
      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const existing = aggregatedToolCalls.get(tc.index);
          if (existing) {
            // Append arguments to existing tool call
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
            // Update id if provided
            if (tc.id) {
              existing.id = tc.id;
            }
          } else {
            // Create new tool call entry
            aggregatedToolCalls.set(tc.index, {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '',
            });
          }
        }
      }

      // For streaming, we yield text content immediately
      // For tool calls, we wait until finish_reason to yield complete calls
      // This ensures we have complete JSON arguments before parsing
      const shouldYieldToolCalls =
        choice?.finish_reason && aggregatedToolCalls.size > 0;

      yield convertStreamChunkToGemini(
        chunk,
        shouldYieldToolCalls ? aggregatedToolCalls : undefined,
      );
    }
  }

  async countTokens(
    request: import('@google/genai').CountTokensParameters,
  ): Promise<import('@google/genai').CountTokensResponse> {
    const converted = convertGeminiToOpenAI({
      model: request.model || '',
      contents: request.contents,
      config: undefined,
    } as GenerateContentParameters);

    const result = await this.generator.countTokens(
      converted.params.messages,
      request.model,
      converted.params.tools,
    );
    return {
      totalTokens: result.prompt_tokens,
    };
  }
}

/**
 * Creates a content generator instance.
 */
export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  _sessionId?: string,
): Promise<ContentGenerator> {
  // Handle fake responses for testing
  if (gcConfig.fakeResponses) {
    const fakeGenerator = await FakeContentGenerator.fromFile(
      gcConfig.fakeResponses,
    );
    return new LoggingContentGenerator(fakeGenerator, gcConfig);
  }

  const version = await getVersion();
  const model = gcConfig.getModel() || 'gpt-4o'; // Default to gpt-4o if no model set
  const customHeadersEnv =
    process.env['CLI_CUSTOM_HEADERS'] ||
    process.env['GEMINI_CLI_CUSTOM_HEADERS'] ||
    undefined;
  const clientName = gcConfig.getClientName();
  const userAgentPrefix = clientName ? `CLI-${clientName}` : 'OpenCLI';
  const surface = determineSurface();
  const userAgent = `${userAgentPrefix}/${version}/${model} (${process.platform}; ${process.arch}; ${surface})`;
  const customHeadersMap = parseCustomHeaders(customHeadersEnv);

  const baseHeaders: Record<string, string> = {
    ...customHeadersMap,
    'User-Agent': userAgent,
  };

  if (config.customHeaders) {
    Object.assign(baseHeaders, config.customHeaders);
  }

  const openaiGenerator = new OpenAIContentGenerator(
    {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      organization: config.organization,
      defaultHeaders: baseHeaders,
    },
    model,
  );

  const generator = new OpenAIWrapper(openaiGenerator);
  const loggingGenerator = new LoggingContentGenerator(generator, gcConfig);

  if (gcConfig.recordResponses) {
    return new RecordingContentGenerator(
      loggingGenerator,
      gcConfig.recordResponses,
    );
  }

  return loggingGenerator;
}

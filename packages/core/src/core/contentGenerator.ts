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
import { resolveModel, DEFAULT_MODEL } from '../config/openaiModels.js';
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

  embedContent?(
    request: import('@google/genai').EmbedContentParameters,
  ): Promise<import('@google/genai').EmbedContentResponse>;
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
  proxy?: string;
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
    proxy: config?.getProxy(),
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
    const openaiParams = convertGeminiToOpenAI(request);
    const response = await this.generator.generateContent(
      openaiParams,
      userPromptId,
      role,
    );
    return convertOpenAIToGemini(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const openaiParams = convertGeminiToOpenAI(request);
    const stream = await this.generator.generateContentStream(
      openaiParams,
      userPromptId,
      role,
    );
    // Return an async generator that wraps the stream
    return this._wrapStream(stream);
  }

  private async *_wrapStream(
    stream: AsyncGenerator<OpenAIStreamChunk>,
  ): AsyncGenerator<GenerateContentResponse> {
    for await (const chunk of stream) {
      yield convertStreamChunkToGemini(chunk);
    }
  }

  async countTokens(
    request: import('@google/genai').CountTokensParameters,
  ): Promise<import('@google/genai').CountTokensResponse> {
    // Convert contents to OpenAI format for token counting
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const messages = contents.flatMap((content) => {
      if (typeof content === 'string') return [];
      if (!('parts' in content)) return [];
      return (content.parts || []).map(
        (part: import('@google/genai').Part) => ({
          role: (content.role || 'user') as 'system' | 'user' | 'assistant',
          content: part.text || '',
        }),
      );
    });
    const result = await this.generator.countTokens(messages, request.model);
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
  const model = resolveModel(gcConfig.getModel() || DEFAULT_MODEL);
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

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Validates a base URL.
 */
export function validateBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid custom base URL: ${baseUrl}`);
  }
  if (url.protocol !== 'https:' && !LOCAL_HOSTNAMES.includes(url.hostname)) {
    throw new Error('Custom base URL must use HTTPS unless it is localhost.');
  }
}

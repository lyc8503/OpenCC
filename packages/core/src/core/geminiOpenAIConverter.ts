/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converter utilities between Gemini API format and OpenAI API format.
 * This provides backward compatibility while using OpenAI as the backend.
 */

import type {
  OpenAIChatParams,
  OpenAIChatResponse,
  OpenAIStreamChunk,
  OpenAIMessage,
  OpenAITool,
} from './openaiClient.js';
import {
  GenerateContentResponse,
  FinishReason,
  type GenerateContentParameters,
  type Content,
  type Part,
} from '@google/genai';

/**
 * Re-export Gemini types for backward compatibility.
 */
export type { GenerateContentParameters, Content, Part } from '@google/genai';

/**
 * Helper to check if a value is a Content object.
 */
function isContent(value: unknown): value is Content {
  return typeof value === 'object' && value !== null && 'parts' in value;
}

/**
 * Helper to check if a value is a Part object.
 */
function isPart(value: unknown): value is Part {
  if (typeof value === 'string') return false;
  return (
    typeof value === 'object' &&
    value !== null &&
    ('text' in value ||
      'inlineData' in value ||
      'functionCall' in value ||
      'functionResponse' in value)
  );
}

/**
 * Helper to normalize contents to an array of Content objects.
 */
function normalizeContents(
  contents: GenerateContentParameters['contents'],
): Content[] {
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }

  if (Array.isArray(contents)) {
    return contents.map((item) => {
      if (typeof item === 'string') {
        return { role: 'user' as const, parts: [{ text: item }] };
      }
      if (isContent(item)) {
        return item;
      }
      if (isPart(item)) {
        return { role: 'user' as const, parts: [item] };
      }
      // Assume it's a part-like object
      return { role: 'user' as const, parts: [item as Part] };
    });
  }

  // Single value
  if (isContent(contents)) {
    return [contents];
  }
  if (isPart(contents)) {
    return [{ role: 'user' as const, parts: [contents] }];
  }

  // Fallback
  return [{ role: 'user', parts: [{ text: String(contents) }] }];
}

/**
 * Result of converting Gemini params to OpenAI params.
 * Includes the abortSignal separately since it's not part of the OpenAI API.
 */
export interface ConversionResult {
  params: OpenAIChatParams;
  abortSignal?: AbortSignal;
}

/**
 * Converts Gemini-style content to OpenAI messages.
 * Returns both the OpenAI params and the abortSignal (if present in config).
 */
export function convertGeminiToOpenAI(
  params: GenerateContentParameters,
): ConversionResult {
  const messages: OpenAIMessage[] = [];
  const config = params.config;

  // Extract abortSignal from config (it's not part of OpenAI API params)
  const abortSignal = config
    ? (config as { abortSignal?: AbortSignal }).abortSignal
    : undefined;

  // Add system instruction if present
  if (config?.systemInstruction) {
    let systemContent = '';
    const sysInstr = config.systemInstruction;
    if (typeof sysInstr === 'string') {
      systemContent = sysInstr;
    } else if (Array.isArray(sysInstr)) {
      systemContent = sysInstr
        .map((p) => {
          if (typeof p === 'string') return p;
          if ('text' in p) return p.text || '';
          return '';
        })
        .join('\n');
    } else if (typeof sysInstr === 'object') {
      if ('parts' in sysInstr && sysInstr.parts) {
        systemContent = sysInstr.parts
          .map((p) => {
            if (typeof p === 'string') return p;
            if ('text' in p) return p.text || '';
            return '';
          })
          .join('\n');
      } else if ('text' in sysInstr) {
        systemContent = sysInstr.text || '';
      }
    }
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }
  }

  // Convert contents to messages
  const normalizedContents = normalizeContents(params.contents);
  for (const content of normalizedContents) {
    const role =
      content.role === 'model' ? 'assistant' : content.role || 'user';
    const parts = content.parts || [];

    // Handle function responses
    const functionResponses = parts.filter((p) => p.functionResponse);
    if (functionResponses.length > 0) {
      for (const fr of functionResponses) {
        if (fr.functionResponse) {
          // tool_call_id must match the id from the corresponding tool_calls
          messages.push({
            role: 'tool',
            content: JSON.stringify(fr.functionResponse.response),
            tool_call_id:
              fr.functionResponse.id || fr.functionResponse.name || '',
          });
        }
      }
      continue;
    }

    // Handle function calls
    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: functionCalls.map((p, index) => {
          const fc = p.functionCall!;
          // Use the id if available, otherwise generate one from name + index
          const id = fc.id || `${fc.name}_${index}`;
          return {
            id,
            type: 'function' as const,
            function: {
              name: fc.name || '',
              arguments: JSON.stringify(fc.args || {}),
            },
          };
        }),
      });
      continue;
    }

    // Handle text and multimodal content
    const textParts = parts.filter((p) => p.text);
    const imageParts = parts.filter((p) => p.inlineData);

    if (imageParts.length > 0) {
      // Multimodal content
      const contentArray: Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
      }> = [];

      for (const part of textParts) {
        if (part.text) {
          contentArray.push({ type: 'text', text: part.text });
        }
      }

      for (const part of imageParts) {
        if (part.inlineData) {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            },
          });
        }
      }

      messages.push({
        role: role as 'user' | 'assistant',
        content: contentArray,
      });
    } else {
      // Text only
      const text = textParts.map((p) => p.text || '').join('\n');
      if (text) {
        messages.push({ role: role as 'user' | 'assistant', content: text });
      }
    }
  }

  // Convert tools from config if present
  const tools: OpenAITool[] | undefined = config?.tools?.flatMap((tool) => {
    if ('functionDeclarations' in tool && tool.functionDeclarations) {
      return tool.functionDeclarations.map((fn) => {
        // Handle both 'parameters' and 'parametersJsonSchema' field names
        const params =
          fn.parameters ??
          (fn as unknown as { parametersJsonSchema?: unknown })
            .parametersJsonSchema;
        return {
          type: 'function' as const,
          function: {
            name: fn.name || '',
            description: fn.description || '',
            parameters: params as Record<string, unknown> | undefined,
          },
        };
      });
    }
    return [];
  });

  // Convert tool config
  let toolChoice: OpenAIChatParams['tool_choice'] = undefined;
  if (config?.toolConfig?.functionCallingConfig?.mode === 'NONE') {
    toolChoice = 'none';
  } else if (config?.toolConfig?.functionCallingConfig?.mode === 'ANY') {
    toolChoice = 'required';
  }

  return {
    params: {
      model: params.model,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: toolChoice,
      temperature: config?.temperature,
      max_tokens: config?.maxOutputTokens,
      top_p: config?.topP,
      stop: config?.stopSequences,
    },
    abortSignal,
  };
}

/**
 * Maps OpenAI finish_reason to Gemini FinishReason enum.
 */
function mapFinishReason(
  finishReason: string | null | undefined,
): FinishReason | undefined {
  if (!finishReason) return undefined;
  switch (finishReason) {
    case 'stop':
      return FinishReason.STOP;
    case 'tool_calls':
      return FinishReason.STOP; // Tool calls also indicate normal completion
    case 'length':
      return FinishReason.MAX_TOKENS;
    case 'content_filter':
      return FinishReason.SAFETY;
    default:
      return FinishReason.STOP;
  }
}

/**
 * Converts OpenAI response to Gemini-style response.
 */
export function convertOpenAIToGemini(
  response: OpenAIChatResponse,
): GenerateContentResponse {
  const choice = response.choices[0];

  // Extract function calls if present
  const functionCalls = choice.message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments),
  }));

  // Build parts from content
  const parts: Part[] = [];
  if (choice.message.content) {
    parts.push({ text: choice.message.content });
  }
  if (functionCalls) {
    for (const fc of functionCalls) {
      parts.push({ functionCall: fc });
    }
  }

  const result = new GenerateContentResponse();
  result.candidates = [
    {
      content: { parts, role: 'model' },
      finishReason: mapFinishReason(choice.finish_reason),
    },
  ];
  result.usageMetadata = response.usage
    ? {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
        cachedContentTokenCount: response.usage.cached_tokens,
      }
    : undefined;

  return result;
}

/**
 * Converts streaming OpenAI chunk to Gemini-style response.
 * @param chunk - The OpenAI stream chunk
 * @param completeToolCalls - Map of complete tool calls (index -> {id, name, arguments})
 *   When provided (typically at finish_reason), these complete tool calls are included
 *   instead of partial delta.tool_calls
 */
export function convertStreamChunkToGemini(
  chunk: OpenAIStreamChunk,
  completeToolCalls?: Map<
    number,
    { id: string; name: string; arguments: string }
  >,
): GenerateContentResponse {
  const choice = chunk.choices[0];
  // Handle case where choice or delta is undefined (e.g., usage-only chunks)
  if (!choice || !choice.delta) {
    const result = new GenerateContentResponse();
    result.candidates = [{
      content: { parts: [], role: 'model' },
      finishReason: choice?.finish_reason ? mapFinishReason(choice.finish_reason) : undefined,
    }];
    if (chunk.usage) {
      result.usageMetadata = {
        promptTokenCount: chunk.usage.prompt_tokens,
        candidatesTokenCount: chunk.usage.completion_tokens,
        totalTokenCount: chunk.usage.total_tokens,
      };
    }
    return result;
  }
  const delta = choice.delta;

  const parts: Part[] = [];
  if (delta.content) {
    parts.push({ text: delta.content });
  }

  // Handle tool calls
  // If we have complete tool calls (at finish_reason), use those
  // Otherwise, for mid-stream chunks, we only include tool calls if they have names
  if (completeToolCalls && completeToolCalls.size > 0) {
    // At finish_reason, yield all complete tool calls
    for (const [, tc] of completeToolCalls) {
      if (tc.name) {
        let args = {};
        try {
          args = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          // If parsing fails, use empty object
          args = {};
        }
        parts.push({
          functionCall: {
            name: tc.name,
            args,
            id: tc.id || undefined,
          },
        });
      }
    }
  } else if (delta.tool_calls) {
    // Mid-stream: we should NOT yield functionCall yet because args are incomplete.
    // The complete tool calls will be yielded at finish_reason via completeToolCalls.
    // We only yield text content here.
  }

  const result = new GenerateContentResponse();
  result.candidates = [
    {
      content: { parts, role: 'model' },
      finishReason: mapFinishReason(choice.finish_reason),
    },
  ];

  // Copy usage metadata from the OpenAI chunk (present in final chunk)
  if (chunk.usage) {
    result.usageMetadata = {
      promptTokenCount: chunk.usage.prompt_tokens,
      candidatesTokenCount: chunk.usage.completion_tokens,
      totalTokenCount: chunk.usage.total_tokens,
      cachedContentTokenCount: chunk.usage.cached_tokens,
    };
  }

  return result;
}

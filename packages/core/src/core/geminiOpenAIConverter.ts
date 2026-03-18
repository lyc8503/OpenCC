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
 * Converts Gemini-style content to OpenAI messages.
 */
export function convertGeminiToOpenAI(
  params: GenerateContentParameters,
): OpenAIChatParams {
  const messages: OpenAIMessage[] = [];
  const config = params.config;

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
      return tool.functionDeclarations.map((fn) => ({
        type: 'function' as const,
        function: {
          name: fn.name || '',
          description: fn.description || '',
          parameters: fn.parameters as Record<string, unknown> | undefined,
        },
      }));
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
    model: params.model,
    messages,
    tools: tools?.length ? tools : undefined,
    tool_choice: toolChoice,
    temperature: config?.temperature,
    max_tokens: config?.maxOutputTokens,
    top_p: config?.topP,
    stop: config?.stopSequences,
  };
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
      finishReason: (choice.finish_reason as FinishReason) || FinishReason.STOP,
    },
  ];
  result.usageMetadata = response.usage
    ? {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      }
    : undefined;

  return result;
}

/**
 * Converts streaming OpenAI chunk to Gemini-style response.
 */
export function convertStreamChunkToGemini(
  chunk: OpenAIStreamChunk,
): GenerateContentResponse {
  const choice = chunk.choices[0];
  const delta = choice.delta;

  const parts: Part[] = [];
  if (delta.content) {
    parts.push({ text: delta.content });
  }
  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      if (tc.function?.name) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: tc.function.arguments
              ? JSON.parse(tc.function.arguments)
              : {},
          },
        });
      }
    }
  }

  const result = new GenerateContentResponse();
  result.candidates = [
    {
      content: { parts, role: 'model' },
      finishReason: (choice.finish_reason as FinishReason) || undefined,
    },
  ];

  return result;
}

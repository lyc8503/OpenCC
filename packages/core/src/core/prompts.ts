/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HierarchicalMemory } from '../config/memory.js';
import type { AgentLoopContext } from '../config/agent-loop-context.js';
import { PromptProvider } from '../prompts/promptProvider.js';
import { resolvePathFromEnv as resolvePathFromEnvImpl } from '../prompts/utils.js';

/**
 * Resolves a path or switch value from an environment variable.
 * @deprecated Use resolvePathFromEnv from @google/gemini-cli-core/prompts/utils instead.
 */
export function resolvePathFromEnv(envVar?: string) {
  return resolvePathFromEnvImpl(envVar);
}

/**
 * Returns the core system prompt for the agent.
 */
export function getCoreSystemPrompt(
  context: AgentLoopContext,
  userMemory?: string | HierarchicalMemory,
  interactiveOverride?: boolean,
): string {
  return new PromptProvider().getCoreSystemPrompt(
    context,
    userMemory,
    interactiveOverride,
  );
}

/**
 * Provides the system prompt for the history compression process.
 */
export function getCompressionPrompt(context: AgentLoopContext): string {
  return new PromptProvider().getCompressionPrompt(context);
}
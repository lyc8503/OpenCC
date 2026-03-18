/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified fallback strategy for OpenAI-based API.
 * Since we don't have complex availability logic anymore,
 * this just uses the configured model directly.
 */

import type { Config } from '../../config/config.js';
import { resolveModel } from '../../config/models.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import type {
  RoutingContext,
  RoutingDecision,
  RoutingStrategy,
} from '../routingStrategy.js';
import type { LocalLiteRtLmClient } from '../../core/localLiteRtLmClient.js';

export class FallbackStrategy implements RoutingStrategy {
  readonly name = 'fallback';

  async route(
    context: RoutingContext,
    config: Config,
    _baseLlmClient: BaseLlmClient,
    _localLiteRtLmClient: LocalLiteRtLmClient,
  ): Promise<RoutingDecision | null> {
    // With OpenAI-based API, we don't have automatic fallback.
    // Just use the configured model directly.
    const requestedModel = context.requestedModel ?? config.getModel();
    const resolvedModel = resolveModel(
      requestedModel,
      config.getGemini31LaunchedSync?.() ?? false,
    );

    return {
      model: resolvedModel,
      metadata: {
        source: this.name,
        latencyMs: 0,
        reasoning: `Using configured model: ${resolvedModel}`,
      },
    };
  }
}

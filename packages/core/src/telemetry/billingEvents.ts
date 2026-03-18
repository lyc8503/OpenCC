/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified billing events for OpenAI-based API.
 * Since billing is handled externally, this file provides stubs.
 */

import type { Config } from '../config/config.js';
import type { LogAttributes } from '@opentelemetry/api-logs';
import type { BaseTelemetryEvent } from './types.js';
import { getCommonAttributes } from './telemetryAttributes.js';

/** Overage menu option that can be selected by the user */
export type OverageOption =
  | 'use_credits'
  | 'use_fallback'
  | 'manage'
  | 'stop'
  | 'get_credits';

/** Base interface for billing telemetry events */
export interface BillingTelemetryEvent extends BaseTelemetryEvent {
  getAttributes(config: Config): LogAttributes;
  toLogBody(): string;
  toOpenTelemetryAttributes(config: Config): LogAttributes;
}

// Simplified stub - no billing events for OpenAI API
export const EVENT_OVERAGE_MENU_SHOWN = 'cli.overage_menu_shown';

export class OverageMenuShownEvent implements BillingTelemetryEvent {
  'event.name': 'overage_menu_shown';
  'event.timestamp': string;
  model: string;
  tier: string;
  overage_strategy: string;

  constructor(model: string, tier: string, overageStrategy: string) {
    this['event.name'] = 'overage_menu_shown';
    this['event.timestamp'] = new Date().toISOString();
    this.model = model;
    this.tier = tier;
    this.overage_strategy = overageStrategy;
  }

  getAttributes(config: Config): LogAttributes {
    return {
      ...getCommonAttributes(config),
      'event.name': this['event.name'],
      'event.timestamp': this['event.timestamp'],
      model: this.model,
      tier: this.tier,
      overage_strategy: this.overage_strategy,
    };
  }

  toLogBody(): string {
    return `Overage menu shown for model ${this.model}.`;
  }

  toOpenTelemetryAttributes(config: Config): LogAttributes {
    return this.getAttributes(config);
  }
}

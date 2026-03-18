/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeFakeConfig } from '../test-utils/config.js';
import {
  OverageMenuShownEvent,
  EVENT_OVERAGE_MENU_SHOWN,
} from './billingEvents.js';

describe('billingEvents', () => {
  const fakeConfig = makeFakeConfig();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('OverageMenuShownEvent', () => {
    it('should construct with correct properties', () => {
      const event = new OverageMenuShownEvent('gpt-4o', 'standard', 'ask');
      expect(event['event.name']).toBe('overage_menu_shown');
      expect(event.model).toBe('gpt-4o');
      expect(event.tier).toBe('standard');
      expect(event.overage_strategy).toBe('ask');
    });

    it('should produce correct OpenTelemetry attributes', () => {
      const event = new OverageMenuShownEvent('gpt-4o', 'standard', 'ask');
      const attrs = event.toOpenTelemetryAttributes(fakeConfig);
      expect(attrs['event.name']).toBe(EVENT_OVERAGE_MENU_SHOWN);
      expect(attrs['model']).toBe('gpt-4o');
      expect(attrs['tier']).toBe('standard');
      expect(attrs['overage_strategy']).toBe('ask');
    });

    it('should produce a human-readable log body', () => {
      const event = new OverageMenuShownEvent('gpt-4o', 'standard', 'ask');
      expect(event.toLogBody()).toContain('gpt-4o');
    });
  });
});

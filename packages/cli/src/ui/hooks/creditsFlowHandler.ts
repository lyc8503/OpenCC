/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FallbackIntent } from '@google/gemini-cli-core';

/**
 * Handles the credits flow when a quota error occurs.
 * Since billing functionality has been removed, this always returns null
 * to fall through to the default ProQuotaDialog.
 */
export async function handleCreditsFlow(): Promise<FallbackIntent | null> {
  // Billing/credits functionality has been removed
  return null;
}

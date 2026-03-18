/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified types for fallback handling.
 * Since we don't have complex availability logic anymore,
 * these types are kept minimal for backward compatibility.
 */

/**
 * Defines the intent returned by the UI layer during a fallback scenario.
 */
export type FallbackIntent =
  | 'retry_always' // Retry with fallback model and stick to it for future requests.
  | 'retry_once' // Retry with fallback model for this request only.
  | 'stop' // Stop the current request.
  | 'retry_later'; // Stop the current request and try again later.

/**
 * The interface for the handler provided by the UI layer (e.g., the CLI)
 * to interact with the user during a fallback scenario.
 */
export type FallbackModelHandler = (
  failedModel: string,
  fallbackModel: string,
  error?: unknown,
) => Promise<FallbackIntent | null>;

/**
 * Defines the intent returned by the UI layer during a validation required scenario.
 */
export type ValidationIntent =
  | 'verify' // User chose to verify, wait for completion then retry.
  | 'change_auth' // User chose to change authentication method.
  | 'cancel'; // User cancelled the verification process.

/**
 * The interface for the handler provided by the UI layer (e.g., the CLI)
 * to interact with the user when validation is required.
 */
export type ValidationHandler = (
  validationLink?: string,
  validationDescription?: string,
  learnMoreUrl?: string,
) => Promise<ValidationIntent>;

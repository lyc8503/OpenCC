/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { type Config } from '@google/gemini-cli-core';

export interface PrivacyState {
  isLoading: boolean;
  error?: string;
  isFreeTier?: boolean;
  dataCollectionOptIn?: boolean;
}

export const usePrivacySettings = (_config: Config) => {
  const [privacyState, setPrivacyState] = useState<PrivacyState>({
    isLoading: false,
    isFreeTier: true,
    dataCollectionOptIn: true,
  });

  const updateDataCollectionOptIn = useCallback(async (optIn: boolean) => {
    setPrivacyState({
      isLoading: false,
      isFreeTier: true,
      dataCollectionOptIn: optIn,
    });
  }, []);

  return {
    privacyState,
    updateDataCollectionOptIn,
  };
};

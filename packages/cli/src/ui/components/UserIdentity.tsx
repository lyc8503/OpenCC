/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { type Config, AuthType } from '@google/gemini-cli-core';

interface UserIdentityProps {
  config: Config;
}

export const UserIdentity: React.FC<UserIdentityProps> = ({ config }) => {
  const authType = config.getContentGeneratorConfig()?.authType;
  const baseUrl = config.getContentGeneratorConfig()?.baseUrl;
  const currentModel = config.getModel();

  if (!authType) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={theme.text.primary}>
            <Text bold>No API key configured. </Text>
            <Text>Use </Text>
            <Text bold color={theme.text.link}>/model</Text>
            <Text> to set one.</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  // Format the endpoint display
  const endpointDisplay = baseUrl ? ` (${baseUrl})` : '';
  const modelDisplay = currentModel ? ` | Model: ${currentModel}` : '';

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.text.primary} wrap="truncate-end">
          {authType === AuthType.USE_API_KEY ? (
            <Text bold>✓ API Key{endpointDisplay}{modelDisplay}</Text>
          ) : (
            <Text bold>✓ Authenticated with {authType}{endpointDisplay}{modelDisplay}</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};

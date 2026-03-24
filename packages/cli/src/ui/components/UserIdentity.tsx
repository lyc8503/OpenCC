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

  if (!authType) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.text.primary} wrap="truncate-end">
          {authType === AuthType.USE_API_KEY ? (
            <Text bold>✓ Authenticated with API Key</Text>
          ) : (
            <Text bold>✓ Authenticated with {authType}</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};

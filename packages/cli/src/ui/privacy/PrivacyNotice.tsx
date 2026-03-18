/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { type Config } from '@google/gemini-cli-core';
import { GeminiPrivacyNotice } from './GeminiPrivacyNotice.js';

interface PrivacyNoticeProps {
  onExit: () => void;
  config: Config;
}

const PrivacyNoticeText = ({
  onExit,
}: {
  config: Config;
  onExit: () => void;
}) => {
  // Default to Gemini privacy notice for API key auth
  return <GeminiPrivacyNotice onExit={onExit} />;
};

export const PrivacyNotice = ({ onExit, config }: PrivacyNoticeProps) => (
  <Box borderStyle="round" padding={1} flexDirection="column">
    <PrivacyNoticeText config={config} onExit={onExit} />
  </Box>
);

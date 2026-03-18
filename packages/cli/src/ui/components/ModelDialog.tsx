/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  DEFAULT_MODEL,
  GPT_4O_MODEL,
  GPT_4O_MINI_MODEL,
  GPT_4_TURBO_MODEL,
  O1_MODEL,
  O1_MINI_MODEL,
  CLAUDE_OPUS_4_MODEL,
  CLAUDE_SONNET_4_MODEL,
  CLAUDE_HAIKU_4_MODEL,
  CLAUDE_35_SONNET_MODEL,
  getModelDisplayName,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

interface ModelDialogProps {
  onClose: () => void;
}

// All available models for selection
const ALL_MODELS = [
  GPT_4O_MODEL,
  GPT_4O_MINI_MODEL,
  GPT_4_TURBO_MODEL,
  O1_MODEL,
  O1_MINI_MODEL,
  CLAUDE_OPUS_4_MODEL,
  CLAUDE_SONNET_4_MODEL,
  CLAUDE_HAIKU_4_MODEL,
  CLAUDE_35_SONNET_MODEL,
];

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const [persistMode, setPersistMode] = useState(false);

  // Determine the current model
  const currentModel = config?.getModel() || DEFAULT_MODEL;

  const options = useMemo(() => {
    return ALL_MODELS.map((model) => ({
      value: model,
      title: getModelDisplayName(model),
      key: model,
    }));
  }, []);

  // Calculate the initial index based on the current model
  const initialIndex = useMemo(() => {
    const idx = options.findIndex((option) => option.value === currentModel);
    return idx !== -1 ? idx : 0;
  }, [currentModel, options]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
        return true;
      }
      if (key.name === 'tab') {
        setPersistMode((prev) => !prev);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  const handleSelect = useCallback(
    (model: string) => {
      if (config) {
        config.setModel(model, persistMode ? false : true);
      }
      onClose();
    },
    [config, onClose, persistMode],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>

      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={options}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.text.primary}>
            Remember model for future sessions:{' '}
          </Text>
          <Text color={theme.status.success}>
            {persistMode ? 'true' : 'false'}
          </Text>
        </Box>
        <Text color={theme.text.secondary}>(Press Tab to toggle)</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {'> Set OPENAI_MODEL env var to override on startup.'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}

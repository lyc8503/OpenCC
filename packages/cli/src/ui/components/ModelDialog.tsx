/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  SettingScope,
  type LoadableSettingScope,
  type LoadedSettings,
} from '../../config/settings.js';
import { DEFAULT_MODEL } from '@google/gemini-cli-core';
import { getCachedStringWidth } from '../utils/textUtils.js';
import {
  BaseSettingsDialog,
  type SettingsDialogItem,
} from './shared/BaseSettingsDialog.js';
import { getNestedValue } from '../../utils/settingsUtils.js';

/**
 * Configuration field definition for model settings
 */
interface ModelConfigField {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  path: string[]; // Path within settings, e.g., ['model', 'name']
  defaultValue: string | number | boolean | undefined;
  isSecret?: boolean;
  envVarName?: string; // Environment variable that overrides this field
}

/**
 * Model configuration fields
 */
const MODEL_CONFIG_FIELDS: ModelConfigField[] = [
  {
    key: 'modelName',
    label: 'Model Name',
    description: 'The AI model to use for conversations',
    type: 'string',
    path: ['model', 'name'],
    defaultValue: DEFAULT_MODEL,
    envVarName: 'OPENAI_MODEL',
  },
  {
    key: 'openaiBaseUrl',
    label: 'OpenAI Base URL',
    description: 'Custom API endpoint (optional, for proxies)',
    type: 'string',
    path: ['model', 'openaiBaseUrl'],
    defaultValue: undefined,
    envVarName: 'OPENAI_BASE_URL',
  },
  {
    key: 'openaiApiKey',
    label: 'OpenAI API Key',
    description: 'API key for authentication',
    type: 'string',
    path: ['model', 'openaiApiKey'],
    defaultValue: undefined,
    isSecret: true,
    envVarName: 'OPENAI_API_KEY',
  },
  {
    key: 'contextWindow',
    label: 'Context Window',
    description: 'Maximum context window size in tokens',
    type: 'number',
    path: ['model', 'contextWindow'],
    defaultValue: undefined,
  },
  {
    key: 'maxOutputTokens',
    label: 'Max Output Tokens',
    description: 'Maximum output tokens per response',
    type: 'number',
    path: ['model', 'maxOutputTokens'],
    defaultValue: undefined,
  },
];

interface ModelDialogProps {
  settings: LoadedSettings;
  onClose: () => void;
  onSave?: () => void;
  /** Available terminal height for dynamic windowing */
  availableTerminalHeight?: number;
}

/**
 * Get the effective default value for a field
 */
function getFieldDefault(
  field: ModelConfigField,
  currentModel: string,
): string | number | boolean | undefined {
  // For now, context window and max output tokens don't have defaults
  // They should be configured via settings
  if (field.key === 'contextWindow' || field.key === 'maxOutputTokens') {
    return undefined;
  }
  return field.defaultValue;
}

/**
 * Get value from environment variable if exists
 */
function getEnvValue(envVarName?: string): string | undefined {
  if (!envVarName) return undefined;
  return process.env[envVarName];
}

export function ModelDialog({
  settings,
  onClose,
  onSave,
  availableTerminalHeight,
}: ModelDialogProps): React.JSX.Element {
  // Scope selector state (User by default)
  const [selectedScope, setSelectedScope] = useState<LoadableSettingScope>(
    SettingScope.User,
  );

  // Get current model name from effective value (env > settings > default)
  const currentModel = useMemo(() => {
    const envModel = getEnvValue('OPENAI_MODEL');
    if (envModel) return envModel;

    const scopeSettings = settings.forScope(selectedScope).settings;
    return scopeSettings.model?.name || DEFAULT_MODEL;
  }, [settings, selectedScope]);

  // Track which fields have been modified
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  /**
   * Save a specific field value to settings
   */
  const saveFieldValue = useCallback(
    (fieldKey: string, path: string[], value: unknown) => {
      // Build the full settings path
      const settingsPath = path.join('.');
      settings.setValue(selectedScope, settingsPath, value);
      onSave?.();
    },
    [settings, selectedScope, onSave],
  );

  // Calculate max label width
  const maxLabelWidth = useMemo(() => {
    let max = 0;
    for (const field of MODEL_CONFIG_FIELDS) {
      const lWidth = getCachedStringWidth(field.label);
      const dWidth = getCachedStringWidth(field.description);
      max = Math.max(max, lWidth, dWidth);
    }
    return max;
  }, []);

  // Generate items for BaseSettingsDialog
  const items: SettingsDialogItem[] = useMemo(
    () =>
      MODEL_CONFIG_FIELDS.map((field) => {
        // Check if environment variable overrides this field
        const envValue = getEnvValue(field.envVarName);
        const hasEnvOverride = envValue !== undefined;

        const scopeSettings = settings.forScope(selectedScope).settings;
        const settingsValue = getNestedValue(scopeSettings, field.path);
        const defaultValue = getFieldDefault(field, currentModel);

        // Priority: env var > settings > default
        const effectiveValue = hasEnvOverride
          ? envValue
          : settingsValue !== undefined
            ? settingsValue
            : defaultValue;

        let displayValue: string;
        if (field.type === 'boolean') {
          displayValue = effectiveValue ? 'true' : 'false';
        } else if (effectiveValue !== undefined && effectiveValue !== null) {
          if (field.isSecret && typeof effectiveValue === 'string') {
            // Mask secrets
            displayValue = effectiveValue.substring(0, 8) + '...';
          } else {
            displayValue = String(effectiveValue);
          }
        } else {
          displayValue = '(default)';
        }

        // Add indicator for environment variable override
        if (hasEnvOverride) {
          displayValue += ' [env]';
        } else if (settingsValue !== undefined) {
          displayValue += '*';
        }

        // Get raw value for edit mode
        const rawValue =
          settingsValue !== undefined ? settingsValue : effectiveValue;

        return {
          key: field.key,
          label: field.label,
          description: field.description,
          type: field.type,
          displayValue,
          isGreyedOut: settingsValue === undefined && !hasEnvOverride,
          isEditable: !hasEnvOverride, // Not editable if env var exists
          scopeMessage: hasEnvOverride
            ? `Overridden by ${field.envVarName}`
            : undefined,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          rawValue: rawValue as string | number | boolean | undefined,
        };
      }),
    [settings, selectedScope, currentModel, modifiedFields],
  );

  const maxItemsToShow = 5;

  // Handle scope changes
  const handleScopeChange = useCallback((scope: LoadableSettingScope) => {
    setSelectedScope(scope);
  }, []);

  // Handle toggle for boolean fields
  const handleItemToggle = useCallback(
    (key: string, _item: SettingsDialogItem) => {
      const field = MODEL_CONFIG_FIELDS.find((f) => f.key === key);
      if (!field || field.type !== 'boolean') return;

      // Don't allow editing if env var exists
      if (getEnvValue(field.envVarName) !== undefined) return;

      const scopeSettings = settings.forScope(selectedScope).settings;
      const currentValue = getNestedValue(scopeSettings, field.path);
      const defaultValue = getFieldDefault(field, currentModel);
      const effectiveValue =
        currentValue !== undefined ? currentValue : defaultValue;
      const newValue = !effectiveValue;

      setModifiedFields((prev) => new Set(prev).add(key));

      // Save the field value to settings
      saveFieldValue(field.key, field.path, newValue);
    },
    [settings, selectedScope, currentModel, saveFieldValue],
  );

  // Handle edit commit for string/number fields
  const handleEditCommit = useCallback(
    (key: string, newValue: string, _item: SettingsDialogItem) => {
      const field = MODEL_CONFIG_FIELDS.find((f) => f.key === key);
      if (!field) return;

      // Don't allow editing if env var exists
      if (getEnvValue(field.envVarName) !== undefined) return;

      let parsed: string | number | undefined;
      if (field.type === 'number') {
        if (newValue.trim() === '') {
          // Empty means clear the override
          parsed = undefined;
        } else {
          const numParsed = Number(newValue.trim());
          if (Number.isNaN(numParsed)) {
            // Invalid number; don't save
            return;
          }
          parsed = numParsed;
        }
      } else {
        // For strings, empty means clear the override
        parsed = newValue.trim() === '' ? undefined : newValue;
      }

      setModifiedFields((prev) => new Set(prev).add(key));

      // Save the field value to settings
      saveFieldValue(field.key, field.path, parsed);
    },
    [saveFieldValue],
  );

  // Handle clear/reset - reset to default value (removes override)
  const handleItemClear = useCallback(
    (key: string, _item: SettingsDialogItem) => {
      const field = MODEL_CONFIG_FIELDS.find((f) => f.key === key);
      if (!field) return;

      // Don't allow clearing if env var exists
      if (getEnvValue(field.envVarName) !== undefined) return;

      setModifiedFields((prev) => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });

      // Save as undefined to remove the override
      saveFieldValue(field.key, field.path, undefined);
    },
    [saveFieldValue],
  );

  return (
    <BaseSettingsDialog
      title="Model Configuration"
      searchEnabled={false}
      items={items}
      showScopeSelector={true}
      selectedScope={selectedScope}
      onScopeChange={handleScopeChange}
      maxItemsToShow={maxItemsToShow}
      availableHeight={availableTerminalHeight}
      maxLabelWidth={maxLabelWidth}
      onItemToggle={handleItemToggle}
      onEditCommit={handleEditCommit}
      onItemClear={handleItemClear}
      onClose={onClose}
      footer={
        modifiedFields.size > 0
          ? {
              content: (
                <Text color={theme.text.secondary}>
                  Settings saved. Environment variables (OPENAI_API_KEY,
                  OPENAI_BASE_URL, OPENAI_MODEL) take precedence.
                </Text>
              ),
              height: 1,
            }
          : undefined
      }
    />
  );
}
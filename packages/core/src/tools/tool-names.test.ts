/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isValidToolName,
  ALL_BUILTIN_TOOL_NAMES,
  DISCOVERED_TOOL_PREFIX,
  GLOB_TOOL_NAME,
} from './tool-names.js';

describe('tool-names', () => {
  describe('isValidToolName', () => {
    it('should validate built-in tool names', () => {
      expect(isValidToolName(GLOB_TOOL_NAME)).toBe(true);
      for (const name of ALL_BUILTIN_TOOL_NAMES) {
        expect(isValidToolName(name)).toBe(true);
      }
    });

    it('should validate discovered tool names', () => {
      expect(isValidToolName(`${DISCOVERED_TOOL_PREFIX}my_tool`)).toBe(true);
    });

    it('should validate modern MCP FQNs (mcp_server_tool)', () => {
      expect(isValidToolName('mcp_server_tool')).toBe(true);
      expect(isValidToolName('mcp_my-server_my-tool')).toBe(true);
    });

    it('should return false for invalid tool names', () => {
      expect(isValidToolName('invalid-tool-name')).toBe(false);
      expect(isValidToolName('mcp_server')).toBe(false);
      expect(isValidToolName('mcp__tool')).toBe(false);
      expect(isValidToolName('mcp_invalid server_tool')).toBe(false);
      expect(isValidToolName('mcp_server_invalid tool')).toBe(false);
      expect(isValidToolName('mcp_server_')).toBe(false);
    });

    it('should handle wildcards when allowed', () => {
      // Default: not allowed
      expect(isValidToolName('*')).toBe(false);
      expect(isValidToolName('mcp_*')).toBe(false);
      expect(isValidToolName('mcp_server_*')).toBe(false);

      // Explicitly allowed
      expect(isValidToolName('*', { allowWildcards: true })).toBe(true);
      expect(isValidToolName('mcp_*', { allowWildcards: true })).toBe(true);
      expect(isValidToolName('mcp_server_*', { allowWildcards: true })).toBe(
        true,
      );

      // Invalid wildcards
      expect(isValidToolName('mcp__*', { allowWildcards: true })).toBe(false);
      expect(
        isValidToolName('mcp_server_tool*', { allowWildcards: true }),
      ).toBe(false);
    });
  });
});

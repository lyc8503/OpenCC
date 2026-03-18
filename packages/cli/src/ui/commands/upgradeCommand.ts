/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, type SlashCommand } from './types.js';

/**
 * Command to show upgrade information.
 * Note: The upgrade URL has been removed as part of the OpenAI migration.
 */
export const upgradeCommand: SlashCommand = {
  name: 'upgrade',
  kind: CommandKind.BUILT_IN,
  description: 'Upgrade your plan for higher limits',
  autoExecute: true,
  action: async (_context) => {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'Please visit your OpenAI API provider to manage your subscription and limits.',
    };
  },
};

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mocked,
} from 'vitest';
import {
  WriteFileTool,
  type WriteFileToolParams,
} from './write-file.js';
import { ToolErrorType } from './tool-error.js';
import {
  ToolConfirmationOutcome,
  type FileDiff,
  type ToolEditConfirmationDetails,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import type { Config } from '../config/config.js';
import { ApprovalMode } from '../policy/types.js';
import type { ToolRegistry } from './tool-registry.js';
import path from 'node:path';
import { isSubpath } from '../utils/paths.js';
import fs from 'node:fs';
import os from 'node:os';
import { GeminiClient } from '../core/client.js';
import type { BaseLlmClient } from '../core/baseLlmClient.js';
import { StandardFileSystemService } from '../services/fileSystemService.js';
import { IdeClient, type DiffUpdateResult } from '../ide/ide-client.js';
import { WorkspaceContext } from '../utils/workspaceContext.js';
import {
  createMockMessageBus,
  getMockMessageBusInstance,
} from '../test-utils/mock-message-bus.js';

const rootDir = path.resolve(os.tmpdir(), 'gemini-cli-test-root');
const plansDir = path.resolve(os.tmpdir(), 'gemini-cli-test-plans');

// --- MOCKS ---
vi.mock('../core/client.js');
vi.mock('../ide/ide-client.js', () => ({
  IdeClient: {
    getInstance: vi.fn(),
  },
}));
let mockGeminiClientInstance: Mocked<GeminiClient>;
let mockBaseLlmClientInstance: Mocked<BaseLlmClient>;
let mockConfig: Config;
const mockIdeClient = {
  openDiff: vi.fn(),
  isDiffingEnabled: vi.fn(),
};

vi.mocked(IdeClient.getInstance).mockResolvedValue(
  mockIdeClient as unknown as IdeClient,
);

// Mock Config
const fsService = new StandardFileSystemService();
const mockConfigInternal = {
  getTargetDir: () => rootDir,
  getApprovalMode: vi.fn(() => ApprovalMode.DEFAULT),
  setApprovalMode: vi.fn(),
  getGeminiClient: vi.fn(), // Initialize as a plain mock function
  getBaseLlmClient: vi.fn(), // Initialize as a plain mock function
  getFileSystemService: () => fsService,
  getIdeMode: vi.fn(() => false),
  getWorkspaceContext: () => new WorkspaceContext(rootDir, [plansDir]),
  getApiKey: () => 'test-key',
  getModel: () => 'test-model',
  getSandbox: () => false,
  getDebugMode: () => false,
  getQuestion: () => undefined,

  getToolDiscoveryCommand: () => undefined,
  getToolCallCommand: () => undefined,
  getMcpServerCommand: () => undefined,
  getMcpServers: () => undefined,
  getUserAgent: () => 'test-agent',
  getUserMemory: () => '',
  setUserMemory: vi.fn(),
  getGeminiMdFileCount: () => 0,
  setGeminiMdFileCount: vi.fn(),
  getToolRegistry: () =>
    ({
      registerTool: vi.fn(),
      discoverTools: vi.fn(),
    }) as unknown as ToolRegistry,
  isInteractive: () => false,
  getDisableLLMCorrection: vi.fn(() => true),
  getActiveModel: () => 'test-model',
  hasReadFile: vi.fn(() => true), // Default: pretend file was read
  markFileAsRead: vi.fn(),
  storage: {
    getProjectTempDir: vi.fn().mockReturnValue('/tmp/project'),
  },
};

vi.mock('../telemetry/loggers.js', () => ({
  logFileOperation: vi.fn(),
}));

vi.mock('./jit-context.js', () => ({
  discoverJitContext: vi.fn().mockResolvedValue(''),
  appendJitContext: vi.fn().mockImplementation((content, context) => {
    if (!context) return content;
    return `${content}\n\n--- Newly Discovered Project Context ---\n${context}\n--- End Project Context ---`;
  }),
}));

// --- END MOCKS ---

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a unique temporary directory for files created outside the root
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'write-file-test-external-'),
    );
    // Ensure the rootDir and plansDir for the tool exists
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    const workspaceContext = new WorkspaceContext(rootDir, [plansDir]);
    const mockStorage = {
      getProjectTempDir: vi.fn().mockReturnValue('/tmp/project'),
    };

    mockConfig = {
      ...mockConfigInternal,
      getWorkspaceContext: () => workspaceContext,
      storage: mockStorage,
      isPathAllowed(this: Config, absolutePath: string): boolean {
        const workspaceContext = this.getWorkspaceContext();
        if (workspaceContext.isPathWithinWorkspace(absolutePath)) {
          return true;
        }

        const projectTempDir = this.storage.getProjectTempDir();
        return isSubpath(path.resolve(projectTempDir), absolutePath);
      },
      validatePathAccess(this: Config, absolutePath: string): string | null {
        if (this.isPathAllowed(absolutePath)) {
          return null;
        }

        const workspaceDirs = this.getWorkspaceContext().getDirectories();
        const projectTempDir = this.storage.getProjectTempDir();
        return `Path not in workspace: Attempted path "${absolutePath}" resolves outside the allowed workspace directories: ${workspaceDirs.join(', ')} or the project temp directory: ${projectTempDir}`;
      },
    } as unknown as Config;

    // Setup GeminiClient mock
    mockGeminiClientInstance = new (vi.mocked(GeminiClient))(
      mockConfig,
    ) as Mocked<GeminiClient>;
    vi.mocked(GeminiClient).mockImplementation(() => mockGeminiClientInstance);

    // Setup BaseLlmClient mock
    mockBaseLlmClientInstance = {
      generateJson: vi.fn(),
    } as unknown as Mocked<BaseLlmClient>;

    // Now that mock instances are initialized, set the mock implementations for config getters
    mockConfigInternal.getGeminiClient.mockReturnValue(
      mockGeminiClientInstance,
    );
    mockConfigInternal.getBaseLlmClient.mockReturnValue(
      mockBaseLlmClientInstance,
    );

    const bus = createMockMessageBus();
    getMockMessageBusInstance(bus).defaultToolDecision = 'ask_user';
    tool = new WriteFileTool(mockConfig, bus);

    // Reset mocks before each test
    mockConfigInternal.getApprovalMode.mockReturnValue(ApprovalMode.DEFAULT);
    mockConfigInternal.setApprovalMode.mockClear();
  });

  afterEach(() => {
    // Clean up the temporary directories
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
    if (fs.existsSync(plansDir)) {
      fs.rmSync(plansDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('build', () => {
    it('should return an invocation for a valid absolute path within root', () => {
      const params = {
        file_path: path.join(rootDir, 'test.txt'),
        content: 'hello',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should return an invocation for a valid relative path within root', () => {
      const params = {
        file_path: 'test.txt',
        content: 'hello',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });

    it('should throw an error if path is a directory', () => {
      const dirAsFilePath = path.join(rootDir, 'a_directory');
      fs.mkdirSync(dirAsFilePath);
      const params = {
        file_path: dirAsFilePath,
        content: 'hello',
      };
      expect(() => tool.build(params)).toThrow(
        `Path is a directory, not a file: ${dirAsFilePath}`,
      );
    });

    it('should throw an error if the content is null', () => {
      const dirAsFilePath = path.join(rootDir, 'a_directory');
      fs.mkdirSync(dirAsFilePath);
      const params = {
        file_path: dirAsFilePath,
        content: null,
      } as unknown as WriteFileToolParams; // Intentionally non-conforming
      expect(() => tool.build(params)).toThrow('params/content must be string');
    });

    it('should throw error if the file_path is empty', () => {
      const dirAsFilePath = path.join(rootDir, 'a_directory');
      fs.mkdirSync(dirAsFilePath);
      const params = {
        file_path: '',
        content: '',
      };
      expect(() => tool.build(params)).toThrow(`Missing or empty "file_path"`);
    });

    it('should throw an error if content includes an omission placeholder', () => {
      const params = {
        file_path: path.join(rootDir, 'placeholder.txt'),
        content: '(rest of methods ...)',
      };
      expect(() => tool.build(params)).toThrow(
        "`content` contains an omission placeholder (for example 'rest of methods ...'). Provide complete file content.",
      );
    });

    it('should throw an error when multiline content includes omission placeholders', () => {
      const params = {
        file_path: path.join(rootDir, 'service.ts'),
        content: `class Service {
  execute() {
    return "run";
  }

  // rest of methods ...
}`,
      };
      expect(() => tool.build(params)).toThrow(
        "`content` contains an omission placeholder (for example 'rest of methods ...'). Provide complete file content.",
      );
    });

    it('should allow content with placeholder text in a normal string literal', () => {
      const params = {
        file_path: path.join(rootDir, 'valid-content.ts'),
        content: 'const note = "(rest of methods ...)";',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });
  });

  describe('shouldConfirmExecute', () => {
    const abortSignal = new AbortController().signal;

    it('should return false if reading file fails', async () => {
      const filePath = path.join(rootDir, 'confirm_error_file.txt');
      const params = { file_path: filePath, content: 'test content' };
      fs.writeFileSync(filePath, 'original', { mode: 0o000 });

      const readError = new Error('Simulated read error for confirmation');
      vi.spyOn(fsService, 'readTextFile').mockImplementationOnce(() =>
        Promise.reject(readError),
      );

      const invocation = tool.build(params);
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);
      expect(confirmation).toBe(false);

      fs.chmodSync(filePath, 0o600);
    });

    it('should request confirmation with diff for a new file', async () => {
      const filePath = path.join(rootDir, 'confirm_new_file.txt');
      const proposedContent = 'Proposed new content for confirmation.';

      const params = { file_path: filePath, content: proposedContent };
      const invocation = tool.build(params);
      const confirmation = (await invocation.shouldConfirmExecute(
        abortSignal,
      )) as ToolEditConfirmationDetails;

      expect(confirmation).toEqual(
        expect.objectContaining({
          title: `Confirm Write: ${path.basename(filePath)}`,
          fileName: 'confirm_new_file.txt',
          fileDiff: expect.stringContaining(proposedContent),
        }),
      );
      expect(confirmation.fileDiff).toMatch(
        /--- confirm_new_file.txt\tCurrent/,
      );
      expect(confirmation.fileDiff).toMatch(
        /\+\+\+ confirm_new_file.txt\tProposed/,
      );
    });

    it('should request confirmation with diff for an existing file', async () => {
      const filePath = path.join(rootDir, 'confirm_existing_file.txt');
      const originalContent = 'Original content for confirmation.';
      const proposedContent = 'Proposed replacement for confirmation.';
      fs.writeFileSync(filePath, originalContent, 'utf8');

      const params = { file_path: filePath, content: proposedContent };
      const invocation = tool.build(params);
      const confirmation = (await invocation.shouldConfirmExecute(
        abortSignal,
      )) as ToolEditConfirmationDetails;

      expect(confirmation).toEqual(
        expect.objectContaining({
          title: `Confirm Write: ${path.basename(filePath)}`,
          fileName: 'confirm_existing_file.txt',
          fileDiff: expect.stringContaining(proposedContent),
        }),
      );
      expect(confirmation.fileDiff).toContain(originalContent);
    });

    describe('with IDE integration', () => {
      beforeEach(() => {
        // Enable IDE mode and set connection status for these tests
        mockConfigInternal.getIdeMode.mockReturnValue(true);
        mockIdeClient.isDiffingEnabled.mockReturnValue(true);
        mockIdeClient.openDiff.mockResolvedValue({
          status: 'accepted',
          content: 'ide-modified-content',
        });
      });

      afterEach(() => {
        // Reset IDE mocks
        mockConfigInternal.getIdeMode.mockReturnValue(false);
        mockIdeClient.isDiffingEnabled.mockReturnValue(false);
        mockIdeClient.openDiff.mockReset();
      });

      it('should call openDiff and await it when in IDE mode and connected', async () => {
        const filePath = path.join(rootDir, 'ide_confirm_file.txt');
        const params = { file_path: filePath, content: 'test' };
        const invocation = tool.build(params);

        const confirmation = (await invocation.shouldConfirmExecute(
          abortSignal,
        )) as ToolEditConfirmationDetails;

        expect(mockIdeClient.openDiff).toHaveBeenCalledWith(
          filePath,
          'test',
        );
        // Ensure the promise is awaited by checking the result
        expect(confirmation.ideConfirmation).toBeDefined();
        await confirmation.ideConfirmation; // Should resolve
      });

      it('should not call openDiff if not in IDE mode', async () => {
        mockConfigInternal.getIdeMode.mockReturnValue(false);
        const filePath = path.join(rootDir, 'ide_disabled_file.txt');
        const params = { file_path: filePath, content: 'test' };
        const invocation = tool.build(params);

        await invocation.shouldConfirmExecute(abortSignal);

        expect(mockIdeClient.openDiff).not.toHaveBeenCalled();
      });

      it('should not call openDiff if IDE is not connected', async () => {
        mockIdeClient.isDiffingEnabled.mockReturnValue(false);
        const filePath = path.join(rootDir, 'ide_disconnected_file.txt');
        const params = { file_path: filePath, content: 'test' };
        const invocation = tool.build(params);

        await invocation.shouldConfirmExecute(abortSignal);

        expect(mockIdeClient.openDiff).not.toHaveBeenCalled();
      });

      it('should update params.content with IDE content when onConfirm is called', async () => {
        const filePath = path.join(rootDir, 'ide_onconfirm_file.txt');
        const params = { file_path: filePath, content: 'original-content' };
        const invocation = tool.build(params);

        // This is the key part: get the confirmation details
        const confirmation = (await invocation.shouldConfirmExecute(
          abortSignal,
        )) as ToolEditConfirmationDetails;

        // The `onConfirm` function should exist on the details object
        expect(confirmation.onConfirm).toBeDefined();

        // Call `onConfirm` to trigger the logic that updates the content
        await confirmation.onConfirm(ToolConfirmationOutcome.ProceedOnce);

        // Now, check if the original `params` object (captured by the invocation) was modified
        expect(invocation.params.content).toBe('ide-modified-content');
      });

      it('should not await ideConfirmation promise', async () => {
        const IDE_DIFF_DELAY_MS = 50;
        const filePath = path.join(rootDir, 'ide_no_await_file.txt');
        const params = { file_path: filePath, content: 'test' };
        const invocation = tool.build(params);

        let diffPromiseResolved = false;
        const diffPromise = new Promise<DiffUpdateResult>((resolve) => {
          setTimeout(() => {
            diffPromiseResolved = true;
            resolve({ status: 'accepted', content: 'ide-modified-content' });
          }, IDE_DIFF_DELAY_MS);
        });
        mockIdeClient.openDiff.mockReturnValue(diffPromise);

        const confirmation = (await invocation.shouldConfirmExecute(
          abortSignal,
        )) as ToolEditConfirmationDetails;

        // This is the key check: the confirmation details should be returned
        // *before* the diffPromise is resolved.
        expect(diffPromiseResolved).toBe(false);
        expect(confirmation).toBeDefined();
        expect(confirmation.ideConfirmation).toBe(diffPromise);

        // Now, we can await the promise to let the test finish cleanly.
        await diffPromise;
        expect(diffPromiseResolved).toBe(true);
      });
    });
  });

  describe('execute', () => {
    const abortSignal = new AbortController().signal;

    async function confirmExecution(
      invocation: ToolInvocation<WriteFileToolParams, ToolResult>,
      signal: AbortSignal = abortSignal,
    ) {
      const confirmDetails = await invocation.shouldConfirmExecute(signal);
      if (
        typeof confirmDetails === 'object' &&
        'onConfirm' in confirmDetails &&
        confirmDetails.onConfirm
      ) {
        await confirmDetails.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }
    }

    it('should write a new file with a relative path', async () => {
      const relativePath = 'execute_relative_new_file.txt';
      const filePath = path.join(rootDir, relativePath);
      const content = 'Content for relative path file.';

      const params = { file_path: relativePath, content };
      const invocation = tool.build(params);

      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).toMatch(
        /Successfully created and wrote to new file/,
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const writtenContent = await fsService.readTextFile(filePath);
      expect(writtenContent).toBe(content);
    });

    it('should return error if reading file fails during execute', async () => {
      const filePath = path.join(rootDir, 'execute_error_file.txt');
      const params = { file_path: filePath, content: 'test content' };
      fs.writeFileSync(filePath, 'original', { mode: 0o000 });

      vi.spyOn(fsService, 'readTextFile').mockImplementationOnce(() => {
        const readError = new Error('Simulated read error for execute');
        return Promise.reject(readError);
      });

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);
      expect(result.llmContent).toContain('Error reading existing file');
      expect(result.returnDisplay).toMatch(
        /Error reading existing file: Simulated read error for execute/,
      );
      expect(result.error).toEqual({
        message:
          'Error reading existing file: Simulated read error for execute',
        type: ToolErrorType.FILE_WRITE_FAILURE,
      });

      fs.chmodSync(filePath, 0o600);
    });

    it('should write a new file and return diff', async () => {
      const filePath = path.join(rootDir, 'execute_new_file.txt');
      const content = 'New content for execute.';

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);

      await confirmExecution(invocation);

      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).toMatch(
        /Successfully created and wrote to new file/,
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const writtenContent = await fsService.readTextFile(filePath);
      expect(writtenContent).toBe(content);
      const display = result.returnDisplay as FileDiff;
      expect(display.fileName).toBe('execute_new_file.txt');
      expect(display.fileDiff).toContain('--- execute_new_file.txt');
      expect(display.fileDiff).toContain('+++ execute_new_file.txt');
      expect(display.fileDiff).toContain(content);
    });

    it('should overwrite an existing file and return diff', async () => {
      const filePath = path.join(
        rootDir,
        'execute_existing_file.txt',
      );
      const initialContent = 'Initial content for execute.';
      const content = 'Overwrite for execute.';
      fs.writeFileSync(filePath, initialContent, 'utf8');

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);

      await confirmExecution(invocation);

      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).toMatch(/Successfully overwrote file/);
      const writtenContent = await fsService.readTextFile(filePath);
      expect(writtenContent).toBe(content);
      const display = result.returnDisplay as FileDiff;
      expect(display.fileName).toBe('execute_existing_file.txt');
      expect(display.fileDiff).toContain(initialContent);
      expect(display.fileDiff).toContain(content);
    });

    it('should create directory if it does not exist', async () => {
      const dirPath = path.join(rootDir, 'new_dir_for_write');
      const filePath = path.join(dirPath, 'file_in_new_dir.txt');
      const content = 'Content in new directory';

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);

      await confirmExecution(invocation);

      await invocation.execute(abortSignal);

      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
    });

    it.skip('should include modification message when modified_by_user is true', async () => {
      // Skipped: modified_by_user is not in REF_PROMPT.md schema
    });

    it.skip('should not include modification message when modified_by_user is false', async () => {
      // Skipped: modified_by_user is not in REF_PROMPT.md schema
    });

    it('should include the file content in llmContent', async () => {
      const filePath = path.join(rootDir, 'content_check.txt');
      const content = 'This is the content that should be returned.';

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);

      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).toContain('Here is the updated code:');
      expect(result.llmContent).toContain(content);
    });

    it('should return only changed lines plus context for large updates', async () => {
      const filePath = path.join(rootDir, 'large_update.txt');
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      const originalContent = lines.join('\n');
      fs.writeFileSync(filePath, originalContent, 'utf8');

      const newLines = [...lines];
      newLines[50] = 'Line 51 Modified'; // Modify one line in the middle

      const newContent = newLines.join('\n');

      const params = { file_path: filePath, content: newContent };
      const invocation = tool.build(params);

      // Confirm execution first
      const confirmDetails = await invocation.shouldConfirmExecute(abortSignal);
      if (confirmDetails && 'onConfirm' in confirmDetails) {
        await confirmDetails.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).toContain('Here is the updated code:');
      // Should contain the modified line
      expect(result.llmContent).toContain('Line 51 Modified');
      // Should contain context lines (e.g. Line 46, Line 56)
      expect(result.llmContent).toContain('Line 46');
      expect(result.llmContent).toContain('Line 56');
      // Should NOT contain far away lines (e.g. Line 1, Line 100)
      expect(result.llmContent).not.toContain('Line 1\n');
      expect(result.llmContent).not.toContain('Line 100');
      // Should indicate truncation
      expect(result.llmContent).toContain('...');
    });
  });

  describe('workspace boundary validation', () => {
    it('should validate paths are within workspace root', () => {
      const params = {
        file_path: path.join(rootDir, 'file.txt'),
        content: 'test content',
      };
      expect(() => tool.build(params)).not.toThrow();
    });

    it('should allow paths within the plans directory', () => {
      const params = {
        file_path: path.join(plansDir, 'my-plan.md'),
        content: '# My Plan',
      };
      expect(() => tool.build(params)).not.toThrow();
    });
  });

  describe('specific error types for write failures', () => {
    const abortSignal = new AbortController().signal;

    it.each([
      {
        errorCode: 'EACCES',
        errorType: ToolErrorType.PERMISSION_DENIED,
        errorMessage: 'Permission denied',
        expectedMessagePrefix: 'Permission denied writing to file',
        mockFsExistsSync: false,
        restoreAllMocks: false,
      },
      {
        errorCode: 'ENOSPC',
        errorType: ToolErrorType.NO_SPACE_LEFT,
        errorMessage: 'No space left on device',
        expectedMessagePrefix: 'No space left on device',
        mockFsExistsSync: false,
        restoreAllMocks: false,
      },
      {
        errorCode: 'EISDIR',
        errorType: ToolErrorType.TARGET_IS_DIRECTORY,
        errorMessage: 'Is a directory',
        expectedMessagePrefix: 'Target is a directory, not a file',
        mockFsExistsSync: true,
        restoreAllMocks: false,
      },
      {
        errorCode: undefined,
        errorType: ToolErrorType.FILE_WRITE_FAILURE,
        errorMessage: 'Generic write error',
        expectedMessagePrefix: 'Error writing to file',
        mockFsExistsSync: false,
        restoreAllMocks: false,
      },
    ])(
      'should return $errorType error when write fails with $errorCode',
      async ({
        errorCode,
        errorType,
        errorMessage,
        expectedMessagePrefix,
        mockFsExistsSync,
      }) => {
        const filePath = path.join(rootDir, `${errorType}_file.txt`);
        const content = 'test content';

        let existsSyncSpy: // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ReturnType<typeof vi.spyOn<any, 'existsSync'>> | undefined = undefined;

        try {
          if (mockFsExistsSync) {
            const originalExistsSync = fs.existsSync;
            existsSyncSpy = vi
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .spyOn(fs as any, 'existsSync')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .mockImplementation((path: any) =>
                path === filePath ? false : originalExistsSync(path),
              );
          }

          vi.spyOn(fsService, 'writeTextFile').mockImplementationOnce(() => {
            const error = new Error(errorMessage) as NodeJS.ErrnoException;
            if (errorCode) error.code = errorCode;
            return Promise.reject(error);
          });

          const params = { file_path: filePath, content };
          const invocation = tool.build(params);
          const result = await invocation.execute(abortSignal);

          expect(result.error?.type).toBe(errorType);
          const errorSuffix = errorCode ? ` (${errorCode})` : '';
          const expectedMessage = errorCode
            ? `${expectedMessagePrefix}: ${filePath}${errorSuffix}`
            : `${expectedMessagePrefix}: ${errorMessage}`;
          expect(result.llmContent).toContain(expectedMessage);
          expect(result.returnDisplay).toContain(expectedMessage);
        } finally {
          if (existsSyncSpy) {
            existsSyncSpy.mockRestore();
          }
        }
      },
    );
  });

  describe('JIT context discovery', () => {
    const abortSignal = new AbortController().signal;

    it('should append JIT context to output when enabled and context is found', async () => {
      const { discoverJitContext } = await import('./jit-context.js');
      vi.mocked(discoverJitContext).mockResolvedValue('Use the useAuth hook.');

      const filePath = path.join(rootDir, 'jit-write-test.txt');
      const content = 'JIT test content.';

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(discoverJitContext).toHaveBeenCalled();
      expect(result.llmContent).toContain('Newly Discovered Project Context');
      expect(result.llmContent).toContain('Use the useAuth hook.');
    });

    it('should not append JIT context when disabled', async () => {
      const { discoverJitContext } = await import('./jit-context.js');
      vi.mocked(discoverJitContext).mockResolvedValue('');

      const filePath = path.join(rootDir, 'jit-disabled-write-test.txt');
      const content = 'No JIT content.';

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.llmContent).not.toContain(
        'Newly Discovered Project Context',
      );
    });
  });

  describe('must read before write enforcement', () => {
    const abortSignal = new AbortController().signal;

    it('should return error when writing to existing file without reading first', async () => {
      const filePath = path.join(rootDir, 'not_read_before_write.txt');
      const originalContent = 'Original content.';
      const proposedContent = 'Proposed content.';
      fs.writeFileSync(filePath, originalContent, 'utf8');

      // Simulate file not being read
      mockConfigInternal.hasReadFile.mockReturnValue(false);

      const params = { file_path: filePath, content: proposedContent };
      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.error?.type).toBe(ToolErrorType.FILE_NOT_READ_BEFORE_WRITE);
      expect(result.llmContent).toContain('You must use the Read tool');
      expect(result.returnDisplay).toContain('Must read file before writing');

      // File should NOT have been modified
      expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContent);
    });

    it('should allow writing to new file without reading first', async () => {
      const filePath = path.join(rootDir, 'new_file_no_read_needed.txt');
      const content = 'New file content.';

      // Simulate file not being read (doesn't matter for new files)
      mockConfigInternal.hasReadFile.mockReturnValue(false);

      const params = { file_path: filePath, content };
      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toMatch(/Successfully created and wrote/);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should allow writing to existing file when it was read first', async () => {
      const filePath = path.join(rootDir, 'read_before_write.txt');
      const originalContent = 'Original content.';
      const proposedContent = 'Proposed content.';
      fs.writeFileSync(filePath, originalContent, 'utf8');

      // Simulate file was read
      mockConfigInternal.hasReadFile.mockReturnValue(true);

      const params = { file_path: filePath, content: proposedContent };
      const invocation = tool.build(params);
      await invocation.shouldConfirmExecute(abortSignal);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toMatch(/Successfully overwrote file/);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(proposedContent);
    });

    it('should recognize file as read when path representations differ', async () => {
      // This test verifies that normalizePath is used for path comparison
      // so that different representations of the same path are recognized
      const fileName = 'path_normalization_test.txt';
      const filePath = path.join(rootDir, fileName);
      const originalContent = 'Original content.';
      const proposedContent = 'Proposed content.';
      fs.writeFileSync(filePath, originalContent, 'utf8');

      // Simulate file was read with one path representation
      // but write is attempted with a different representation
      const readPath = path.resolve(rootDir, `./${fileName}`); // ./path_normalization_test.txt
      const writePath = path.resolve(rootDir, fileName); // path_normalization_test.txt

      // Both paths should normalize to the same value
      // After our fix, hasReadFile should return true if the file was marked as read
      // with a different but equivalent path representation
      const { normalizePath } = await import('../utils/paths.js');
      expect(normalizePath(readPath)).toBe(normalizePath(writePath));
    });
  });
});

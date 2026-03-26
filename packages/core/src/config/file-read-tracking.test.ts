/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { normalizePath } from '../utils/paths.js';

// Simple test for the normalizePath behavior in hasReadFile/markFileAsRead
// This tests the path normalization logic without needing a full Config instance

describe('file read tracking path normalization', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-read-test-'));

  afterEach(() => {
    // Clean up temp files
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
  });

  afterAll(() => {
    fs.rmdirSync(tempDir);
  });

  it('normalizePath should handle different path representations', () => {
    const fileName = 'test.txt';
    const filePath = path.join(tempDir, fileName);

    // Different ways to represent the same path
    const paths = [
      filePath,
      path.resolve(tempDir, fileName),
      path.resolve(tempDir, `./${fileName}`),
      `${tempDir}/${fileName}`,
    ];

    // All should normalize to the same value
    const normalizedValues = paths.map((p) => normalizePath(p));
    const uniqueValues = new Set(normalizedValues);

    expect(uniqueValues.size).toBe(1);
  });

  it('normalizePath should handle relative path components', () => {
    const fileName = 'test.txt';
    const filePath = path.join(tempDir, 'subdir', '..', fileName);

    // Create subdir temporarily
    const subdir = path.join(tempDir, 'subdir');
    fs.mkdirSync(subdir, { recursive: true });

    const normalizedWithDots = normalizePath(filePath);
    const normalizedDirect = normalizePath(path.join(tempDir, fileName));

    expect(normalizedWithDots).toBe(normalizedDirect);

    // Cleanup
    fs.rmdirSync(subdir);
  });

  it('normalizePath should handle trailing slashes consistently', () => {
    const pathWithSlash = `${tempDir}/`;
    const pathWithoutSlash = tempDir;

    expect(normalizePath(pathWithSlash)).toBe(normalizePath(pathWithoutSlash));
  });

  it('should work with Set-based tracking using normalized paths', () => {
    // Simulate the actual behavior in Config
    const readFiles: Set<string> = new Set();

    const fileName = 'tracked.txt';
    const filePath1 = path.join(tempDir, fileName);
    const filePath2 = path.resolve(tempDir, `./${fileName}`);

    // Mark as read with first path representation
    readFiles.add(normalizePath(filePath1));

    // Check with second path representation
    expect(readFiles.has(normalizePath(filePath2))).toBe(true);

    // Check with a different file
    const otherPath = path.join(tempDir, 'other.txt');
    expect(readFiles.has(normalizePath(otherPath))).toBe(false);
  });
});
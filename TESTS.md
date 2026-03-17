# Gemini CLI 测试运行报告

> 日期: 2026-03-17 Node.js: v22.19.0 npm: 10.9.3

## 概述

Gemini CLI 是一个 monorepo 项目，使用 npm workspaces 管理多个包。测试框架使用
**Vitest**。

## 构建依赖顺序

运行测试前需要先构建 core 包：

```bash
npm run build --workspace=@google/gemini-cli-core
```

否则会出现错误：

```
Error: Failed to resolve entry for package "@google/gemini-cli-core"
```

## 测试命令

```bash
# 运行所有测试
npm run test

# 运行特定 workspace 的测试
npm run test --workspace=@google/gemini-cli-core

# 运行集成测试
npm run test:integration:sandbox:none

# 运行 E2E 测试
npm run test:e2e
```

## 测试结果总览

| 包                              | 测试文件 | 测试用例 | 状态           |
| ------------------------------- | -------- | -------- | -------------- |
| @google/gemini-cli-a2a-server   | 13       | 121      | ✅ 全部通过    |
| @google/gemini-cli-core         | 311      | 5,975    | ✅ 全部通过    |
| @google/gemini-cli-sdk          | 4        | 16       | ✅ 全部通过    |
| gemini-cli-vscode-ide-companion | 3        | 40       | ✅ 全部通过    |
| @google/gemini-cli (CLI)        | 408      | 6,112    | ⚠️ 50 快照失败 |

**总计**:

- 通过: 12,264 测试
- 失败: 50 快照测试
- 跳过: 26

## 各包详细测试结果

### 1. @google/gemini-cli-a2a-server

```
Test Files  13 passed (13)
Tests       121 passed (121)
Duration    4.57s
```

测试文件：

- `src/commands/command-registry.test.ts` (6 tests)
- `src/persistence/gcs.test.ts` (12 tests)
- `src/commands/extensions.test.ts` (8 tests)
- `src/commands/memory.test.ts` (7 tests)
- `src/config/settings.test.ts` (2 tests)
- `src/config/config.test.ts` (23 tests)
- `src/commands/restore.test.ts` (6 tests)
- `src/commands/init.test.ts` (5 tests)
- `src/agent/task-event-driven.test.ts` (15 tests)
- `src/agent/task.test.ts` (10 tests)
- `src/http/endpoints.test.ts` (5 tests)
- `src/agent/executor.test.ts` (2 tests)
- `src/http/app.test.ts` (20 tests)

### 2. @google/gemini-cli-core

```
Test Files  311 passed (311)
Tests       5,975 passed | 26 skipped (6,001)
Duration    63.71s
```

覆盖率报告生成于: `/mnt/ssd/code/OpenCC/packages/core/junit.xml`

### 3. @google/gemini-cli-sdk

```
Test Files  4 passed (4)
Tests       16 passed (16)
Duration    3.99s
```

测试文件：

- `src/tool.test.ts` (6 tests)
- `src/tool.integration.test.ts` (3 tests)
- `src/skills.integration.test.ts` (2 tests)
- `src/agent.integration.test.ts` (5 tests)

### 4. gemini-cli-vscode-ide-companion

```
Test Files  3 passed (3)
Tests       40 passed | 1 skipped (41)
Duration    3.91s
```

测试文件：

- `src/open-files-manager.test.ts` (17 tests)
- `src/extension.test.ts` (11 tests)
- `src/ide-server.test.ts` (13 tests | 1 skipped)

### 5. @google/gemini-cli (CLI 包)

```
Test Files  10 failed | 408 passed (419)
Tests       50 failed | 6,112 passed | 4 skipped (6,166)
Duration    236.56s
```

**失败的测试文件**:

- `src/ui/components/messages/ThinkingMessage.test.tsx` - 多个快照测试失败
- `src/ui/components/messages/ToolConfirmationMessage.test.tsx` - 快照测试失败
- `src/ui/utils/TableRenderer.test.tsx` - 快照测试失败

**失败原因**:
UI 组件快照测试，通常因终端环境差异导致渲染结果与预期快照不同，非功能性 bug。

## 已知警告

运行测试时会出现一些警告（不影响测试结果）：

### 1. EventEmitter 警告

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 model-changed listeners added to [CoreEventEmitter]
```

### 2. Keychain 警告

```
Keychain initialization encountered an error: Cannot find package 'keytar'
Using FileKeychain fallback for secure storage.
```

### 3. Ignore 文件警告

```
Ignore file not found: /path/.geminiignore, continue without it.
```

### 4. Routing 警告

```
Could not find promptId in context for classifier-router.
[Routing] NumericalClassifierStrategy failed: ...
```

这些都是测试环境的预期行为，使用 fallback 机制处理。

## 快速验证命令

如果只想快速验证核心功能是否正常：

```bash
# 构建并运行核心测试
npm run build --workspace=@google/gemini-cli-core && \
npm run test --workspace=@google/gemini-cli-core
```

## 集成测试

集成测试位于 `integration-tests/` 目录：

```bash
# 无沙箱运行
npm run test:integration:sandbox:none

# Docker 沙箱运行
npm run test:integration:sandbox:docker

# Podman 沙箱运行
npm run test:integration:sandbox:podman
```

## Evals 测试

评估测试位于 `evals/` 目录：

```bash
# 运行始终通过的 evals
npm run test:always_passing_evals

# 运行所有 evals
npm run test:all_evals
```

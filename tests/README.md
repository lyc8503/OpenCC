# Tests

End-to-end tests for the src agent framework using a mock HTTP server.

## Architecture

Both the **src agent** and **Claude CLI** implementations make real HTTP requests to the same mock server for true end-to-end testing.

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│   SrcAgent      │ ─────────────────► │  Mock Server    │
│  (Python SDK)   │    /v1/messages    │  (localhost)    │
└─────────────────┘                    └─────────────────┘

┌─────────────────┐     HTTP POST      ┌─────────────────┐
│  ClaudeCliAgent │ ─────────────────► │  Mock Server    │
│   (CLI subprocess)│   /v1/messages   │  (localhost)    │
└─────────────────┘                    └─────────────────┘
```

**Note**: Claude CLI tests require client-side model validation, which may cause tests to be skipped if the CLI rejects the model before making HTTP requests.

## Structure

```
tests/
├── conftest.py          # Pytest fixtures and configuration
├── mock_server.py       # Mock HTTP server for Anthropic API
├── agent_interface.py   # Abstract interface for both implementations
├── test_e2e.py          # End-to-end tests covering all tools
└── README.md
```

## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=src --cov-report=term-missing

# Generate HTML coverage report
pytest --cov=src --cov-report=html
# Then open htmlcov/index.html

# Run only src agent tests
pytest tests/test_e2e.py -v

# Run specific test class
pytest tests/test_e2e.py::TestBashTool -v
```

## Test Coverage

The test suite covers all tools:

| Category | Tools |
|----------|-------|
| File Operations | Bash, Read, Write, Edit, Glob, Grep |
| Task Management | TaskCreate, TaskGet, TaskUpdate, TaskList |
| Scheduling | CronCreate, CronList, CronDelete |
| Todo Tracking | TodoWrite, TaskOutput, TaskStop |
| Planning | EnterPlanMode, ExitPlanMode |
| Git Worktree | EnterWorktree, ExitWorktree |
| Web | WebFetch, WebSearch |
| Interaction | AskUserQuestion |
| Notebook | NotebookEdit |
| Discovery | ToolSearch |
| Sub-agents | Agent |
| Skills | Skill |

## Requirements

- **Python 3.12+**
- **pytest** - Test framework
- **pytest-asyncio** - Async test support
- **pytest-cov** - Coverage reporting
- **httpx** - HTTP client (for mock server communication)

Install with:
```bash
pip install pytest pytest-asyncio pytest-cov httpx
```

## Claude CLI Tests

Claude CLI tests require the `claude` command to be installed:

```bash
npm install -g @anthropic-ai/claude-code
```

**Important**: Claude CLI performs client-side model validation before making HTTP requests. This means:
- The CLI may reject models before sending requests to the mock server
- Tests will be skipped if model validation fails
- For true e2e testing without these limitations, use the src agent tests
"""
Test configuration and fixtures.
"""

import pytest
import sys
import os
import shutil
import tempfile
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import tools to register them
import src.tools  # noqa: F401

from src.tools.cron import CronScheduler
from src.tools.todo import TodoManager
from src.tools.plan import PlanManager
from src.tools.worktree import WorktreeManager


# =============================================================================
# Singleton Reset (autouse)
# =============================================================================

@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset singleton instances before each test."""
    CronScheduler._instance = None
    TodoManager._instance = None
    PlanManager._instance = None
    WorktreeManager._instance = None

    CronScheduler.jobs = {}
    TodoManager.todos = []
    PlanManager.in_plan_mode = False
    PlanManager.plan_file = None
    PlanManager.plan_content = ""
    WorktreeManager.worktrees = {}
    WorktreeManager.current_worktree = None

    yield


# =============================================================================
# Temp Workspace Fixture
# =============================================================================

@pytest.fixture
def temp_workspace():
    """Create a clean isolated temporary workspace for file operations."""
    temp_dir = Path(tempfile.mkdtemp(prefix="opencc_test_"))
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


# =============================================================================
# Mock Server Fixture (for agent comparison tests only)
# =============================================================================

@pytest.fixture(scope="session")
def mock_server():
    """Start mock server for the test session."""
    from tests.mock_server import MockAnthropicServer
    server = MockAnthropicServer(port=18765)
    server.start()
    yield server
    server.stop()


@pytest.fixture
def src_agent(mock_server, temp_workspace):
    """Create src agent that connects to mock server."""
    from tests.agent_interface import SrcAgent
    agent = SrcAgent(base_url=mock_server.get_base_url())
    agent.temp_dir = temp_workspace
    agent.setup()
    yield agent
    agent.teardown()


# =============================================================================
# Helper functions for tests
# =============================================================================

def text_response(text: str):
    """Create a text response for the mock server."""
    from tests.mock_server import create_text_response
    return create_text_response(text)


def tool_response(tool_name: str, tool_input: dict, tool_id: str = None):
    """Create a tool use response for the mock server."""
    import uuid
    from tests.mock_server import create_tool_use_response
    return create_tool_use_response(tool_name, tool_input, tool_id or f"call_{uuid.uuid4().hex[:8]}")


def normalize_tools(tools: list | None) -> list:
    """Normalize tool definitions for comparison."""
    if not tools:
        return []
    normalized = []
    for tool in tools:
        t = {
            "name": tool.get("name"),
            "description": tool.get("description", ""),
            "input_schema": tool.get("input_schema", {})
        }
        normalized.append(t)
    return sorted(normalized, key=lambda x: x.get("name", ""))
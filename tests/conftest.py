"""
Pytest configuration and fixtures.
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def temp_file(temp_dir):
    """Create a temporary file for tests."""
    filepath = Path(temp_dir) / "test_file.txt"
    filepath.write_text("initial content\n")
    return str(filepath)


@pytest.fixture
def sample_python_file(temp_dir):
    """Create a sample Python file for testing."""
    filepath = Path(temp_dir) / "sample.py"
    filepath.write_text('"""Sample module."""\n\ndef hello():\n    print("hello")\n')
    return str(filepath)


@pytest.fixture
def mock_api_key():
    """Return a mock API key for testing."""
    return "test-api-key-12345"


@pytest.fixture
def mock_config():
    """Return a mock agent configuration."""
    from src.core.types import AgentConfig
    return AgentConfig(
        model="test-model",
        max_tokens=1000,
        working_directory=".",
        permission_mode="bypassPermissions"
    )
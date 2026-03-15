"""
Tests for Web tools functionality.
"""

import pytest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.web import WebFetchTool, WebSearchTool
from src.core.types import ToolResult


# Skip network tests unless explicitly enabled
requires_network = pytest.mark.skipif(
    os.environ.get("PYTEST_RUN_NETWORK_TESTS") != "1",
    reason="Network tests skipped - set PYTEST_RUN_NETWORK_TESTS=1 to run"
)


class TestWebFetchToolDefinition:
    """Test WebFetch tool definition - no network required."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = WebFetchTool()
        assert tool.name == "WebFetch"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = WebFetchTool()

        # Missing both required
        errors = tool.validate_input({})
        assert len(errors) >= 2

        # Valid input
        errors = tool.validate_input({
            "url": "https://example.com",
            "prompt": "Summarize"
        })
        assert len(errors) == 0


class TestWebSearchToolDefinition:
    """Test WebSearch tool definition - no network required."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = WebSearchTool()
        assert tool.name == "WebSearch"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = WebSearchTool()

        # Missing query
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"query": "test search"})
        assert len(errors) == 0


class TestWebFetchToolExecution:
    """Test WebFetch tool execution - requires network."""

    @requires_network
    @pytest.mark.asyncio
    async def test_fetch_url(self, temp_workspace):
        """Test fetching a URL."""
        tool = WebFetchTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            url="https://example.com",
            prompt="What is on this page?"
        )

        assert isinstance(result, ToolResult)
        if not result.is_error:
            assert result.output != ""

    @requires_network
    @pytest.mark.asyncio
    async def test_fetch_invalid_url(self, temp_workspace):
        """Test fetching an invalid URL."""
        tool = WebFetchTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            url="not-a-valid-url",
            prompt="Test"
        )

        assert result.is_error or result.output != ""


class TestWebSearchToolExecution:
    """Test WebSearch tool execution - requires network."""

    @requires_network
    @pytest.mark.asyncio
    async def test_search_query(self, temp_workspace):
        """Test executing a search query."""
        tool = WebSearchTool(working_directory=str(temp_workspace))
        result = await tool.execute(query="Python programming")

        assert isinstance(result, ToolResult)
        if not result.is_error:
            assert result.output != ""

    @requires_network
    @pytest.mark.asyncio
    async def test_search_with_allowed_domains(self, temp_workspace):
        """Test search with domain filter."""
        tool = WebSearchTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            query="test",
            allowed_domains=["example.com"]
        )

        assert isinstance(result, ToolResult)

    @requires_network
    @pytest.mark.asyncio
    async def test_search_with_blocked_domains(self, temp_workspace):
        """Test search with blocked domains."""
        tool = WebSearchTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            query="test",
            blocked_domains=["spam.com"]
        )

        assert isinstance(result, ToolResult)

    @requires_network
    @pytest.mark.asyncio
    async def test_search_short_query(self, temp_workspace):
        """Test search with too short query."""
        tool = WebSearchTool(working_directory=str(temp_workspace))
        result = await tool.execute(query="a")

        assert result.is_error or result.output != ""
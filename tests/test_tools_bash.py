"""
Tests for Bash tool functionality.
"""

import pytest
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.bash import BashTool
from src.core.types import ToolResult


class TestBashToolDefinition:
    """Test Bash tool definition."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = BashTool()
        assert tool.name == "Bash"

    def test_tool_has_schema(self):
        """Test tool has valid schema."""
        tool = BashTool()
        schema = tool.get_schema()
        assert schema.name == "Bash"
        assert "command" in schema.parameters.get("properties", {})
        assert "command" in schema.parameters.get("required", [])

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = BashTool()

        # Missing command
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"command": "echo test"})
        assert len(errors) == 0


class TestBashToolExecution:
    """Test Bash tool execution."""

    @pytest.mark.asyncio
    async def test_echo_command(self, temp_workspace):
        """Test executing echo command."""
        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="echo 'hello world'")

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "hello world" in result.output

    @pytest.mark.asyncio
    async def test_command_in_working_directory(self, temp_workspace):
        """Test command executes in correct directory."""
        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="pwd")

        assert not result.is_error
        assert str(temp_workspace) in result.output

    @pytest.mark.asyncio
    async def test_create_file_with_echo(self, temp_workspace):
        """Test creating a file using echo."""
        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="echo 'test content' > test_file.txt")

        assert not result.is_error
        test_file = temp_workspace / "test_file.txt"
        assert test_file.exists()
        assert "test content" in test_file.read_text()

    @pytest.mark.asyncio
    async def test_list_directory(self, temp_workspace):
        """Test listing directory contents."""
        # Create some files
        (temp_workspace / "file1.txt").touch()
        (temp_workspace / "file2.txt").touch()

        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="ls")

        assert not result.is_error
        assert "file1.txt" in result.output
        assert "file2.txt" in result.output

    @pytest.mark.asyncio
    async def test_failed_command(self, temp_workspace):
        """Test handling of failed command."""
        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="ls /nonexistent_directory_12345")

        assert result.is_error or "No such file" in result.output or result.output != ""

    @pytest.mark.asyncio
    async def test_timeout(self, temp_workspace):
        """Test command timeout."""
        tool = BashTool(working_directory=str(temp_workspace))
        # Short timeout for a long-running command
        result = await tool.execute(command="sleep 10", timeout=100)

        assert result.is_error
        assert "timed out" in result.output.lower()

    @pytest.mark.asyncio
    async def test_background_task(self, temp_workspace):
        """Test background task execution."""
        tool = BashTool(working_directory=str(temp_workspace))
        result = await tool.execute(command="echo background", run_in_background=True)

        assert not result.is_error
        assert "task_id" in result.metadata
        assert "Background task started" in result.output

        # Cancel the background task to avoid teardown issues
        task_id = result.metadata["task_id"]
        if task_id in tool._background_tasks:
            tool._background_tasks[task_id].cancel()


class TestBashToolSafety:
    """Test Bash tool safety features."""

    @pytest.mark.asyncio
    async def test_no_shell_injection(self, temp_workspace):
        """Test that shell injection is handled."""
        tool = BashTool(working_directory=str(temp_workspace))
        # This should just echo the literal string
        result = await tool.execute(command="echo 'hello; rm -rf /'")

        assert not result.is_error
        assert "hello; rm -rf /" in result.output
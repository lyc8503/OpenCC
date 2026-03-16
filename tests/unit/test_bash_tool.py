"""
Unit tests for Bash tool.
"""

import pytest
import asyncio
from src.tools.bash import BashTool


class TestBashTool:
    """Tests for Bash tool."""

    @pytest.fixture
    def bash_tool(self, temp_dir):
        """Create a Bash tool instance."""
        return BashTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_simple_command(self, bash_tool):
        """Test executing a simple command."""
        result = await bash_tool.execute(command="echo hello")
        assert result.is_error is False
        assert "hello" in result.output

    @pytest.mark.asyncio
    async def test_command_with_args(self, bash_tool):
        """Test command with arguments."""
        result = await bash_tool.execute(command="echo 'hello world'")
        assert result.is_error is False
        assert "hello world" in result.output

    @pytest.mark.asyncio
    async def test_command_in_working_directory(self, bash_tool, temp_dir):
        """Test command runs in correct directory."""
        result = await bash_tool.execute(command="pwd")
        assert result.is_error is False
        assert temp_dir in result.output

    @pytest.mark.asyncio
    async def test_command_timeout(self, bash_tool):
        """Test command timeout."""
        result = await bash_tool.execute(
            command="sleep 10",
            timeout=100  # 100ms
        )
        assert result.is_error is True
        assert "timed out" in result.output.lower()

    @pytest.mark.asyncio
    async def test_command_with_pipes(self, bash_tool):
        """Test command with pipes."""
        result = await bash_tool.execute(command="echo 'hello world' | grep hello")
        assert result.is_error is False
        assert "hello" in result.output

    @pytest.mark.asyncio
    async def test_command_with_stderr(self, bash_tool):
        """Test command that writes to stderr."""
        result = await bash_tool.execute(command="echo error >&2")
        assert result.is_error is False
        assert "error" in result.output

    @pytest.mark.asyncio
    async def test_failing_command(self, bash_tool):
        """Test command that fails."""
        result = await bash_tool.execute(command="ls /nonexistent_directory_12345")
        # Command fails but tool doesn't return error (it captures stderr)
        assert "No such file" in result.output or result.is_error

    @pytest.mark.asyncio
    async def test_command_with_exit_code(self, bash_tool):
        """Test command with exit code."""
        result = await bash_tool.execute(command="exit 1")
        # Exit code alone doesn't cause error
        assert result.output == "" or result.is_error is False

    @pytest.mark.asyncio
    async def test_background_command(self, bash_tool):
        """Test background command execution."""
        result = await bash_tool.execute(
            command="echo background",
            run_in_background=True
        )
        assert result.is_error is False
        assert "task_id" in result.metadata

        # Wait a bit for background task
        await asyncio.sleep(0.1)

    @pytest.mark.asyncio
    async def test_environment_variables(self, bash_tool):
        """Test command with environment variables."""
        import os
        os.environ["TEST_VAR"] = "test_value"
        result = await bash_tool.execute(command="echo $TEST_VAR")
        assert "test_value" in result.output

    @pytest.mark.asyncio
    async def test_multiline_output(self, bash_tool):
        """Test command with multiline output."""
        result = await bash_tool.execute(command="echo -e 'line1\\nline2\\nline3'")
        assert result.is_error is False
        assert "line1" in result.output
        assert "line2" in result.output

    @pytest.mark.asyncio
    async def test_unicode_output(self, bash_tool):
        """Test command with unicode output."""
        result = await bash_tool.execute(command="echo 'Hello 世界'")
        assert result.is_error is False
        assert "世界" in result.output

    @pytest.mark.asyncio
    async def test_special_characters_in_command(self, bash_tool):
        """Test command with special characters."""
        result = await bash_tool.execute(command='echo "Hello $HOME"')
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_command_with_redirects(self, bash_tool, temp_dir):
        """Test command with file redirects."""
        import os
        result = await bash_tool.execute(command=f"echo test > {temp_dir}/out.txt && cat {temp_dir}/out.txt")
        assert result.is_error is False
        assert "test" in result.output
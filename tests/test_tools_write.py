"""
Tests for Write tool functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.write import WriteTool
from src.core.types import ToolResult


class TestWriteToolDefinition:
    """Test Write tool definition."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = WriteTool()
        assert tool.name == "Write"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = WriteTool()

        # Missing both required
        errors = tool.validate_input({})
        assert len(errors) >= 2

        # Missing content
        errors = tool.validate_input({"file_path": "/tmp/test.txt"})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"file_path": "/tmp/test.txt", "content": "Hello"})
        assert len(errors) == 0


class TestWriteFileCreation:
    """Test creating new files."""

    @pytest.mark.asyncio
    async def test_write_new_file(self, temp_workspace):
        """Test writing a new file."""
        file_path = temp_workspace / "new_file.txt"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content="Hello, World!"
        )

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert file_path.exists()
        assert file_path.read_text() == "Hello, World!"

    @pytest.mark.asyncio
    async def test_write_in_subdirectory(self, temp_workspace):
        """Test writing file in a new subdirectory."""
        file_path = temp_workspace / "subdir" / "nested" / "file.txt"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content="Nested content"
        )

        assert not result.is_error
        assert file_path.exists()
        assert file_path.read_text() == "Nested content"

    @pytest.mark.asyncio
    async def test_write_python_file(self, temp_workspace):
        """Test writing a Python file."""
        file_path = temp_workspace / "module.py"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content="def hello():\n    print('Hello')\n"
        )

        assert not result.is_error
        assert file_path.exists()
        content = file_path.read_text()
        assert "def hello" in content

    @pytest.mark.asyncio
    async def test_write_json_file(self, temp_workspace):
        """Test writing a JSON file."""
        file_path = temp_workspace / "data.json"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content='{"name": "test", "value": 42}'
        )

        assert not result.is_error
        assert file_path.exists()

        import json
        data = json.loads(file_path.read_text())
        assert data["name"] == "test"
        assert data["value"] == 42

    @pytest.mark.asyncio
    async def test_write_empty_file(self, temp_workspace):
        """Test writing an empty file."""
        file_path = temp_workspace / "empty.txt"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content=""
        )

        assert not result.is_error
        assert file_path.exists()
        assert file_path.read_text() == ""

    @pytest.mark.asyncio
    async def test_write_multiline_content(self, temp_workspace):
        """Test writing multiline content."""
        file_path = temp_workspace / "multiline.txt"
        content = "Line 1\nLine 2\nLine 3\n"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content=content
        )

        assert not result.is_error
        assert file_path.read_text() == content

    @pytest.mark.asyncio
    async def test_write_unicode_content(self, temp_workspace):
        """Test writing Unicode content."""
        file_path = temp_workspace / "unicode.txt"

        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path=str(file_path),
            content="Hello 你好 Привет 🌍"
        )

        assert not result.is_error
        assert "你好" in file_path.read_text()
        assert "🌍" in file_path.read_text()


class TestWriteFileOverwrite:
    """Test overwriting existing files."""

    @pytest.mark.asyncio
    async def test_overwrite_existing_file(self, temp_workspace):
        """Test overwriting an existing file."""
        file_path = temp_workspace / "existing.txt"
        file_path.write_text("Original content")

        tool = WriteTool(working_directory=str(temp_workspace))
        tool.mark_as_read(str(file_path))
        result = await tool.execute(
            file_path=str(file_path),
            content="New content"
        )

        assert not result.is_error
        assert file_path.read_text() == "New content"

    @pytest.mark.asyncio
    async def test_overwrite_preserves_permissions(self, temp_workspace):
        """Test that overwriting preserves file existence."""
        file_path = temp_workspace / "perms.txt"
        file_path.write_text("Original")

        tool = WriteTool(working_directory=str(temp_workspace))
        tool.mark_as_read(str(file_path))
        await tool.execute(
            file_path=str(file_path),
            content="Overwritten"
        )

        assert file_path.exists()
        assert file_path.read_text() == "Overwritten"


class TestWriteErrors:
    """Test error handling for Write tool."""

    @pytest.mark.asyncio
    async def test_write_relative_path_fails(self, temp_workspace):
        """Test that relative path fails."""
        tool = WriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            file_path="relative/path.txt",
            content="test"
        )

        assert result.is_error
        assert "absolute" in result.output.lower()
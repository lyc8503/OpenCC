"""
Tests for Read tool functionality.
"""

import pytest
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.read import ReadTool
from src.core.types import ToolResult


class TestReadToolDefinition:
    """Test Read tool definition."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = ReadTool()
        assert tool.name == "Read"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = ReadTool()

        # Missing file_path
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"file_path": "/tmp/test.txt"})
        assert len(errors) == 0


class TestReadTextFiles:
    """Test reading text files."""

    @pytest.mark.asyncio
    async def test_read_simple_file(self, temp_workspace):
        """Test reading a simple text file."""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Hello, World!")

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "Hello, World!" in result.output

    @pytest.mark.asyncio
    async def test_read_multiline_file(self, temp_workspace):
        """Test reading a file with multiple lines."""
        test_file = temp_workspace / "multiline.txt"
        content = "Line 1\nLine 2\nLine 3\n"
        test_file.write_text(content)

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        assert "Line 1" in result.output
        assert "Line 2" in result.output
        assert "Line 3" in result.output

    @pytest.mark.asyncio
    async def test_read_with_line_numbers(self, temp_workspace):
        """Test that output includes line numbers."""
        test_file = temp_workspace / "numbered.txt"
        test_file.write_text("First\nSecond\nThird")

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        # Line numbers should be present (cat -n format)
        assert "1" in result.output

    @pytest.mark.asyncio
    async def test_read_with_offset(self, temp_workspace):
        """Test reading with offset."""
        test_file = temp_workspace / "offset.txt"
        test_file.write_text("Line 1\nLine 2\nLine 3\nLine 4\nLine 5")

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file), offset=3)

        assert not result.is_error
        # Should start from line 3
        assert "Line 3" in result.output

    @pytest.mark.asyncio
    async def test_read_with_limit(self, temp_workspace):
        """Test reading with limit."""
        test_file = temp_workspace / "limit.txt"
        test_file.write_text("Line 1\nLine 2\nLine 3\nLine 4\nLine 5")

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file), limit=2)

        assert not result.is_error
        assert "Line 1" in result.output
        assert "Line 2" in result.output


class TestReadFileErrors:
    """Test error handling for Read tool."""

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self, temp_workspace):
        """Test reading a file that doesn't exist."""
        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(temp_workspace / "nonexistent.txt"))

        assert result.is_error
        assert "does not exist" in result.output.lower() or "error" in result.output.lower()

    @pytest.mark.asyncio
    async def test_read_directory(self, temp_workspace):
        """Test reading a directory (should fail)."""
        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(temp_workspace))

        assert result.is_error
        assert "directory" in result.output.lower()

    @pytest.mark.asyncio
    async def test_read_relative_path(self, temp_workspace):
        """Test reading with relative path (should fail)."""
        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path="relative/path.txt")

        assert result.is_error
        assert "absolute" in result.output.lower()


class TestReadSpecialFiles:
    """Test reading special file types."""

    @pytest.mark.asyncio
    async def test_read_python_file(self, temp_workspace):
        """Test reading a Python file."""
        test_file = temp_workspace / "test.py"
        test_file.write_text("def hello():\n    print('Hello')\n")

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        assert "def hello" in result.output

    @pytest.mark.asyncio
    async def test_read_json_file(self, temp_workspace):
        """Test reading a JSON file."""
        test_file = temp_workspace / "test.json"
        test_file.write_text('{"key": "value"}')

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        assert "key" in result.output

    @pytest.mark.asyncio
    async def test_read_notebook_file(self, temp_workspace):
        """Test reading a Jupyter notebook file."""
        test_file = temp_workspace / "test.ipynb"
        notebook = {
            "cells": [
                {"cell_type": "code", "source": ["print('hello')"], "outputs": []}
            ],
            "metadata": {}
        }
        test_file.write_text(json.dumps(notebook))

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        assert "Code Cell" in result.output or "print" in result.output

    @pytest.mark.asyncio
    async def test_read_image_file(self, temp_workspace):
        """Test reading an image file."""
        # Create a minimal PNG file
        import base64
        test_file = temp_workspace / "test.png"
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        test_file.write_bytes(png_data)

        tool = ReadTool(working_directory=str(temp_workspace))
        result = await tool.execute(file_path=str(test_file))

        assert not result.is_error
        assert result.metadata.get("type") == "image" or "Image" in result.output
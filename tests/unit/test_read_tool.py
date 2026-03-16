"""
Unit tests for Read tool.
"""

import pytest
import tempfile
from pathlib import Path
from src.tools.read import ReadTool
from src.tools.edit import EditTool


class TestReadTool:
    """Tests for Read tool."""

    @pytest.fixture
    def read_tool(self, temp_dir):
        """Create a Read tool instance."""
        return ReadTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_read_text_file(self, read_tool, temp_file):
        """Test reading a text file."""
        result = await read_tool.execute(file_path=temp_file)
        assert result.is_error is False
        assert "initial content" in result.output

    @pytest.mark.asyncio
    async def test_read_marks_file_for_edit(self, read_tool, temp_file):
        """Test that reading marks file for editing."""
        await read_tool.execute(file_path=temp_file)
        assert EditTool.is_read(temp_file)

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self, read_tool, temp_dir):
        """Test reading a non-existent file."""
        result = await read_tool.execute(file_path=f"{temp_dir}/nonexistent.txt")
        assert result.is_error is True
        assert "does not exist" in result.output

    @pytest.mark.asyncio
    async def test_read_directory(self, read_tool, temp_dir):
        """Test reading a directory."""
        result = await read_tool.execute(file_path=temp_dir)
        assert result.is_error is True
        assert "is a directory" in result.output

    @pytest.mark.asyncio
    async def test_read_relative_path(self, read_tool):
        """Test reading with relative path."""
        result = await read_tool.execute(file_path="relative/path.txt")
        assert result.is_error is True
        assert "absolute path" in result.output

    @pytest.mark.asyncio
    async def test_read_with_offset(self, read_tool, temp_dir):
        """Test reading with offset."""
        filepath = Path(temp_dir) / "multi_line.txt"
        filepath.write_text("line1\nline2\nline3\nline4\nline5\n")

        result = await read_tool.execute(file_path=str(filepath), offset=2)
        assert result.is_error is False
        assert "line2" in result.output
        assert "line1" not in result.output

    @pytest.mark.asyncio
    async def test_read_with_limit(self, read_tool, temp_dir):
        """Test reading with limit."""
        filepath = Path(temp_dir) / "multi_line.txt"
        filepath.write_text("line1\nline2\nline3\nline4\nline5\n")

        result = await read_tool.execute(file_path=str(filepath), limit=2)
        assert result.is_error is False
        assert "line1" in result.output
        assert "line2" in result.output
        assert "line3" not in result.output

    @pytest.mark.asyncio
    async def test_read_with_offset_and_limit(self, read_tool, temp_dir):
        """Test reading with offset and limit."""
        filepath = Path(temp_dir) / "multi_line.txt"
        filepath.write_text("line1\nline2\nline3\nline4\nline5\n")

        result = await read_tool.execute(file_path=str(filepath), offset=2, limit=2)
        assert result.is_error is False
        assert "line2" in result.output
        assert "line3" in result.output
        assert "line1" not in result.output
        assert "line4" not in result.output

    @pytest.mark.asyncio
    async def test_read_empty_file(self, read_tool, temp_dir):
        """Test reading an empty file."""
        filepath = Path(temp_dir) / "empty.txt"
        filepath.write_text("")

        result = await read_tool.execute(file_path=str(filepath))
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_read_unicode_file(self, read_tool, temp_dir):
        """Test reading a file with unicode content."""
        filepath = Path(temp_dir) / "unicode.txt"
        filepath.write_text("Hello 世界 🌍\nПривет мир\n")

        result = await read_tool.execute(file_path=str(filepath))
        assert result.is_error is False
        assert "世界" in result.output

    @pytest.mark.asyncio
    async def test_read_python_file(self, read_tool, sample_python_file):
        """Test reading a Python file."""
        result = await read_tool.execute(file_path=sample_python_file)
        assert result.is_error is False
        assert "def hello" in result.output

    @pytest.mark.asyncio
    async def test_read_image_file(self, read_tool, temp_dir):
        """Test reading an image file."""
        # Create a minimal PNG
        filepath = Path(temp_dir) / "test.png"
        # Minimal PNG header
        filepath.write_bytes(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)

        result = await read_tool.execute(file_path=str(filepath))
        assert result.is_error is False
        assert result.metadata.get("type") == "image"

    @pytest.mark.asyncio
    async def test_read_jupyter_notebook(self, read_tool, temp_dir):
        """Test reading a Jupyter notebook."""
        import json
        filepath = Path(temp_dir) / "notebook.ipynb"
        notebook = {
            "cells": [
                {
                    "cell_type": "code",
                    "id": "cell-1",
                    "source": ["print('hello')"],
                    "outputs": []
                },
                {
                    "cell_type": "markdown",
                    "id": "cell-2",
                    "source": ["# Title"],
                }
            ]
        }
        filepath.write_text(json.dumps(notebook))

        result = await read_tool.execute(file_path=str(filepath))
        assert result.is_error is False
        assert "Code Cell" in result.output
        assert "Markdown Cell" in result.output

    @pytest.mark.asyncio
    async def test_line_number_format(self, read_tool, temp_file):
        """Test that line numbers are formatted correctly."""
        result = await read_tool.execute(file_path=temp_file)
        # Should have line numbers in cat -n format
        assert "1" in result.output  # Line number 1
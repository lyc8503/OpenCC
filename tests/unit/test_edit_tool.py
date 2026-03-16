"""
Unit tests for Edit tool.
"""

import pytest
from pathlib import Path
from src.tools.edit import EditTool
from src.tools.read import ReadTool


class TestEditTool:
    """Tests for Edit tool."""

    @pytest.fixture
    def edit_tool(self, temp_dir):
        """Create an Edit tool instance."""
        return EditTool(working_directory=temp_dir)

    @pytest.fixture
    def read_tool(self, temp_dir):
        """Create a Read tool instance."""
        return ReadTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_edit_simple_replacement(self, edit_tool, read_tool, temp_dir):
        """Test simple string replacement."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello World")

        # Read file first (required)
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="World",
            new_string="Universe"
        )
        assert result.is_error is False
        assert filepath.read_text() == "Hello Universe"

    @pytest.mark.asyncio
    async def test_edit_without_read_fails(self, edit_tool, temp_dir):
        """Test that editing without reading first fails."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("content")

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="content",
            new_string="new content"
        )
        assert result.is_error is True
        assert "read file first" in result.output.lower()

    @pytest.mark.asyncio
    async def test_edit_nonexistent_file(self, edit_tool, temp_dir):
        """Test editing a non-existent file."""
        EditTool.mark_as_read(f"{temp_dir}/nonexistent.txt")

        result = await edit_tool.execute(
            file_path=f"{temp_dir}/nonexistent.txt",
            old_string="old",
            new_string="new"
        )
        assert result.is_error is True
        assert "does not exist" in result.output

    @pytest.mark.asyncio
    async def test_edit_old_string_not_found(self, edit_tool, read_tool, temp_dir):
        """Test when old_string is not found."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello World")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="Goodbye",
            new_string="Hello"
        )
        assert result.is_error is True
        assert "not found" in result.output

    @pytest.mark.asyncio
    async def test_edit_identical_strings(self, edit_tool, read_tool, temp_dir):
        """Test when old_string and new_string are identical."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello World")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="Hello",
            new_string="Hello"
        )
        assert result.is_error is True
        assert "identical" in result.output

    @pytest.mark.asyncio
    async def test_edit_multiple_occurrences_fails(self, edit_tool, read_tool, temp_dir):
        """Test that multiple occurrences fail without replace_all."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello Hello Hello")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="Hello",
            new_string="Hi"
        )
        assert result.is_error is True
        assert "3 times" in result.output

    @pytest.mark.asyncio
    async def test_edit_replace_all(self, edit_tool, read_tool, temp_dir):
        """Test replace_all flag."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello Hello Hello")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="Hello",
            new_string="Hi",
            replace_all=True
        )
        assert result.is_error is False
        assert filepath.read_text() == "Hi Hi Hi"

    @pytest.mark.asyncio
    async def test_edit_preserves_indentation(self, edit_tool, read_tool, temp_dir):
        """Test that indentation is preserved."""
        filepath = Path(temp_dir) / "test.py"
        filepath.write_text("def hello():\n    print('world')\n")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="    print('world')",
            new_string="    print('hello')"
        )
        assert result.is_error is False
        assert "    print('hello')" in filepath.read_text()

    @pytest.mark.asyncio
    async def test_edit_multiline_string(self, edit_tool, read_tool, temp_dir):
        """Test replacing multiline strings."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("line1\nline2\nline3\n")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="line1\nline2",
            new_string="replaced"
        )
        assert result.is_error is False
        assert filepath.read_text() == "replaced\nline3\n"

    @pytest.mark.asyncio
    async def test_edit_relative_path_fails(self, edit_tool):
        """Test that relative path fails."""
        result = await edit_tool.execute(
            file_path="relative/path.txt",
            old_string="old",
            new_string="new"
        )
        assert result.is_error is True
        assert "absolute path" in result.output

    @pytest.mark.asyncio
    async def test_edit_with_special_characters(self, edit_tool, read_tool, temp_dir):
        """Test editing with special characters."""
        filepath = Path(temp_dir) / "test.txt"
        filepath.write_text("Hello $USER\nPath: /home/user\n")
        await read_tool.execute(file_path=str(filepath))

        result = await edit_tool.execute(
            file_path=str(filepath),
            old_string="$USER",
            new_string="$HOME"
        )
        assert result.is_error is False
        assert "$HOME" in filepath.read_text()

    @pytest.mark.asyncio
    async def test_mark_and_check_read(self, temp_dir):
        """Test marking and checking if file was read."""
        filepath = f"{temp_dir}/test.txt"

        assert EditTool.is_read(filepath) is False
        EditTool.mark_as_read(filepath)
        assert EditTool.is_read(filepath) is True
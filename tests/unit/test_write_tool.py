"""
Unit tests for Write tool.
"""

import pytest
from pathlib import Path
from src.tools.write import WriteTool


class TestWriteTool:
    """Tests for Write tool."""

    @pytest.fixture
    def write_tool(self, temp_dir):
        """Create a Write tool instance."""
        return WriteTool(working_directory=temp_dir)

    @pytest.fixture
    def read_tool(self, temp_dir):
        """Create a Read tool instance."""
        from src.tools.read import ReadTool
        return ReadTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_write_new_file(self, write_tool, temp_dir):
        """Test writing a new file."""
        filepath = Path(temp_dir) / "new_file.txt"
        result = await write_tool.execute(
            file_path=str(filepath),
            content="Hello, World!"
        )
        assert result.is_error is False
        assert filepath.exists()
        assert filepath.read_text() == "Hello, World!"

    @pytest.mark.asyncio
    async def test_write_overwrites_existing(self, write_tool, read_tool, temp_dir):
        """Test that write overwrites existing file."""
        filepath = Path(temp_dir) / "existing.txt"
        filepath.write_text("old content")

        # Read file first (required for existing files)
        await read_tool.execute(file_path=str(filepath))

        result = await write_tool.execute(
            file_path=str(filepath),
            content="new content"
        )
        assert result.is_error is False
        assert filepath.read_text() == "new content"

    @pytest.mark.asyncio
    async def test_write_in_subdirectory(self, write_tool, temp_dir):
        """Test writing to a file in a subdirectory."""
        filepath = Path(temp_dir) / "subdir" / "file.txt"
        result = await write_tool.execute(
            file_path=str(filepath),
            content="nested content"
        )
        assert result.is_error is False
        assert filepath.exists()

    @pytest.mark.asyncio
    async def test_write_deep_nested_subdirectory(self, write_tool, temp_dir):
        """Test writing to deeply nested subdirectory."""
        filepath = Path(temp_dir) / "a" / "b" / "c" / "file.txt"
        result = await write_tool.execute(
            file_path=str(filepath),
            content="deep content"
        )
        assert result.is_error is False
        assert filepath.exists()

    @pytest.mark.asyncio
    async def test_write_relative_path_fails(self, write_tool):
        """Test that relative path fails."""
        result = await write_tool.execute(
            file_path="relative/path.txt",
            content="content"
        )
        assert result.is_error is True
        assert "absolute path" in result.output

    @pytest.mark.asyncio
    async def test_write_empty_content(self, write_tool, temp_dir):
        """Test writing empty content."""
        filepath = Path(temp_dir) / "empty.txt"
        result = await write_tool.execute(
            file_path=str(filepath),
            content=""
        )
        assert result.is_error is False
        assert filepath.exists()
        assert filepath.read_text() == ""

    @pytest.mark.asyncio
    async def test_write_multiline_content(self, write_tool, temp_dir):
        """Test writing multiline content."""
        filepath = Path(temp_dir) / "multiline.txt"
        content = "line1\nline2\nline3\n"
        result = await write_tool.execute(
            file_path=str(filepath),
            content=content
        )
        assert result.is_error is False
        assert filepath.read_text() == content

    @pytest.mark.asyncio
    async def test_write_unicode_content(self, write_tool, temp_dir):
        """Test writing unicode content."""
        filepath = Path(temp_dir) / "unicode.txt"
        content = "Hello 世界 🌍\nПривет мир"
        result = await write_tool.execute(
            file_path=str(filepath),
            content=content
        )
        assert result.is_error is False
        assert filepath.read_text() == content

    @pytest.mark.asyncio
    async def test_write_python_file(self, write_tool, temp_dir):
        """Test writing a Python file."""
        filepath = Path(temp_dir) / "script.py"
        content = '"""Module docstring."""\n\ndef main():\n    print("hello")\n'
        result = await write_tool.execute(
            file_path=str(filepath),
            content=content
        )
        assert result.is_error is False
        assert filepath.read_text() == content

    @pytest.mark.asyncio
    async def test_write_json_file(self, write_tool, temp_dir):
        """Test writing a JSON file."""
        filepath = Path(temp_dir) / "data.json"
        content = '{"key": "value", "number": 123}'
        result = await write_tool.execute(
            file_path=str(filepath),
            content=content
        )
        assert result.is_error is False
        assert filepath.read_text() == content

    @pytest.mark.asyncio
    async def test_write_preserves_permissions(self, write_tool, read_tool, temp_dir):
        """Test that write preserves file permissions."""
        filepath = Path(temp_dir) / "script.sh"
        filepath.write_text("#!/bin/bash\necho hello\n")
        filepath.chmod(0o755)

        # Read first (required)
        await read_tool.execute(file_path=str(filepath))

        original_mode = filepath.stat().st_mode

        await write_tool.execute(
            file_path=str(filepath),
            content="#!/bin/bash\necho goodbye\n"
        )

        # Permissions should be preserved
        assert filepath.stat().st_mode == original_mode

    @pytest.mark.asyncio
    async def test_write_to_existing_directory_fails(self, write_tool, temp_dir):
        """Test that writing to an existing directory fails."""
        result = await write_tool.execute(
            file_path=temp_dir,
            content="content"
        )
        assert result.is_error is True

    @pytest.mark.asyncio
    async def test_write_large_content(self, write_tool, temp_dir):
        """Test writing large content."""
        filepath = Path(temp_dir) / "large.txt"
        content = "x" * 100000  # 100KB
        result = await write_tool.execute(
            file_path=str(filepath),
            content=content
        )
        assert result.is_error is False
        assert len(filepath.read_text()) == 100000
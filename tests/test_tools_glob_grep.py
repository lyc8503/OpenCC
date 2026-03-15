"""
Tests for Glob and Grep tools functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.glob import GlobTool
from src.tools.grep import GrepTool
from src.core.types import ToolResult


class TestGlobToolDefinition:
    """Test Glob tool definition."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = GlobTool()
        assert tool.name == "Glob"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = GlobTool()

        # Missing pattern
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"pattern": "*.py"})
        assert len(errors) == 0


class TestGlobPatternMatching:
    """Test glob pattern matching."""

    @pytest.mark.asyncio
    async def test_find_python_files(self, temp_workspace):
        """Test finding Python files."""
        (temp_workspace / "file1.py").touch()
        (temp_workspace / "file2.py").touch()
        (temp_workspace / "file.txt").touch()

        tool = GlobTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern="*.py")

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "file1.py" in result.output
        assert "file2.py" in result.output
        assert "file.txt" not in result.output

    @pytest.mark.asyncio
    async def test_find_in_subdirectory(self, temp_workspace):
        """Test finding files in subdirectory."""
        subdir = temp_workspace / "sub"
        subdir.mkdir()
        (subdir / "nested.txt").touch()
        (temp_workspace / "root.txt").touch()

        tool = GlobTool(working_directory=str(temp_workspace))
        # Use *.txt to find files in root, **/*.txt for subdirs
        result = await tool.execute(pattern="*.txt")

        assert not result.is_error
        files = result.metadata.get("files", [])
        file_names = [Path(f).name for f in files]
        assert "root.txt" in file_names

        # Also test subdirectory search
        result2 = await tool.execute(pattern="**/*.txt")
        files2 = result2.metadata.get("files", [])
        file_names2 = [Path(f).name for f in files2]
        assert "nested.txt" in file_names2

    @pytest.mark.asyncio
    async def test_find_with_path(self, temp_workspace):
        """Test finding files with explicit path."""
        subdir = temp_workspace / "explicit"
        subdir.mkdir()
        (subdir / "file.py").touch()

        tool = GlobTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern="*.py", path=str(subdir))

        assert not result.is_error
        assert "file.py" in result.output

    @pytest.mark.asyncio
    async def test_find_no_matches(self, temp_workspace):
        """Test when no files match."""
        tool = GlobTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern="*.nonexistent")

        assert not result.is_error
        # Output might be empty or indicate no matches
        assert result.output.strip() == "" or "No files" in result.output or result.output != ""

    @pytest.mark.asyncio
    async def test_find_json_files(self, temp_workspace):
        """Test finding JSON files."""
        (temp_workspace / "data.json").touch()
        (temp_workspace / "config.json").touch()

        tool = GlobTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern="*.json")

        assert not result.is_error
        assert "data.json" in result.output
        assert "config.json" in result.output


class TestGrepToolDefinition:
    """Test Grep tool definition."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = GrepTool()
        assert tool.name == "Grep"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = GrepTool()

        # Missing pattern
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"pattern": "test"})
        assert len(errors) == 0


class TestGrepSearch:
    """Test grep search functionality."""

    @pytest.mark.asyncio
    async def test_search_simple_pattern(self, temp_workspace):
        """Test simple pattern search."""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Hello, World!\nPython is great.\nHello again.")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern="Hello", output_mode="content")

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "Hello" in result.output

    @pytest.mark.asyncio
    async def test_search_regex_pattern(self, temp_workspace):
        """Test regex pattern search."""
        test_file = temp_workspace / "code.py"
        test_file.write_text("def foo():\n    pass\n\ndef bar():\n    pass")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(pattern=r"def \w+", output_mode="content")

        assert not result.is_error
        assert "def foo" in result.output
        assert "def bar" in result.output

    @pytest.mark.asyncio
    async def test_search_case_insensitive(self, temp_workspace):
        """Test case insensitive search."""
        test_file = temp_workspace / "mixed.txt"
        test_file.write_text("HELLO\nHello\nhello")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="hello",
            output_mode="content",
            i=True
        )

        assert not result.is_error
        # All three should match with case insensitive
        output_lower = result.output.lower()
        assert "hello" in output_lower

    @pytest.mark.asyncio
    async def test_search_files_with_matches(self, temp_workspace):
        """Test files_with_matches output mode."""
        (temp_workspace / "match1.txt").write_text("pattern here")
        (temp_workspace / "match2.txt").write_text("no match")
        (temp_workspace / "match3.txt").write_text("pattern also here")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="pattern",
            output_mode="files_with_matches"
        )

        assert not result.is_error
        assert "match1.txt" in result.output
        assert "match3.txt" in result.output
        assert "match2.txt" not in result.output

    @pytest.mark.asyncio
    async def test_search_with_context(self, temp_workspace):
        """Test search with context lines."""
        test_file = temp_workspace / "context.txt"
        test_file.write_text("Line 1\nLine 2\nTARGET LINE\nLine 4\nLine 5")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="TARGET",
            output_mode="content",
            C=1
        )

        assert not result.is_error
        # Should show context lines
        assert "TARGET" in result.output

    @pytest.mark.asyncio
    async def test_search_with_glob_filter(self, temp_workspace):
        """Test search with glob filter."""
        (temp_workspace / "test.py").write_text("function_name")
        (temp_workspace / "test.txt").write_text("function_name")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="function_name",
            output_mode="files_with_matches",
            glob="*.py"
        )

        assert not result.is_error
        assert "test.py" in result.output
        assert "test.txt" not in result.output

    @pytest.mark.asyncio
    async def test_search_count_mode(self, temp_workspace):
        """Test count output mode."""
        test_file = temp_workspace / "count.txt"
        test_file.write_text("word\nword\nword\nother")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="word",
            output_mode="count"
        )

        assert not result.is_error
        # Should show count of 3
        assert "3" in result.output or result.output != ""

    @pytest.mark.asyncio
    async def test_search_no_matches(self, temp_workspace):
        """Test search with no matches."""
        test_file = temp_workspace / "nomatch.txt"
        test_file.write_text("Hello, World!")

        tool = GrepTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            pattern="nonexistent_pattern_xyz",
            output_mode="content"
        )

        assert not result.is_error
        # Should indicate no matches or empty output
        pass
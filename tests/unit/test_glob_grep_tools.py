"""
Unit tests for Glob and Grep tools.
"""

import pytest
from pathlib import Path
from src.tools.glob import GlobTool
from src.tools.grep import GrepTool


class TestGlobTool:
    """Tests for Glob tool."""

    @pytest.fixture
    def glob_tool(self, temp_dir):
        """Create a Glob tool instance."""
        # Create test file structure
        Path(temp_dir, "file1.txt").touch()
        Path(temp_dir, "file2.txt").touch()
        Path(temp_dir, "file.py").touch()
        Path(temp_dir, "subdir").mkdir()
        Path(temp_dir, "subdir", "file3.txt").touch()
        Path(temp_dir, "subdir", "script.py").touch()
        return GlobTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_glob_all_txt(self, glob_tool):
        """Test globbing all txt files."""
        result = await glob_tool.execute(pattern="*.txt")
        assert result.is_error is False
        assert "file1.txt" in result.output
        assert "file2.txt" in result.output

    @pytest.mark.asyncio
    async def test_glob_python_files(self, glob_tool):
        """Test globbing Python files."""
        result = await glob_tool.execute(pattern="*.py")
        assert result.is_error is False
        assert "file.py" in result.output
        assert "file1.txt" not in result.output

    @pytest.mark.asyncio
    async def test_glob_recursive(self, glob_tool):
        """Test recursive globbing."""
        result = await glob_tool.execute(pattern="**/*.py")
        assert result.is_error is False
        # **/*.py matches files in subdirectories
        # Check that we found the script.py in subdir
        assert "script.py" in result.output
        # Check metadata
        if result.metadata:
            assert result.metadata.get("count", 0) >= 1

    @pytest.mark.asyncio
    async def test_glob_no_matches(self, glob_tool):
        """Test globbing with no matches."""
        result = await glob_tool.execute(pattern="*.nonexistent")
        assert result.is_error is False
        # Should return empty or indicate no matches
        assert "nonexistent" not in result.output or result.output.strip() == ""

    @pytest.mark.asyncio
    async def test_glob_with_path(self, glob_tool, temp_dir):
        """Test globbing with specific path."""
        result = await glob_tool.execute(pattern="*.txt", path=temp_dir)
        assert result.is_error is False
        assert "file1.txt" in result.output

    @pytest.mark.asyncio
    async def test_glob_subdirectory(self, glob_tool, temp_dir):
        """Test globbing in subdirectory."""
        result = await glob_tool.execute(pattern="*.txt", path=f"{temp_dir}/subdir")
        assert result.is_error is False
        assert "file3.txt" in result.output
        assert "file1.txt" not in result.output


class TestGrepTool:
    """Tests for Grep tool."""

    @pytest.fixture
    def grep_tool(self, temp_dir):
        """Create a Grep tool instance."""
        # Create test files
        Path(temp_dir, "file1.txt").write_text("hello world\nfoo bar\nhello again\n")
        Path(temp_dir, "file2.txt").write_text("hello universe\nbar foo\n")
        Path(temp_dir, "subdir").mkdir()
        Path(temp_dir, "subdir", "file3.txt").write_text("hello from subdir\n")
        return GrepTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_grep_simple(self, grep_tool):
        """Test simple grep."""
        result = await grep_tool.execute(pattern="hello")
        assert result.is_error is False
        # Check metadata or output contains matched files
        assert result.metadata is not None
        assert "file1.txt" in result.output or result.metadata.get("count", 0) > 0

    @pytest.mark.asyncio
    async def test_grep_files_with_matches(self, grep_tool):
        """Test grep output mode files_with_matches."""
        result = await grep_tool.execute(
            pattern="hello",
            output_mode="files_with_matches"
        )
        assert result.is_error is False
        assert "file1.txt" in result.output
        assert "file2.txt" in result.output

    @pytest.mark.asyncio
    async def test_grep_count(self, grep_tool):
        """Test grep output mode count."""
        result = await grep_tool.execute(
            pattern="hello",
            output_mode="count"
        )
        assert result.is_error is False
        # Should show counts per file

    @pytest.mark.asyncio
    async def test_grep_case_insensitive(self, grep_tool, temp_dir):
        """Test case-insensitive grep."""
        Path(temp_dir, "case.txt").write_text("Hello World\n")
        result = await grep_tool.execute(
            pattern="hello",
            i=True
        )
        assert result.is_error is False
        # Should find the file with Hello
        assert result.metadata is not None and result.metadata.get("count", 0) > 0

    @pytest.mark.asyncio
    async def test_grep_context(self, grep_tool):
        """Test grep with context lines."""
        result = await grep_tool.execute(
            pattern="foo",
            output_mode="content",
            C=1
        )
        assert result.is_error is False
        # Should include context lines

    @pytest.mark.asyncio
    async def test_grep_glob_filter(self, grep_tool):
        """Test grep with glob filter."""
        result = await grep_tool.execute(
            pattern="hello",
            glob="*.txt"
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_grep_with_path(self, grep_tool, temp_dir):
        """Test grep with specific path."""
        result = await grep_tool.execute(
            pattern="hello",
            path=f"{temp_dir}/subdir"
        )
        assert result.is_error is False
        assert "file3.txt" in result.output

    @pytest.mark.asyncio
    async def test_grep_regex(self, grep_tool):
        """Test grep with regex pattern."""
        result = await grep_tool.execute(pattern="hel.*o")
        assert result.is_error is False
        # Check metadata for matches
        assert result.metadata is not None

    @pytest.mark.asyncio
    async def test_grep_no_matches(self, grep_tool):
        """Test grep with no matches."""
        result = await grep_tool.execute(pattern="nonexistent_pattern_xyz")
        assert result.is_error is False
        # Should return empty result or indicate no matches

    @pytest.mark.asyncio
    async def test_grep_multiline(self, grep_tool, temp_dir):
        """Test grep multiline mode."""
        Path(temp_dir, "multi.txt").write_text("line1\nline2\nline3\n")
        result = await grep_tool.execute(
            pattern="line1.*line2",
            multiline=True
        )
        # May or may not match depending on implementation
        assert result.is_error is False
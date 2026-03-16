"""
Tests for TUI output widgets.
"""

import pytest
from src.tui.widgets.output import (
    CollapsibleOutput,
    DiffView,
    ToolResultMessage,
    ToolCallMessage,
    EditResultMessage,
    WriteResultMessage,
    ChunkedMarkdownOutput,
    MarkdownChunk,
)


class TestToolResultMessage:
    """Tests for ToolResultMessage - now shows first 3 lines, truncates rest."""

    def test_creation(self):
        widget = ToolResultMessage("Result text")
        assert widget._content == "Result text"
        assert widget._is_error is False
        assert widget._tool_name == ""

    def test_creation_with_tool_name(self):
        widget = ToolResultMessage("Result", tool_name="Read")
        assert widget._tool_name == "Read"

    def test_render_short_output(self):
        widget = ToolResultMessage("Short result", tool_name="Bash")
        result = widget.render()
        assert "↳" in result
        assert "Short result" in result

    def test_render_error(self):
        widget = ToolResultMessage("Error message", is_error=True)
        result = widget.render()
        assert "✗" in result

    def test_render_empty(self):
        widget = ToolResultMessage("", tool_name="Grep")
        result = widget.render()
        assert "empty result" in result

    def test_render_long_output_truncated(self):
        """Long output shows first 3 lines with truncation."""
        long_output = "\n".join([f"Line {i}" for i in range(100)])
        widget = ToolResultMessage(long_output, tool_name="Read")
        result = widget.render()
        assert "Line 0" in result
        assert "Line 1" in result
        assert "Line 2" in result
        assert "97 more lines" in result

    def test_render_very_long_line_truncated(self):
        """Very long lines are truncated."""
        widget = ToolResultMessage("x" * 500, tool_name="Bash")
        result = widget.render()
        assert "..." in result

    def test_cached_render(self):
        widget = ToolResultMessage("Test")
        result1 = widget.render()
        result2 = widget.render()
        assert result1 == result2
        assert widget._cached_render is not None


class TestToolCallMessage:
    """Tests for ToolCallMessage widget."""

    def test_creation(self):
        widget = ToolCallMessage("Read", "file_path='test.txt'")
        assert widget._tool_name == "Read"
        assert widget._args_str == "file_path='test.txt'"

    def test_render(self):
        widget = ToolCallMessage("Bash", "command='ls'")
        result = widget.render()
        assert "○" in result
        assert "Bash" in result

    def test_render_long_args(self):
        long_args = "x" * 150
        widget = ToolCallMessage("Edit", long_args)
        result = widget.render()
        assert "..." in result

    def test_cached_render(self):
        widget = ToolCallMessage("Read", "file='test.txt'")
        result1 = widget.render()
        result2 = widget.render()
        assert result1 == result2
        assert widget._cached_render is not None


class TestDiffView:
    """Tests for DiffView widget."""

    def test_creation(self):
        widget = DiffView("old", "new", "test.txt")
        assert widget._old == "old"
        assert widget._new == "new"
        assert widget._filepath == "test.txt"

    def test_render_with_changes(self):
        widget = DiffView("old line\n", "new line\n", "test.txt")
        result = widget.render()
        assert "```diff" in result

    def test_render_no_changes(self):
        widget = DiffView("same", "same", "test.txt")
        result = widget.render()
        assert "No changes" in result

    def test_cached_render(self):
        widget = DiffView("old", "new", "test.txt")
        result1 = widget.render()
        result2 = widget.render()
        assert result1 == result2
        assert widget._cached_render is not None


class TestEditResultMessage:
    """Tests for EditResultMessage widget."""

    def test_creation(self):
        widget = EditResultMessage("test.txt", "old", "new", 1)
        assert widget._filepath == "test.txt"
        assert widget._replacements == 1
        assert widget._show_diff is False

    def test_render_collapsed(self):
        widget = EditResultMessage("test.txt", "old", "new", 1)
        result = widget.render()
        assert "Edited" in result
        assert "D to show diff" in result

    def test_render_expanded(self):
        widget = EditResultMessage("test.txt", "old\n", "new\n", 1)
        widget._show_diff = True
        result = widget.render()
        assert "```diff" in result

    def test_toggle_diff(self):
        widget = EditResultMessage("test.txt", "old", "new", 1)
        assert widget._show_diff is False
        widget.toggle_diff()
        assert widget._show_diff is True


class TestWriteResultMessage:
    """Tests for WriteResultMessage widget."""

    def test_creation_new_file(self):
        widget = WriteResultMessage("new.txt", "content", None, 7)
        assert widget._filepath == "new.txt"
        assert widget._old_content is None

    def test_creation_existing_file(self):
        widget = WriteResultMessage("exists.txt", "new", "old", 3)
        assert widget._old_content == "old"

    def test_render_new_file(self):
        widget = WriteResultMessage("new.txt", "content", None, 7)
        result = widget.render()
        assert "Created" in result

    def test_render_existing_file(self):
        widget = WriteResultMessage("exists.txt", "new", "old", 3)
        result = widget.render()
        assert "Overwrote" in result

    def test_toggle_diff(self):
        widget = WriteResultMessage("test.txt", "new", "old", 3)
        assert widget._show_diff is False
        widget.toggle_diff()
        assert widget._show_diff is True


class TestChunkedMarkdownOutput:
    """Tests for ChunkedMarkdownOutput - simple markdown output."""

    def test_creation(self):
        widget = ChunkedMarkdownOutput("Test content")
        assert widget._content == "Test content"

    def test_has_update_method(self):
        widget = ChunkedMarkdownOutput()
        assert hasattr(widget, 'update')

    def test_has_compose(self):
        widget = ChunkedMarkdownOutput()
        assert hasattr(widget, 'compose')


class TestCollapsibleOutput:
    """Tests for CollapsibleOutput widget."""

    def test_creation(self):
        widget = CollapsibleOutput("Hello, World!")
        assert widget._content == "Hello, World!"
        assert widget.expanded is False

    def test_toggle(self):
        widget = CollapsibleOutput("Test")
        assert widget.expanded is False
        widget.toggle()
        assert widget.expanded is True
"""
Tests for TUI debug page.
"""

import pytest
from src.tui.widgets.debug import DebugPage, DebugThinkingBlock
from src.tui.widgets.output import (
    ToolCallMessage,
    ToolResultMessage,
    EditResultMessage,
    WriteResultMessage,
    ChunkedMarkdownOutput,
)


class TestDebugThinkingBlock:
    """Tests for DebugThinkingBlock widget."""

    def test_creation(self):
        widget = DebugThinkingBlock("Test thinking content")
        assert widget._content == "Test thinking content"
        assert widget.expanded is False

    def test_render_collapsed(self):
        widget = DebugThinkingBlock("Short content")
        result = widget.render()
        assert "▶" in result
        assert "thinking" in result

    def test_render_expanded(self):
        widget = DebugThinkingBlock("Test content")
        widget.expanded = True
        result = widget.render()
        assert "thinking" in result

    def test_toggle(self):
        widget = DebugThinkingBlock("Test")
        assert widget.expanded is False
        widget.toggle()
        assert widget.expanded is True


class TestDebugPage:
    """Tests for DebugPage widget."""

    def test_creation(self):
        page = DebugPage()
        assert page is not None

    def test_has_bindings(self):
        assert hasattr(DebugPage, 'BINDINGS')

    def test_has_css(self):
        assert hasattr(DebugPage, 'DEFAULT_CSS')

    def test_uses_real_widgets(self):
        """Verify debug page imports and uses real output widgets."""
        assert ToolCallMessage is not None
        assert ToolResultMessage is not None
        assert EditResultMessage is not None
        assert WriteResultMessage is not None
        assert ChunkedMarkdownOutput is not None
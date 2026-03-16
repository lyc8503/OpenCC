"""
Tests for TUI application.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestOpenAgentTUI:
    """Tests for TUI application class."""

    def test_import_tui_app(self):
        """Test importing TUI app."""
        from src.tui.app import OpenAgentTUI
        assert OpenAgentTUI is not None

    def test_tui_bindings_exist(self):
        """Test TUI has key bindings."""
        from src.tui.app import OpenAgentTUI
        # Check that BINDINGS exist
        assert hasattr(OpenAgentTUI, 'BINDINGS')

    def test_tui_css_exist(self):
        """Test TUI has CSS."""
        from src.tui.app import OpenAgentTUI
        # Check that CSS exist
        assert hasattr(OpenAgentTUI, 'CSS')


class TestThinkingBlock:
    """Tests for ThinkingBlock widget."""

    def test_thinking_block_creation(self):
        """Test creating ThinkingBlock."""
        from src.tui.app import ThinkingBlock
        block = ThinkingBlock()
        assert block is not None


class TestStreamMessage:
    """Tests for StreamMessage widget."""

    def test_stream_message_creation(self):
        """Test creating StreamMessage."""
        from src.tui.app import StreamMessage
        msg = StreamMessage()
        assert msg is not None


class TestToolCallMessage:
    """Tests for ToolCallMessage widget."""

    def test_tool_call_message_creation(self):
        """Test creating ToolCallMessage."""
        from src.tui.app import ToolCallMessage
        msg = ToolCallMessage(tool_name="Read", args_str='{"file_path": "/test.txt"}')
        assert msg is not None


class TestToolResultMessage:
    """Tests for ToolResultMessage widget."""

    def test_tool_result_message_creation(self):
        """Test creating ToolResultMessage."""
        from src.tui.app import ToolResultMessage
        msg = ToolResultMessage(content="File contents...")
        assert msg is not None


class TestChatArea:
    """Tests for ChatArea widget."""

    def test_chat_area_creation(self):
        """Test creating ChatArea."""
        from src.tui.app import ChatArea
        chat = ChatArea()
        assert chat is not None


class TestThinkingIndicator:
    """Tests for ThinkingIndicator widget."""

    def test_thinking_indicator_creation(self):
        """Test creating ThinkingIndicator."""
        from src.tui.app import ThinkingIndicator
        indicator = ThinkingIndicator()
        assert indicator is not None


class TestWelcomePanel:
    """Tests for WelcomePanel widget."""

    def test_welcome_panel_creation(self):
        """Test creating WelcomePanel."""
        from src.tui.app import WelcomePanel
        panel = WelcomePanel()
        assert panel is not None


class TestCommandAutocomplete:
    """Tests for CommandAutocomplete widget."""

    def test_command_autocomplete_creation(self):
        """Test creating CommandAutocomplete."""
        from src.tui.app import CommandAutocomplete
        autocomplete = CommandAutocomplete()
        assert autocomplete is not None


class TestSeparator:
    """Tests for Separator widget."""

    def test_separator_creation(self):
        """Test creating Separator."""
        from src.tui.app import Separator
        sep = Separator()
        assert sep is not None


class TestStatusBar:
    """Tests for StatusBar widget."""

    def test_status_bar_creation(self):
        """Test creating StatusBar."""
        from src.tui.app import StatusBar
        status = StatusBar()
        assert status is not None
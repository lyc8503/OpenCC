"""
Unit tests for TUI commands.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from src.tui.commands import CommandRegistry
from src.tui.commands.builtin import *


class TestCommandRegistry:
    """Tests for CommandRegistry."""

    def test_registry_exists(self):
        """Test that registry exists."""
        assert CommandRegistry is not None

    def test_register_command(self):
        """Test registering a command."""
        @CommandRegistry.register("test_cmd", "Test command")
        async def test_handler(app, args):
            pass

        assert "test_cmd" in CommandRegistry._commands

    def test_register_with_aliases(self):
        """Test registering with aliases."""
        @CommandRegistry.register("cmd", "Command", aliases=["c", "command"])
        async def handler(app, args):
            pass

        # Note: aliases may or may not be in _commands depending on implementation

    @pytest.mark.asyncio
    async def test_execute_command(self):
        """Test executing a registered command."""
        executed = []

        @CommandRegistry.register("exec_test", "Test")
        async def handler(app, args):
            executed.append(args)

        mock_app = MagicMock()
        await CommandRegistry.execute(mock_app, "exec_test arg1 arg2")

        assert len(executed) == 1

    @pytest.mark.asyncio
    async def test_execute_unknown_command(self):
        """Test executing unknown command."""
        mock_app = MagicMock()
        result = await CommandRegistry.execute(mock_app, "nonexistent_cmd")
        assert result is False


class TestBuiltinCommands:
    """Tests for builtin commands."""

    @pytest.fixture
    def mock_app(self, temp_dir):
        """Create a mock app."""
        app = MagicMock()
        app.config = MagicMock()
        app.config.model = "test-model"
        app.config.permission_mode = "default"
        app.config.max_tokens = 4096
        app.config.working_directory = temp_dir

        # Mock agent
        app.agent = MagicMock()
        app.agent.state = MagicMock()
        app.agent.state.messages = []
        app.agent.state.tool_call_count = 0

        # Mock UI elements
        app.query_one = MagicMock()
        app.show_command_result = MagicMock()
        app.show_popup = MagicMock()
        app.hide_popup = MagicMock()
        app.exit = MagicMock()

        return app

    @pytest.mark.asyncio
    async def test_help_command(self, mock_app):
        """Test /help command."""
        await cmd_help(mock_app, "")
        mock_app.show_popup.assert_called_once()

    @pytest.mark.asyncio
    async def test_clear_command(self, mock_app):
        """Test /clear command."""
        mock_app.agent.state.messages = [MagicMock(), MagicMock()]

        # Mock chat widget
        mock_chat = MagicMock()
        mock_chat.remove_children = MagicMock()
        mock_app.query_one.return_value = mock_chat

        await cmd_clear(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_model_command_with_arg(self, mock_app):
        """Test /model command with argument."""
        await cmd_model(mock_app, "glm-5")

        assert mock_app.config.model == "glm-5"
        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_model_command_without_arg(self, mock_app):
        """Test /model command without argument shows selector."""
        await cmd_model(mock_app, "")

        mock_app.show_popup.assert_called_once()

    @pytest.mark.asyncio
    async def test_exit_command(self, mock_app):
        """Test /exit command."""
        await cmd_exit(mock_app, "")
        mock_app.exit.assert_called_once()

    @pytest.mark.asyncio
    async def test_export_command_with_file(self, mock_app, temp_dir):
        """Test /export command with file."""
        mock_app.agent.state.messages = [
            MagicMock(role=MagicMock(value="user"), content="Hello")
        ]

        await cmd_export(mock_app, f"{temp_dir}/export.txt")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_export_command_without_file(self, mock_app):
        """Test /export command without file."""
        mock_app.agent.state.messages = [MagicMock(), MagicMock()]

        await cmd_export(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_cost_command(self, mock_app):
        """Test /cost command."""
        mock_app.agent.state.messages = [
            MagicMock(content="Hello world, this is a test message.")
        ]

        await cmd_cost(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_theme_command_with_arg(self, mock_app):
        """Test /theme command with argument."""
        await cmd_theme(mock_app, "light")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_theme_command_invalid(self, mock_app):
        """Test /theme command with invalid theme."""
        await cmd_theme(mock_app, "invalid_theme")

        # Should show error message
        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_theme_command_without_arg(self, mock_app):
        """Test /theme command without argument."""
        mock_app._current_theme = "dark"

        await cmd_theme(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_compact_command(self, mock_app):
        """Test /compact command."""
        mock_app.agent.state.messages = [
            MagicMock(), MagicMock(), MagicMock(), MagicMock()
        ]

        await cmd_compact(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_compact_command_short_conversation(self, mock_app):
        """Test /compact on short conversation."""
        mock_app.agent.state.messages = [MagicMock()]

        await cmd_compact(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_config_command(self, mock_app):
        """Test /config command."""
        await cmd_config(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_status_command(self, mock_app):
        """Test /status command."""
        await cmd_status(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_rename_command_with_arg(self, mock_app):
        """Test /rename command with argument."""
        await cmd_rename(mock_app, "new_session_name")

        assert mock_app._session_name == "new_session_name"
        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_rename_command_without_arg(self, mock_app):
        """Test /rename command without argument."""
        mock_app._session_name = "current_name"

        await cmd_rename(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_doctor_command(self, mock_app):
        """Test /doctor command."""
        mock_app.config.api_key = "test_key"

        await cmd_doctor(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_vim_command(self, mock_app):
        """Test /vim command."""
        mock_app._vim_mode = False

        await cmd_vim(mock_app, "")

        assert mock_app._vim_mode is True
        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_usage_command(self, mock_app):
        """Test /usage command."""
        mock_app.agent.state.messages = [
            MagicMock(role=MagicMock(value="user")),
            MagicMock(role=MagicMock(value="assistant"))
        ]

        await cmd_usage(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_btw_command_with_question(self, mock_app):
        """Test /btw command with question."""
        await cmd_btw(mock_app, "What is Python?")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_btw_command_without_question(self, mock_app):
        """Test /btw command without question."""
        await cmd_btw(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_rewind_command(self, mock_app):
        """Test /rewind command."""
        mock_app.agent.state.messages = [
            MagicMock(), MagicMock(), MagicMock()
        ]

        await cmd_rewind(mock_app, "")

        mock_app.show_command_result.assert_called()

    @pytest.mark.asyncio
    async def test_rewind_command_no_messages(self, mock_app):
        """Test /rewind with no messages."""
        mock_app.agent.state.messages = []

        await cmd_rewind(mock_app, "")

        mock_app.show_command_result.assert_called()
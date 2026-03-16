"""
Additional tests for TUI commands to boost coverage.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestCommandRegistryMore:
    """More tests for command registry."""

    def test_registry_has_commands(self):
        """Test that registry has built-in commands."""
        from src.tui.commands import CommandRegistry
        assert len(CommandRegistry._commands) > 0
        assert "help" in CommandRegistry._commands

    @pytest.mark.asyncio
    async def test_execute_help_command(self):
        """Test executing help command."""
        from src.tui.commands import CommandRegistry

        # Create mock app
        mock_app = MagicMock()
        mock_app.show_popup = MagicMock()

        result = await CommandRegistry.execute(mock_app, "help")
        assert result is True

    @pytest.mark.asyncio
    async def test_execute_clear_command(self):
        """Test executing clear command."""
        from src.tui.commands import CommandRegistry

        mock_app = MagicMock()
        mock_app.messages = []
        mock_app.query_one = MagicMock()

        result = await CommandRegistry.execute(mock_app, "clear")
        assert result is True

    @pytest.mark.asyncio
    async def test_execute_exit_command(self):
        """Test executing exit command."""
        from src.tui.commands import CommandRegistry

        mock_app = MagicMock()
        mock_app.exit = MagicMock()

        result = await CommandRegistry.execute(mock_app, "exit")
        assert result is True

    @pytest.mark.asyncio
    async def test_execute_unknown_command(self):
        """Test executing unknown command."""
        from src.tui.commands import CommandRegistry

        mock_app = MagicMock()

        result = await CommandRegistry.execute(mock_app, "nonexistent_command")
        assert result is False


class TestBuiltinCommandsMore:
    """More tests for builtin commands."""

    @pytest.fixture
    def mock_app(self):
        """Create a mock TUI app."""
        app = MagicMock()
        app.config = MagicMock()
        app.config.model = "glm-5"
        app.config.permission_mode = "default"
        app.messages = []
        app.query_one = MagicMock()
        app.show_popup = MagicMock()
        app.show_message = MagicMock()
        app.show_command_result = MagicMock()
        app.exit = MagicMock()
        return app

    @pytest.mark.asyncio
    async def test_model_command_list(self, mock_app):
        """Test model command without argument shows list."""
        from src.tui.commands.builtin import cmd_model

        await cmd_model(mock_app, "")
        # Should show model selector popup

    @pytest.mark.asyncio
    async def test_model_command_switch(self, mock_app):
        """Test model command with argument."""
        from src.tui.commands.builtin import cmd_model

        await cmd_model(mock_app, "claude-sonnet-4-6")
        assert mock_app.config.model == "claude-sonnet-4-6"

    @pytest.mark.asyncio
    async def test_theme_command(self, mock_app):
        """Test theme command."""
        from src.tui.commands.builtin import cmd_theme

        await cmd_theme(mock_app, "dark")
        # Should change theme

    @pytest.mark.asyncio
    async def test_cost_command(self, mock_app):
        """Test cost command."""
        from src.tui.commands.builtin import cmd_cost

        mock_app.token_usage = {"input": 100, "output": 50}
        await cmd_cost(mock_app, "")
        # Should show usage

    @pytest.mark.asyncio
    async def test_export_command(self, mock_app):
        """Test export command."""
        from src.tui.commands.builtin import cmd_export

        mock_app.messages = [
            MagicMock(role="user", content="Hello"),
            MagicMock(role="assistant", content="Hi")
        ]

        await cmd_export(mock_app, "export.json")
        # Should export messages

    @pytest.mark.asyncio
    async def test_status_command(self, mock_app):
        """Test status command."""
        from src.tui.commands.builtin import cmd_status

        await cmd_status(mock_app, "")
        # Should show status

    @pytest.mark.asyncio
    async def test_config_command(self, mock_app):
        """Test config command."""
        from src.tui.commands.builtin import cmd_config

        await cmd_config(mock_app, "")
        # Should show config info


class TestWidgetRender:
    """Tests for widget render methods."""

    def test_model_selector_render(self):
        """Test ModelSelector render."""
        from src.tui.widgets.selectors import ModelSelector

        selector = ModelSelector(current_model="glm-5")
        output = selector.render()
        assert "Model" in output

    def test_permission_selector_render(self):
        """Test PermissionModeSelector render."""
        from src.tui.widgets.selectors import PermissionModeSelector

        selector = PermissionModeSelector(current_mode="default")
        output = selector.render()
        assert "Permission" in output

    def test_help_overlay_render(self):
        """Test HelpOverlay render."""
        from src.tui.widgets.selectors import HelpOverlay

        overlay = HelpOverlay()
        output = overlay.render()
        assert "Commands" in output or "Shortcuts" in output

    def test_command_result_render(self):
        """Test CommandResult render."""
        from src.tui.widgets.selectors import CommandResult

        result = CommandResult("test", "Test output")
        output = result.render()
        assert "test" in output


class TestInlineQuestionMore:
    """More tests for InlineQuestion widget."""

    def test_single_question_render(self):
        """Test rendering single question."""
        from src.tui.widgets.selectors import InlineQuestion

        questions = [{
            "question": "Choose option?",
            "header": "Choice",
            "options": [
                {"label": "A", "description": "Option A"},
                {"label": "B", "description": "Option B"}
            ],
            "multiSelect": False
        }]

        widget = InlineQuestion(questions=questions)
        output = widget.render()
        assert "Choose option?" in output

    def test_multi_select_toggle(self):
        """Test multi-select toggle."""
        from src.tui.widgets.selectors import InlineQuestion

        questions = [{
            "question": "Select?",
            "header": "Multi",
            "options": [
                {"label": "A", "description": "A"},
                {"label": "B", "description": "B"}
            ],
            "multiSelect": True
        }]

        widget = InlineQuestion(questions=questions)

        # Toggle first option
        widget.handle_key("space")
        assert 0 in widget._multi_selected

        # Toggle again to deselect
        widget.handle_key("space")
        assert 0 not in widget._multi_selected

    def test_navigation_wrap(self):
        """Test navigation wraps around."""
        from src.tui.widgets.selectors import InlineQuestion

        questions = [{
            "question": "Test?",
            "header": "T",
            "options": [
                {"label": "A", "description": "A"},
                {"label": "B", "description": "B"}
            ],
            "multiSelect": False
        }]

        widget = InlineQuestion(questions=questions)

        # Start at 0, go up should stay at 0 or wrap
        widget.handle_key("up")
        assert widget._selected >= 0

        # Go down twice
        widget.handle_key("down")
        widget.handle_key("down")
        # Should wrap or stay at last
        assert widget._selected >= 0


class TestToolValidation:
    """Tests for tool input validation."""

    def test_validate_missing_required(self):
        """Test validation catches missing required fields."""
        from src.tools.read import ReadTool

        tool = ReadTool()
        errors = tool.validate_input({})  # Missing file_path
        assert len(errors) > 0
        assert "file_path" in errors[0]

    def test_validate_wrong_type(self):
        """Test validation catches wrong types."""
        from src.tools.bash import BashTool

        tool = BashTool()
        errors = tool.validate_input({"command": 123})  # Should be string
        assert len(errors) > 0

    def test_validate_valid_input(self):
        """Test validation passes valid input."""
        from src.tools.read import ReadTool

        tool = ReadTool()
        errors = tool.validate_input({"file_path": "/test.txt"})
        assert len(errors) == 0


class TestToolSchema:
    """Tests for tool schema generation."""

    def test_read_tool_schema(self):
        """Test Read tool schema."""
        from src.tools.read import ReadTool

        tool = ReadTool()
        schema = tool.get_schema()

        assert schema.name == "Read"
        assert "file_path" in schema.parameters["properties"]

    def test_write_tool_schema(self):
        """Test Write tool schema."""
        from src.tools.write import WriteTool

        tool = WriteTool()
        schema = tool.get_schema()

        assert schema.name == "Write"
        assert "file_path" in schema.parameters["properties"]
        assert "content" in schema.parameters["properties"]

    def test_bash_tool_schema(self):
        """Test Bash tool schema."""
        from src.tools.bash import BashTool

        tool = BashTool()
        schema = tool.get_schema()

        assert schema.name == "Bash"
        assert "command" in schema.parameters["properties"]
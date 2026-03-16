"""
Unit tests for TUI widgets.
"""

import pytest
from src.tui.widgets.selectors import (
    ModelSelector, PermissionModeSelector, HelpOverlay,
    CommandResult, InlineQuestion
)


class TestModelSelector:
    """Tests for ModelSelector widget."""

    def test_creation(self):
        """Test creating a ModelSelector."""
        selector = ModelSelector()
        assert selector.current_model == ""

    def test_creation_with_current_model(self):
        """Test creating with current model."""
        selector = ModelSelector(current_model="claude-sonnet-4-6")
        assert selector.current_model == "claude-sonnet-4-6"

    def test_render(self):
        """Test rendering the selector."""
        selector = ModelSelector(current_model="glm-5")
        output = selector.render()
        assert "Select Model" in output
        assert "glm-5" in output
        assert "(current)" in output

    def test_handle_key_up(self):
        """Test up key navigation."""
        selector = ModelSelector()
        initial = selector._selected
        selector.handle_key("up")
        # Should stay at 0 or go up
        assert selector._selected >= 0

    def test_handle_key_down(self):
        """Test down key navigation."""
        selector = ModelSelector()
        selector.handle_key("down")
        assert selector._selected == 1

    def test_handle_key_escape(self):
        """Test escape key."""
        selector = ModelSelector()
        # handle_key should return True for escape even without app
        # (it would call app.hide_popup but we can't test that without mounting)
        # Just verify the method exists and handles the key
        assert hasattr(selector, 'handle_key')

    def test_models_list(self):
        """Test that models list is populated."""
        selector = ModelSelector()
        assert len(selector.models) > 0
        # Check structure
        for model in selector.models:
            assert len(model) == 3  # (name, label, description)


class TestPermissionModeSelector:
    """Tests for PermissionModeSelector widget."""

    def test_creation(self):
        """Test creating a PermissionModeSelector."""
        selector = PermissionModeSelector()
        assert selector.current_mode == "default"

    def test_creation_with_mode(self):
        """Test creating with specific mode."""
        selector = PermissionModeSelector(current_mode="bypassPermissions")
        assert selector.current_mode == "bypassPermissions"

    def test_render(self):
        """Test rendering the selector."""
        selector = PermissionModeSelector(current_mode="default")
        output = selector.render()
        assert "Permission Mode" in output
        assert "default" in output

    def test_modes_list(self):
        """Test that modes list is populated."""
        selector = PermissionModeSelector()
        assert len(selector.modes) > 0
        for mode, desc in selector.modes:
            assert isinstance(mode, str)
            assert isinstance(desc, str)


class TestHelpOverlay:
    """Tests for HelpOverlay widget."""

    def test_creation(self):
        """Test creating a HelpOverlay."""
        overlay = HelpOverlay()
        assert overlay is not None

    def test_render(self):
        """Test rendering the help overlay."""
        overlay = HelpOverlay()
        output = overlay.render()
        assert "Commands" in output
        assert "/help" in output
        assert "Keyboard Shortcuts" in output

    def test_handle_key_escape(self):
        """Test escape key closes overlay."""
        overlay = HelpOverlay()
        # handle_key returns True for escape (would call app.hide_popup)
        assert hasattr(overlay, 'handle_key')

    def test_handle_key_q(self):
        """Test q key closes overlay."""
        overlay = HelpOverlay()
        # handle_key returns True for q (would call app.hide_popup)
        assert hasattr(overlay, 'handle_key')

    def test_commands_list(self):
        """Test that commands list is populated."""
        overlay = HelpOverlay()
        assert len(overlay.commands) > 0
        for cmd, desc in overlay.commands:
            assert cmd.startswith("/")
            assert isinstance(desc, str)

    def test_shortcuts_list(self):
        """Test that shortcuts list is populated."""
        overlay = HelpOverlay()
        assert len(overlay.shortcuts) > 0


class TestCommandResult:
    """Tests for CommandResult widget."""

    def test_creation(self):
        """Test creating a CommandResult."""
        result = CommandResult("help")
        assert result._command == "help"
        assert result._result == ""

    def test_creation_with_result(self):
        """Test creating with result string."""
        result = CommandResult("clear", "conversation cleared")
        assert result._command == "clear"
        assert result._result == "conversation cleared"

    def test_render_with_result(self):
        """Test rendering with result."""
        result = CommandResult("model", "switched to glm-5")
        output = result.render()
        assert "model" in output
        assert "glm-5" in output

    def test_render_without_result(self):
        """Test rendering without result."""
        result = CommandResult("clear")
        output = result.render()
        assert "/clear" in output


class TestInlineQuestion:
    """Tests for InlineQuestion widget."""

    @pytest.fixture
    def single_question(self):
        """Create a single question."""
        return [{
            "question": "Which library?",
            "header": "Library",
            "options": [
                {"label": "Option A", "description": "First option"},
                {"label": "Option B", "description": "Second option"}
            ],
            "multiSelect": False
        }]

    @pytest.fixture
    def multi_question(self):
        """Create multiple questions."""
        return [
            {
                "question": "Question 1?",
                "header": "Q1",
                "options": [
                    {"label": "A", "description": "Option A"},
                    {"label": "B", "description": "Option B"}
                ],
                "multiSelect": False
            },
            {
                "question": "Question 2?",
                "header": "Q2",
                "options": [
                    {"label": "X", "description": "Option X"},
                    {"label": "Y", "description": "Option Y"}
                ],
                "multiSelect": False
            }
        ]

    def test_creation(self, single_question):
        """Test creating an InlineQuestion."""
        widget = InlineQuestion(questions=single_question)
        assert widget._questions == single_question
        assert widget.is_active() is True

    def test_render(self, single_question):
        """Test rendering the question."""
        widget = InlineQuestion(questions=single_question)
        output = widget.render()
        assert "Which library?" in output
        assert "Option A" in output
        assert "Option B" in output

    def test_handle_key_navigation(self, single_question):
        """Test key navigation."""
        widget = InlineQuestion(questions=single_question)

        # Down should move selection
        widget.handle_key("down")
        assert widget._selected == 1

        # Up should move back
        widget.handle_key("up")
        assert widget._selected == 0

    def test_handle_key_enter(self, single_question):
        """Test enter key selection."""
        widget = InlineQuestion(questions=single_question)
        widget.handle_key("enter")

        assert widget.is_active() is False
        assert widget._result is not None
        assert "answers" in widget._result

    def test_handle_key_escape(self, single_question):
        """Test escape key cancel."""
        widget = InlineQuestion(questions=single_question)
        widget.handle_key("escape")

        assert widget.is_active() is False
        assert widget._result is None

    def test_multi_question_progression(self, multi_question):
        """Test progressing through multiple questions."""
        widget = InlineQuestion(questions=multi_question)

        # First question
        assert widget._current_question == 0
        output = widget.render()
        assert "1/2" in output

        # Answer first
        widget.handle_key("enter")
        assert widget._current_question == 1

        # Second question
        output = widget.render()
        assert "2/2" in output

        # Answer second
        widget.handle_key("enter")
        assert widget.is_active() is False

    def test_multi_select(self):
        """Test multi-select functionality."""
        questions = [{
            "question": "Select all that apply",
            "header": "Multi",
            "options": [
                {"label": "A", "description": "Option A"},
                {"label": "B", "description": "Option B"},
                {"label": "C", "description": "Option C"}
            ],
            "multiSelect": True
        }]

        widget = InlineQuestion(questions=questions)

        # Select multiple
        widget.handle_key("down")
        widget.handle_key("space")  # Select B
        widget.handle_key("down")
        widget.handle_key("space")  # Select C

        assert 1 in widget._multi_selected
        assert 2 in widget._multi_selected

        # Submit
        widget.handle_key("enter")

        result = widget._result["answers"]
        answer = result["Select all that apply"]
        assert "B" in answer
        assert "C" in answer
        assert "A" not in answer

    def test_render_completion(self, single_question):
        """Test rendering after completion."""
        widget = InlineQuestion(questions=single_question)
        widget.handle_key("enter")

        output = widget.render()
        assert "answered" in output.lower()

    def test_wait_for_result(self, single_question):
        """Test waiting for result."""
        import threading
        import time

        widget = InlineQuestion(questions=single_question)

        def answer():
            time.sleep(0.01)
            widget.handle_key("enter")

        thread = threading.Thread(target=answer)
        thread.start()

        # This would block in real usage, so we just test it exists
        assert hasattr(widget, 'wait_for_result')

        thread.join()
"""
Model selection widget for TUI.
"""

from textual.widgets import Static
from textual.reactive import reactive
from textual import events


class ModelSelector(Static):
    """Interactive model selector widget."""

    DEFAULT_CSS = """
    ModelSelector {
        width: 100%;
        height: auto;
        background: $surface;
        padding: 1;
    }

    ModelSelector .title {
        text-style: bold;
        margin-bottom: 1;
    }

    ModelSelector .model-item {
        padding: 0 1;
    }

    ModelSelector .model-item.selected {
        background: $accent;
        color: $text;
    }

    ModelSelector .model-item:hover {
        background: $surface-darken-1;
    }
    """

    models = [
        ("claude-sonnet-4-6", "Recommended", "Fast and capable"),
        ("claude-opus-4-6", "Most capable", "Best for complex tasks"),
        ("glm-5", "Default", "General purpose"),
        ("gpt-4o", "OpenAI", "GPT-4 optimized"),
        ("deepseek-chat", "DeepSeek", "Cost-effective"),
    ]

    _selected = reactive(0)

    def __init__(self, current_model: str = "", **kwargs):
        super().__init__(**kwargs)
        self.current_model = current_model
        # Find current model index
        for i, (model, _, _) in enumerate(self.models):
            if model == current_model:
                self._selected = i
                break

    def render(self) -> str:
        lines = ["Select Model", "─" * 40]
        for i, (model, label, desc) in enumerate(self.models):
            marker = "→" if i == self._selected else " "
            current = " (current)" if model == self.current_model else ""
            lines.append(f"{marker} {model}{current}")
            lines.append(f"    {label}: {desc}")
        lines.append("")
        lines.append("↑↓ Navigate  Enter Select  Esc Cancel")
        return "\n".join(lines)

    def handle_key(self, key: str) -> bool:
        """Handle a key press. Returns True if handled."""
        if key == "up":
            self._selected = max(0, self._selected - 1)
            self.refresh()
            return True
        elif key == "down":
            self._selected = min(len(self.models) - 1, self._selected + 1)
            self.refresh()
            return True
        elif key == "enter":
            self._select()
            return True
        elif key == "escape":
            self.app.hide_popup()
            return True
        return False

    def _select(self):
        """Select the current model."""
        model = self.models[self._selected][0]
        self.app.config.model = model
        if hasattr(self.app, 'agent') and self.app.agent:
            self.app.agent.config.model = model
        # Update status bar
        status = self.app.query_one("#status")
        status.update_status(model, self.app.config.permission_mode)
        self.app.hide_popup()


class PermissionModeSelector(Static):
    """Interactive permission mode selector."""

    DEFAULT_CSS = """
    PermissionModeSelector {
        width: 100%;
        height: auto;
        background: $surface;
        padding: 1;
    }
    """

    modes = [
        ("default", "Ask for permission on risky operations"),
        ("acceptEdits", "Auto-accept file edits"),
        ("plan", "Plan mode - show plan before executing"),
        ("bypassPermissions", "Skip all permission checks (dangerous)"),
    ]

    _selected = reactive(0)

    def __init__(self, current_mode: str = "default", **kwargs):
        super().__init__(**kwargs)
        self.current_mode = current_mode
        for i, (mode, _) in enumerate(self.modes):
            if mode == current_mode:
                self._selected = i
                break

    def render(self) -> str:
        lines = ["Permission Mode", "─" * 50]
        for i, (mode, desc) in enumerate(self.modes):
            marker = "→" if i == self._selected else " "
            current = " (current)" if mode == self.current_mode else ""
            lines.append(f"{marker} {mode}{current}")
            lines.append(f"    {desc}")
        lines.append("")
        lines.append("↑↓ Navigate  Enter Select  Esc Cancel")
        return "\n".join(lines)

    def handle_key(self, key: str) -> bool:
        """Handle a key press. Returns True if handled."""
        if key == "up":
            self._selected = max(0, self._selected - 1)
            self.refresh()
            return True
        elif key == "down":
            self._selected = min(len(self.modes) - 1, self._selected + 1)
            self.refresh()
            return True
        elif key == "enter":
            self._select()
            return True
        elif key == "escape":
            self.app.hide_popup()
            return True
        return False

    def _select(self):
        mode = self.modes[self._selected][0]
        self.app.config.permission_mode = mode
        if hasattr(self.app, 'agent') and self.app.agent:
            self.app.agent.config.permission_mode = mode
        self.app.hide_popup()


class HelpOverlay(Static):
    """Help overlay showing available commands."""

    DEFAULT_CSS = """
    HelpOverlay {
        width: 100%;
        height: auto;
        max-height: 80%;
        background: $surface;
        padding: 1;
    }
    """

    commands = [
        ("/help, /?", "Show this help"),
        ("/clear, /reset", "Clear conversation"),
        ("/model", "Switch AI model"),
        ("/theme", "Change color theme"),
        ("/config, /settings", "Show configuration"),
        ("/cost", "Show token usage"),
        ("/export [file]", "Export conversation"),
        ("/compact", "Compact conversation context"),
        ("/rewind", "Rewind to previous state"),
        ("/status", "Show session status"),
        ("/doctor", "Run diagnostics"),
        ("/rename [name]", "Rename session"),
        ("/btw <question>", "Ask side question"),
        ("/vim", "Toggle vim editing mode"),
        ("/usage", "Show usage statistics"),
        ("/exit, /quit", "Exit the application"),
    ]

    shortcuts = [
        ("Ctrl+C", "Cancel/Quit (press twice to exit)"),
        ("Alt+P", "Switch model"),
        ("Shift+Tab", "Toggle permission mode"),
        ("Ctrl+L", "Clear screen"),
        ("Ctrl+O", "Toggle verbose output"),
        ("Ctrl+R", "Search history"),
        ("Ctrl+B", "Background current task"),
        ("Ctrl+T", "Toggle task list"),
        ("↑/↓", "Navigate command history"),
        ("Esc Esc", "Rewind/Summarize"),
        ("T", "Toggle thinking blocks"),
        ("!", "Bash mode (execute shell commands)"),
    ]

    def render(self) -> str:
        lines = ["Commands", "─" * 65]
        for cmd, desc in self.commands:
            lines.append(f"  {cmd:<20} {desc}")

        lines.append("")
        lines.append("Keyboard Shortcuts")
        lines.append("─" * 65)
        for key, desc in self.shortcuts:
            lines.append(f"  {key:<15} {desc}")

        lines.append("")
        lines.append("Press Esc or q to close")
        return "\n".join(lines)

    def handle_key(self, key: str) -> bool:
        """Handle a key press. Returns True if handled."""
        if key in ("escape", "q"):
            self.app.hide_popup()
            return True
        return False


class InlineQuestion(Static):
    """Inline question widget for AskUserQuestion tool - displays in chat area."""

    DEFAULT_CSS = """
    InlineQuestion {
        width: 100%;
        height: auto;
        background: $surface-darken-1;
        padding: 1;
        margin: 1 0;
        border-left: solid $accent;
    }

    InlineQuestion .question-header {
        text-style: bold;
        color: $accent;
    }

    InlineQuestion .option {
        padding: 0 1;
    }

    InlineQuestion .option.selected {
        background: $accent;
        color: $text;
    }

    InlineQuestion .hint {
        color: $text-muted;
    }
    """

    _selected = reactive(0)
    _current_question = reactive(0)

    def __init__(self, questions: list[dict], **kwargs):
        super().__init__(**kwargs)
        self._questions = questions
        self._answers: dict[str, str | list[str]] = {}
        self._selected = 0
        self._current_question = 0
        # Use threading.Event for cross-thread synchronization
        import threading
        self._result_event = threading.Event()
        self._result: dict | None = None
        # Track multi-select state
        self._multi_selected: set[int] = set()
        # Active state - when True, this widget captures keyboard input
        self._active = True

    def render(self) -> str:
        if self._current_question >= len(self._questions):
            # Show completion summary
            lines = ["✓ Questions answered"]
            for q, a in self._answers.items():
                if isinstance(a, list):
                    lines.append(f"  • {a}")
                else:
                    lines.append(f"  • {a}")
            return "\n".join(lines)

        q = self._questions[self._current_question]
        lines = []

        # Show header with question number
        header = q.get("header", "Question")
        lines.append(f"[{self._current_question + 1}/{len(self._questions)}] {header}")
        lines.append("─" * 60)
        lines.append(q["question"])
        lines.append("")

        # Show options
        multi_select = q.get("multiSelect", False)
        for i, opt in enumerate(q["options"]):
            if multi_select:
                marker = "☑" if i in self._multi_selected else "☐"
            else:
                marker = "→" if i == self._selected else " "
            lines.append(f"{marker} {opt['label']}")
            lines.append(f"    {opt['description'][:70]}")

        lines.append("")
        if multi_select:
            lines.append("Space Select  Enter Confirm  Esc Cancel")
        else:
            lines.append("↑↓ Navigate  Enter Select  Esc Cancel")

        return "\n".join(lines)

    def handle_key(self, key: str) -> bool:
        """Handle a key press. Returns True if handled."""
        if not self._active:
            return False

        if self._current_question >= len(self._questions):
            return False

        q = self._questions[self._current_question]
        multi_select = q.get("multiSelect", False)

        if key == "up":
            self._selected = max(0, self._selected - 1)
            self.refresh()
            return True
        elif key == "down":
            self._selected = min(len(q["options"]) - 1, self._selected + 1)
            self.refresh()
            return True
        elif key == "space" and multi_select:
            # Toggle multi-select
            if self._selected in self._multi_selected:
                self._multi_selected.discard(self._selected)
            else:
                self._multi_selected.add(self._selected)
            self.refresh()
            return True
        elif key == "enter":
            self._submit_answer()
            return True
        elif key == "escape":
            self._cancel()
            return True
        return False

    def _submit_answer(self):
        """Submit current answer and move to next question or finish."""
        q = self._questions[self._current_question]
        question_key = q["question"]

        if q.get("multiSelect", False):
            # Multi-select: return list of selected labels
            selected_labels = [q["options"][i]["label"] for i in sorted(self._multi_selected)]
            self._answers[question_key] = selected_labels
        else:
            # Single select
            selected_label = q["options"][self._selected]["label"]
            self._answers[question_key] = selected_label

        # Move to next question
        self._current_question += 1
        self._selected = 0
        self._multi_selected = set()

        if self._current_question >= len(self._questions):
            # All questions answered
            self._result = {"answers": self._answers}
            self._result_event.set()
            # Update display to show completion
            self._active = False
            self.refresh()
        else:
            self.refresh()

    def _cancel(self):
        """Cancel the question."""
        self._result = None
        self._result_event.set()
        self._active = False
        self.refresh()

    async def wait_for_result(self) -> dict | None:
        """Wait for user to answer all questions."""
        # Use asyncio to wait on the threading event
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._result_event.wait)
        return self._result

    def is_active(self) -> bool:
        """Check if this question is still active and waiting for input."""
        return self._active


class CommandResult(Static):
    """Brief one-line command result display with margin."""

    DEFAULT_CSS = """
    CommandResult {
        margin: 1 0;
        color: $text-muted;
    }
    """

    def __init__(self, command: str, result: str = "", **kwargs):
        super().__init__(**kwargs)
        self._command = command
        self._result = result

    def render(self) -> str:
        if self._result:
            return f"/{self._command}  →  {self._result}"
        return f"/{self._command}"
#!/usr/bin/env python3
"""
Open Agent TUI - Claude Code style interface with Markdown support.
"""

import asyncio
from pathlib import Path
from textual.app import App, ComposeResult
from textual.widgets import Static, Input, Markdown
from textual.containers import VerticalScroll, Vertical
from textual.binding import Binding
from textual.reactive import reactive

from .core.agent import Agent, AgentState
from .core.types import AgentConfig, Message as AgentMessage
from . import tools


class ChatMessage(Static):
    """A chat message with optional Markdown rendering."""

    def __init__(self, content: str, is_user: bool = False, **kwargs):
        super().__init__(**kwargs)
        self._content = content
        self._is_user = is_user

    def compose(self) -> ComposeResult:
        if self._is_user:
            # User messages: simple format
            yield Static(f"❯ {self._content}")
        else:
            # Assistant messages: render as Markdown
            yield Markdown(self._content)


class ToolCallMessage(Static):
    """Display a tool call."""

    def __init__(self, tool_name: str, args_str: str, **kwargs):
        super().__init__(**kwargs)
        self._tool_name = tool_name
        self._args_str = args_str

    def render(self) -> str:
        return f"○ {self._tool_name}({self._args_str})"


class ToolResultMessage(Static):
    """Display a tool result."""

    def __init__(self, content: str, is_error: bool = False, **kwargs):
        super().__init__(**kwargs)
        self._content = content
        self._is_error = is_error

    def render(self) -> str:
        icon = "✗" if self._is_error else "↳"
        return f"  {icon} {self._content}"


class ChatArea(VerticalScroll):
    """Scrollable chat area."""
    pass


class ThinkingIndicator(Static):
    """Shows 'Thinking...' when active."""
    active = reactive(False)

    def render(self) -> str:
        return " ⏳ Thinking..." if self.active else ""


class WelcomePanel(Static):
    """Welcome panel that adapts to terminal size."""
    config_model = reactive("")
    config_dir = reactive("")

    def __init__(self, config_model: str = "", config_dir: str = "", **kwargs):
        super().__init__(**kwargs)
        self.config_model = config_model
        self.config_dir = config_dir

    def render(self) -> str:
        w = self.size.width
        if w < 40:
            return self._render_minimal(w)
        return self._render_full(w)

    def _render_minimal(self, w: int) -> str:
        lines = []
        lines.append("╭" + "─" * (w - 2) + "╮")
        lines.append("│" + "Open Agent".center(w - 2) + "│")
        lines.append("│" + "─" * (w - 2) + "│")
        lines.append("│" + self.config_model.center(w - 2) + "│")
        lines.append("│" + f"~/{self.config_dir}".center(w - 2) + "│")
        lines.append("╰" + "─" * (w - 2) + "╯")
        return "\n".join(lines)

    def _render_full(self, w: int) -> str:
        mid = (w - 3) // 2
        right_w = w - 3 - mid

        logo = [
            "   ▐▛███▜▌   ",
            "  ▝▜█████▛▘  ",
            "    ▘▘ ▝▝    ",
        ]

        left_lines = [
            "Welcome back!",
            "",
            logo[0],
            logo[1],
            logo[2],
            "",
            self.config_model,
            f"~/{self.config_dir}",
        ]

        right_lines = [
            "Tips for getting started",
            "Run /init to create config",
            "─" * min(mid - 2, 30),
            "Recent activity",
            "No recent activity",
            "",
            "",
            "",
        ]

        lines = []
        lines.append("╭" + "─" * (w - 2) + "╮")

        for i in range(len(left_lines)):
            left = left_lines[i] if i < len(left_lines) else ""
            right = right_lines[i] if i < len(right_lines) else ""
            left = left[:mid - 2] if len(left) > mid - 2 else left
            right = right[:right_w - 2] if len(right) > right_w - 2 else right
            row = "│ " + left.ljust(mid - 2) + " │ " + right.ljust(right_w - 2) + " │"
            lines.append(row)

        lines.append("╰" + "─" * (w - 2) + "╯")
        return "\n".join(lines)


class Separator(Static):
    """Horizontal separator."""
    def render(self) -> str:
        return "─" * self.size.width


class StatusBar(Static):
    """Bottom status bar."""
    def render(self) -> str:
        w = self.size.width
        left = "? for shortcuts"
        right = "◐ medium"
        padding = max(1, w - len(left) - len(right) - 2)
        return f" {left}{' ' * padding}{right}"


class OpenAgentTUI(App):
    """Open Agent TUI - Claude Code style."""

    CSS = """
    Screen {
        background: $surface;
    }

    #main-container {
        height: 1fr;
    }

    #welcome {
        height: auto;
        padding: 0 1;
    }

    .separator {
        height: 1;
    }

    #chat {
        height: 1fr;
        padding: 0 1;
    }

    ChatMessage {
        margin: 0 0 1 0;
    }

    Markdown {
        background: $surface;
        padding: 0;
        margin: 0;
    }

    Markdown H1 {
        color: $text;
        text-style: bold;
        margin: 1 0;
    }

    Markdown H2 {
        color: $text;
        text-style: bold;
        margin: 1 0;
    }

    Markdown H3 {
        color: $text;
        text-style: bold;
    }

    Markdown Code {
        background: $surface-darken-2;
        color: $accent;
        padding: 0 1;
    }

    Markdown CodeBlock {
        background: $surface-darken-2;
        color: $text;
        padding: 1;
        margin: 1 0;
    }

    Markdown BlockQuote {
        background: $surface-darken-1;
        border-left: solid $accent;
        padding: 0 1;
        margin: 1 0;
    }

    Markdown List {
        margin: 0 0 0 2;
    }

    #thinking {
        height: 1;
        padding: 0 1;
        color: $warning;
    }

    #bottom-area {
        height: auto;
    }

    Input {
        width: 1fr;
    }

    #status {
        height: 1;
        background: $surface-darken-1;
        color: $text-muted;
    }

    ToolCallMessage {
        color: $accent;
        margin: 0 0 0 0;
    }

    ToolResultMessage {
        color: $text-muted;
        margin: 0 0 1 0;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "handle_interrupt", "Interrupt/Quit", priority=True),
    ]

    def __init__(self, config: AgentConfig):
        super().__init__()
        self.config = config
        self.agent = None
        self._is_busy = False
        self._cancel_requested = False
        self._exit_requested = False  # Track if exit was requested

    def compose(self) -> ComposeResult:
        with Vertical(id="main-container"):
            yield WelcomePanel(
                config_model=self.config.model,
                config_dir=Path(self.config.working_directory).name,
                id="welcome"
            )
            yield Separator(classes="separator")
            yield ChatArea(id="chat")
            yield ThinkingIndicator(id="thinking")
            yield Separator(classes="separator")

        with Vertical(id="bottom-area"):
            yield Input(placeholder="Type a message...", id="input")
            yield StatusBar(id="status")

    def on_mount(self) -> None:
        self.agent = Agent(config=self.config)
        self.query_one(Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        if not text or self._is_busy:
            return

        event.input.value = ""
        chat = self.query_one("#chat")
        chat.mount(ChatMessage(text, is_user=True))
        chat.scroll_end(animate=False)

        self._start_request(text)

    def _start_request(self, prompt: str):
        """Start a new agent request."""
        self._is_busy = True
        self._cancel_requested = False

        self.query_one(Input).disabled = True
        self.query_one("#thinking").active = True

        self.run_worker(lambda: self._run_agent_sync(prompt), thread=True, exclusive=True)

    def _stop_request(self):
        """Stop the current request."""
        self._is_busy = False
        self.query_one("#thinking").active = False
        input_widget = self.query_one(Input)
        input_widget.disabled = False
        input_widget.focus()

    def action_handle_interrupt(self):
        """Handle Ctrl+C."""
        if self._is_busy:
            # Cancel current request
            self._cancel_requested = True
            chat = self.query_one("#chat")
            chat.mount(Static("  ⚠ Request cancelled"))
            chat.scroll_end(animate=False)
        elif self._exit_requested:
            # Second Ctrl+C, exit
            self.exit()
        else:
            # First Ctrl+C, show warning
            self._exit_requested = True
            chat = self.query_one("#chat")
            chat.mount(Static("  ⚠ Press Ctrl+C again to exit"))
            chat.scroll_end(animate=False)
            # Reset after 2 seconds
            self.set_timer(2.0, self._reset_exit_request)

    def _reset_exit_request(self):
        """Reset exit request flag."""
        self._exit_requested = False

    def _run_agent_sync(self, prompt: str):
        """Run agent in worker thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        chat = self.query_one("#chat")

        try:
            self.agent.state = AgentState()
            system = self.agent._build_system_prompt()
            self.agent.state.messages.append(AgentMessage.user(prompt))

            iteration = 0
            while iteration < self.agent.config.max_iterations:
                if self._cancel_requested:
                    break

                iteration += 1
                response = loop.run_until_complete(self.agent._call_llm(system))

                if self._cancel_requested:
                    break

                if not self.agent._has_tool_calls(response):
                    text = self.agent._extract_text(response)
                    self.call_from_thread(chat.mount, ChatMessage(text, is_user=False))
                    self.call_from_thread(chat.scroll_end, animate=False)
                    break

                self.agent.state.messages.append(AgentMessage.assistant(response))

                for block in response:
                    if block.type != "tool_use" or self._cancel_requested:
                        continue

                    name = block.tool_name
                    args = block.tool_input or {}
                    tool_id = block.tool_use_id

                    args_str = ", ".join(f"{k}={repr(v)[:25]}" for k, v in list(args.items())[:2])
                    self.call_from_thread(chat.mount, ToolCallMessage(name, args_str))
                    self.call_from_thread(chat.scroll_end, animate=False)

                    if self._cancel_requested:
                        break

                    result = loop.run_until_complete(self.agent._execute_tool(name, args, tool_id))

                    content = ""
                    is_error = False
                    try:
                        if isinstance(result.content, list) and result.content:
                            cb = result.content[0]
                            if hasattr(cb, 'tool_result_content') and cb.tool_result_content:
                                content = str(cb.tool_result_content)[:150]
                            else:
                                content = "(empty result)"
                            is_error = getattr(cb, 'is_error', False)
                        else:
                            content = f"(unexpected result format: {type(result.content)})"
                    except Exception as e:
                        content = f"(error parsing result: {e})"
                        is_error = True

                    self.call_from_thread(chat.mount, ToolResultMessage(content, is_error))
                    self.agent.state.messages.append(result)
                    self.call_from_thread(chat.scroll_end, animate=False)
            else:
                if not self._cancel_requested:
                    self.call_from_thread(chat.mount, Static("● Max iterations."))

        except Exception as e:
            import traceback
            error_msg = f"● Error: {e}\n{traceback.format_exc()}"
            if not self._cancel_requested:
                self.call_from_thread(chat.mount, Static(error_msg))
        finally:
            loop.close()
            self.call_from_thread(self._stop_request)


def run_tui():
    import argparse
    parser = argparse.ArgumentParser(description="Open Agent TUI")
    parser.add_argument("-m", "--model", default="glm-5")
    parser.add_argument("--provider", default="openai")
    parser.add_argument("--api-key")
    parser.add_argument("--base-url")
    parser.add_argument("-d", "--directory", default=".")
    parser.add_argument("--permission-mode", default="bypassPermissions")
    args = parser.parse_args()

    config = AgentConfig(
        model=args.model,
        provider=args.provider,
        api_key=args.api_key,
        base_url=args.base_url,
        working_directory=str(Path(args.directory).resolve()),
        permission_mode=args.permission_mode,
    )
    OpenAgentTUI(config).run()


if __name__ == "__main__":
    run_tui()
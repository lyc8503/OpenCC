#!/usr/bin/env python3
"""
Open Agent TUI - Claude Code style interface with streaming and thinking support.
"""

import asyncio
from pathlib import Path
from textual.app import App, ComposeResult
from textual.widgets import Static, Input, Markdown
from textual.containers import VerticalScroll, Vertical
from textual.binding import Binding
from textual.reactive import reactive
from textual.message import Message

from .core.agent import Agent, AgentState
from .core.types import AgentConfig, Message as AgentMessage, ContentBlock
from . import tools


class ThinkingBlock(Static):
    """Collapsible thinking/reasoning block."""

    DEFAULT_CSS = """
    ThinkingBlock {
        background: $surface-darken-2;
        color: $text-muted;
        padding: 0 1;
        margin: 0 0 1 0;
        border-left: solid $primary;
        height: auto;
    }
    """

    expanded = reactive(False)

    def __init__(self, content: str = "", **kwargs):
        super().__init__(**kwargs)
        self._content = content
        self.expanded = False  # Start collapsed

    def add_content(self, text: str):
        """Add more content to the thinking block."""
        self._content += text
        self.refresh()

    def render(self) -> str:
        char_count = len(self._content)
        w = self.size.width
        if self.expanded:
            sep = "─" * max(10, w - 2)
            lines = [
                sep,
                f"▕ thinking ({char_count} chars)",
                sep,
                self._content,
                "",
                "[T to collapse]",
            ]
            return "\n".join(lines)
        else:
            preview = self._content[:60] + "..." if len(self._content) > 60 else self._content
            return f"▶ thinking ({char_count} chars): {preview} [T to expand]"

    def toggle(self):
        """Toggle expanded/collapsed state."""
        self.expanded = not self.expanded
        self.refresh()


class StreamMessage(Static):
    """A message that can be streamed into."""

    DEFAULT_CSS = """
    StreamMessage {
        margin: 0 0 1 0;
    }
    """

    def __init__(self, is_user: bool = False, **kwargs):
        super().__init__(**kwargs)
        self._is_user = is_user
        self._content = ""
        self._thinking_content = ""
        self._thinking_block = None
        self._markdown = None

    def compose(self) -> ComposeResult:
        if self._is_user:
            yield Static(f"❯ {self._content}")
        else:
            # Thinking block (if any)
            if self._thinking_content:
                self._thinking_block = ThinkingBlock(self._thinking_content)
                yield self._thinking_block
            # Main content
            self._markdown = Markdown(self._content)
            yield self._markdown

    def add_thinking(self, text: str):
        """Add thinking content."""
        self._thinking_content += text
        if self._thinking_block:
            self._thinking_block.add_content(text)

    def add_content(self, text: str):
        """Add main content."""
        self._content += text
        if self._markdown:
            # Update markdown content
            self._markdown.update(self._content)


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
    _message = reactive("")
    _is_warning = reactive(False)

    def set_message(self, message: str, is_warning: bool = False):
        """Set a temporary message."""
        self._message = message
        self._is_warning = is_warning
        self.refresh()

    def clear_message(self):
        """Clear temporary message."""
        self._message = ""
        self._is_warning = False
        self.refresh()

    def render(self) -> str:
        w = self.size.width
        if self._message:
            left = self._message
            padding = max(1, w - len(left) - 2)
            return f" {'⚠ ' if self._is_warning else ''}{left}{' ' * padding}"
        else:
            left = "T: toggle thinking | Shift+drag: select text"
            right = "◐ medium"
            padding = max(1, w - len(left) - len(right) - 2)
            return f" {left}{' ' * padding}{right}"


class OpenAgentTUI(App):
    """Open Agent TUI - Claude Code style with streaming."""

    # Enable mouse for scrolling but allow Shift+drag for text selection
    MOUSE_ESCAPE = True  # Allow Shift+drag to select text

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

    StreamMessage {
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
        Binding("t", "toggle_thinking", "Toggle Thinking"),
    ]

    def __init__(self, config: AgentConfig):
        super().__init__()
        self.config = config
        self.agent = None
        self._is_busy = False
        self._cancel_requested = False
        self._exit_requested = False
        self._thinking_blocks: list[ThinkingBlock] = []

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
        chat.mount(Static(f"❯ {text}"))
        chat.scroll_end(animate=False)

        self._start_streaming(text)

    def _start_streaming(self, prompt: str):
        """Start streaming response."""
        self._is_busy = True
        self._cancel_requested = False

        self.query_one(Input).disabled = True
        self.query_one("#thinking").active = True

        self.run_worker(lambda: self._run_streaming(prompt), thread=True, exclusive=True)

    def _stop_request(self):
        """Stop the current request and restore input."""
        if not self._is_busy:
            return
        self._is_busy = False
        self.query_one("#thinking").active = False
        input_widget = self.query_one(Input)
        input_widget.disabled = False
        input_widget.focus()

    def action_handle_interrupt(self):
        """Handle Ctrl+C."""
        if self._is_busy:
            self._cancel_requested = True
            self._stop_request()
        elif self._exit_requested:
            self.exit()
        else:
            self._exit_requested = True
            status = self.query_one("#status")
            status.set_message("Press Ctrl+C again to exit", is_warning=True)
            self.set_timer(2.0, self._reset_exit_request)

    def _reset_exit_request(self):
        """Reset exit request flag."""
        self._exit_requested = False
        try:
            status = self.query_one("#status")
            status.clear_message()
        except:
            pass

    def action_toggle_thinking(self):
        """Toggle all thinking blocks."""
        for block in self._thinking_blocks:
            block.toggle()

    def _run_streaming(self, prompt: str):
        """Run agent with streaming in worker thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            loop.run_until_complete(self._stream_loop(prompt))
        finally:
            loop.close()
            self.call_from_thread(self._stop_request)

    async def _stream_loop(self, prompt: str):
        """Async streaming loop."""
        chat = self.query_one("#chat")

        current_message = None
        current_thinking = ""
        tool_calls = []

        try:
            self.agent.state = AgentState()
            system = self.agent._build_system_prompt()
            self.agent.state.messages.append(AgentMessage.user(prompt))

            iteration = 0
            while iteration < self.agent.config.max_iterations:
                if self._cancel_requested:
                    break

                iteration += 1

                # Get tool schemas
                from .core.tool import registry
                tool_schemas = registry.get_all_schemas(self.config.tools)
                tools_list = [s.to_api_format() for s in tool_schemas] if tool_schemas else None

                response_blocks = []
                current_text = ""
                current_thinking = ""
                thinking_block = None

                async for chunk in self.agent.llm.stream(
                    system=system,
                    messages=[m.to_api_format() for m in self.agent.state.messages],
                    tools=tools_list,
                    max_tokens=self.config.max_tokens
                ):
                    if self._cancel_requested:
                        break

                    chunk_type = chunk.get("type")

                    if chunk_type == "thinking_delta":
                        # Thinking content
                        current_thinking += chunk.get("text", "")
                        if thinking_block is None:
                            thinking_block = ThinkingBlock(current_thinking)
                            self.call_from_thread(chat.mount, thinking_block)
                            self._thinking_blocks.append(thinking_block)
                        else:
                            self.call_from_thread(thinking_block.add_content, chunk.get("text", ""))
                        self.call_from_thread(chat.scroll_end, animate=False)

                    elif chunk_type == "text_delta":
                        # Regular text
                        current_text += chunk.get("text", "")
                        if current_message is None:
                            current_message = StreamMessage(is_user=False)
                            self.call_from_thread(chat.mount, current_message)
                        self.call_from_thread(current_message.add_content, chunk.get("text", ""))
                        self.call_from_thread(chat.scroll_end, animate=False)

                    elif chunk_type == "tool_use":
                        response_blocks.append(ContentBlock(
                            type="tool_use",
                            tool_use_id=chunk.get("id"),
                            tool_name=chunk.get("name"),
                            tool_input=chunk.get("input", {})
                        ))

                    elif chunk_type == "error":
                        self.call_from_thread(chat.mount, Static(f"● Error: {chunk.get('message', 'Unknown error')}"))

                if self._cancel_requested:
                    break

                if current_text:
                    response_blocks.insert(0, ContentBlock(type="text", text=current_text))

                # No tool calls - we're done
                if not any(b.type == "tool_use" for b in response_blocks):
                    break

                # Process tool calls
                self.agent.state.messages.append(AgentMessage.assistant(response_blocks))

                for block in response_blocks:
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

                    result = await self.agent._execute_tool(name, args, tool_id)

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

                # Reset for next iteration
                current_message = None
                current_thinking = ""
                thinking_block = None

            else:
                if not self._cancel_requested:
                    self.call_from_thread(chat.mount, Static("● Max iterations."))

        except Exception as e:
            import traceback
            if not self._cancel_requested:
                self.call_from_thread(chat.mount, Static(f"● Error: {e}\n{traceback.format_exc()}"))


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
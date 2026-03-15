"""
Built-in slash commands for TUI - matching Claude Code CLI behavior.
"""

from ..commands import CommandRegistry
from ..widgets.selectors import ModelSelector, PermissionModeSelector, HelpOverlay
import json
from datetime import datetime


@CommandRegistry.register("help", "Show available commands", aliases=["?"])
async def cmd_help(app, args: str):
    """Show help for commands - displays popup."""
    help_overlay = HelpOverlay()
    app.show_popup(help_overlay)


@CommandRegistry.register("clear", "Clear conversation history", aliases=["reset", "new"])
async def cmd_clear(app, args: str):
    """Clear the conversation."""
    # Clear messages
    app.agent.state.messages.clear()
    app._thinking_blocks.clear()

    # Clear chat UI
    chat = app.query_one("#chat")
    chat.remove_children()

    # Show brief result
    app.show_command_result("clear", "conversation cleared")


@CommandRegistry.register("model", "Switch model")
async def cmd_model(app, args: str):
    """Switch or show model - displays selector."""
    if args:
        # Direct set if arg provided
        app.config.model = args.strip()
        if hasattr(app, 'agent') and app.agent:
            app.agent.config.model = args.strip()
        # Update status bar
        status = app.query_one("#status")
        status.update_status(app.config.model, app.config.permission_mode)
        app.show_command_result("model", f"switched to {args.strip()}")
    else:
        # Show model selector popup
        selector = ModelSelector(current_model=app.config.model)
        app.show_popup(selector)


@CommandRegistry.register("exit", "Exit the application", aliases=["quit"])
async def cmd_exit(app, args: str):
    """Exit the TUI."""
    app.exit()


@CommandRegistry.register("export", "Export conversation to file")
async def cmd_export(app, args: str):
    """Export conversation history."""
    messages = app.agent.state.messages

    if args:
        lines = []
        lines.append(f"# Open Agent Conversation")
        lines.append(f"Exported: {datetime.now().isoformat()}")
        lines.append(f"Model: {app.config.model}")
        lines.append("")

        for msg in messages:
            role = msg.role.value if hasattr(msg.role, 'value') else str(msg.role)
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            lines.append(f"## {role.upper()}")
            lines.append(content)
            lines.append("")

        output = "\n".join(lines)
        with open(args.strip(), "w") as f:
            f.write(output)
        app.show_command_result("export", f"saved to {args.strip()}")
    else:
        app.show_command_result("export", f"{len(messages)} messages — use /export <file> to save")


@CommandRegistry.register("cost", "Show token usage statistics")
async def cmd_cost(app, args: str):
    """Show estimated token usage."""
    messages = app.agent.state.messages
    total_chars = 0
    for msg in messages:
        if isinstance(msg.content, str):
            total_chars += len(msg.content)
        elif isinstance(msg.content, list):
            for block in msg.content:
                if hasattr(block, 'text') and block.text:
                    total_chars += len(block.text)

    # Rough estimate: ~4 chars per token
    estimated_tokens = total_chars // 4

    app.show_command_result("cost", f"{estimated_tokens:,} tokens ({len(messages)} msgs)")


@CommandRegistry.register("theme", "Change color theme")
async def cmd_theme(app, args: str):
    """Change or show theme."""
    themes = ["dark", "light", "ansi"]

    if args:
        theme = args.strip().lower()
        if theme in themes:
            app._current_theme = theme
            app.show_command_result("theme", f"switched to {theme}")
        else:
            app.show_command_result("theme", f"unknown (available: {', '.join(themes)})")
    else:
        current = getattr(app, '_current_theme', 'dark')
        app.show_command_result("theme", f"current: {current}")


@CommandRegistry.register("compact", "Compact conversation to save context")
async def cmd_compact(app, args: str):
    """Compact the conversation."""
    messages = app.agent.state.messages
    if len(messages) <= 2:
        app.show_command_result("compact", "nothing to compact")
        return

    # Keep first and last few messages
    keep_first = 2
    keep_last = 2

    if len(messages) > keep_first + keep_last:
        removed = len(messages) - keep_first - keep_last
        messages[:] = messages[:keep_first] + messages[-keep_last:]
        app.show_command_result("compact", f"removed {removed} msgs, kept {len(messages)}")
    else:
        app.show_command_result("compact", "conversation too short")


@CommandRegistry.register("config", "Show configuration", aliases=["settings"])
async def cmd_config(app, args: str):
    """Show current configuration."""
    app.show_command_result(
        "config",
        f"{app.config.model} | {app.config.permission_mode} | {app.config.max_tokens} tokens"
    )


@CommandRegistry.register("status", "Show session status")
async def cmd_status(app, args: str):
    """Show current session status."""
    app.show_command_result(
        "status",
        f"{app.config.model} | {len(app.agent.state.messages)} msgs | {app.agent.state.tool_call_count} tools"
    )


@CommandRegistry.register("rename", "Rename the session")
async def cmd_rename(app, args: str):
    """Rename the current session."""
    if args:
        app._session_name = args.strip()
        app.show_command_result("rename", f"→ {args.strip()}")
    else:
        current = getattr(app, '_session_name', 'unnamed')
        app.show_command_result("rename", f"current: {current}")


@CommandRegistry.register("doctor", "Diagnose installation")
async def cmd_doctor(app, args: str):
    """Run diagnostics."""
    import sys

    checks = []
    if app.config.api_key:
        checks.append("API key ✓")
    else:
        checks.append("API key ✗")

    if app.agent:
        checks.append("agent ✓")
    else:
        checks.append("agent ✗")

    checks.append(f"Python {sys.version.split()[0]}")

    app.show_command_result("doctor", " | ".join(checks))


@CommandRegistry.register("vim", "Toggle vim editing mode")
async def cmd_vim(app, args: str):
    """Toggle vim mode for input."""
    current = getattr(app, '_vim_mode', False)
    app._vim_mode = not current
    state = "on" if not current else "off"
    app.show_command_result("vim", f"{state}")


@CommandRegistry.register("usage", "Show usage statistics")
async def cmd_usage(app, args: str):
    """Show usage stats."""
    messages = app.agent.state.messages
    turns = sum(1 for m in messages if hasattr(m, 'role') and m.role.value == 'user')

    app.show_command_result("usage", f"{turns} turns | {len(messages)} msgs | {app.agent.state.tool_call_count} tools")


@CommandRegistry.register("btw", "Ask a side question without adding to history")
async def cmd_btw(app, args: str):
    """Handle side question."""
    if not args:
        app.show_command_result("btw", "usage: /btw <question>")
        return

    # This is a simplified version - full implementation would
    # make a quick API call without tool access
    app.show_command_result("btw", f"asked: {args[:30]}...")


@CommandRegistry.register("rewind", "Rewind conversation to previous state", aliases=["checkpoint"])
async def cmd_rewind(app, args: str):
    """Rewind the conversation."""
    messages = app.agent.state.messages
    if len(messages) < 2:
        app.show_command_result("rewind", "nothing to rewind")
        return

    # Remove last exchange
    removed = 0
    while len(messages) > 0 and removed < 2:
        messages.pop()
        removed += 1

    app.show_command_result("rewind", f"removed {removed} msgs, {len(messages)} remaining")
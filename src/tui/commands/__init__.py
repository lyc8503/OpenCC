"""
Command registry for TUI slash commands.
"""

from typing import Callable, Awaitable, TYPE_CHECKING

if TYPE_CHECKING:
    from ..tui import OpenAgentTUI

CommandHandler = Callable[["OpenAgentTUI", str], Awaitable[None]]


class CommandRegistry:
    """Registry for TUI slash commands."""

    _commands: dict[str, CommandHandler] = {}
    _descriptions: dict[str, str] = {}
    _aliases: dict[str, str] = {}

    @classmethod
    def register(cls, name: str, description: str = "", aliases: list[str] = None):
        """Register a command with optional aliases."""
        def decorator(func: CommandHandler):
            cls._commands[name] = func
            cls._descriptions[name] = description
            if aliases:
                for alias in aliases:
                    cls._aliases[alias] = name
            return func
        return decorator

    @classmethod
    def get_handler(cls, name: str) -> CommandHandler | None:
        """Get command handler by name or alias."""
        # Check alias first
        if name in cls._aliases:
            name = cls._aliases[name]
        return cls._commands.get(name)

    @classmethod
    def get_description(cls, name: str) -> str:
        """Get command description."""
        if name in cls._aliases:
            name = cls._aliases[name]
        return cls._descriptions.get(name, "")

    @classmethod
    def list_commands(cls) -> list[str]:
        """List all registered commands."""
        return sorted(cls._commands.keys())

    @classmethod
    async def execute(cls, app: "OpenAgentTUI", command: str) -> bool:
        """Execute a command. Returns True if command exists."""
        # Parse command and args
        command = command.strip()
        if " " in command:
            name, args = command.split(" ", 1)
        else:
            name, args = command, ""

        handler = cls.get_handler(name)
        if handler:
            try:
                await handler(app, args)
                return True
            except Exception as e:
                app.show_error(f"Command error: {e}")
                return True
        return False

    @classmethod
    def format_help(cls) -> str:
        """Format help text for all commands."""
        lines = ["Available commands:"]
        for name in sorted(cls._commands.keys()):
            desc = cls._descriptions.get(name, "")
            lines.append(f"  /{name:<15} {desc}")
        return "\n".join(lines)
"""
Permission management for tool execution.
"""

from typing import Callable, Literal
from dataclasses import dataclass, field
import re


@dataclass
class PermissionRule:
    """A rule for allowing or denying tool execution."""
    pattern: str  # glob pattern for tool name, e.g. "Bash(git:*)" or "Read"
    allow: bool = True
    reason: str | None = None


class PermissionManager:
    """
    Manages permissions for tool execution.

    Supports multiple permission modes:
    - default: Ask for permission on each tool call
    - acceptEdits: Auto-accept file editing tools
    - bypassPermissions: Allow all tools without asking
    - plan: Only allow planning-related tools
    - auto: Auto-approve based on tool type
    """

    SAFE_TOOLS = {"Read", "Glob", "Grep", "TaskList", "TaskGet"}
    EDIT_TOOLS = {"Edit", "Write", "Bash"}

    def __init__(
        self,
        mode: Literal["default", "acceptEdits", "bypassPermissions", "plan", "auto"] = "default",
        callback: Callable[[str, dict], bool] | None = None,
        rules: list[PermissionRule] | None = None
    ):
        self.mode = mode
        self.callback = callback
        self.rules = rules or []
        self._denied_tools: set[str] = set()

    async def check(self, tool_name: str, tool_input: dict) -> bool:
        """
        Check if a tool call is allowed.

        Returns True if allowed, False if denied.
        """
        # Check explicit rules first
        for rule in self.rules:
            if self._match_pattern(tool_name, rule.pattern):
                if not rule.allow:
                    return False
                if rule.allow and rule.reason is None:
                    return True

        # Check mode-based rules
        if self.mode == "bypassPermissions":
            return True

        if self.mode == "acceptEdits" and tool_name in self.EDIT_TOOLS:
            return True

        if self.mode == "plan":
            # Only allow safe/read-only tools in plan mode
            return tool_name in self.SAFE_TOOLS

        if self.mode == "auto":
            # Auto-approve safe tools
            if tool_name in self.SAFE_TOOLS:
                return True
            # Ask for others
            return await self._ask_permission(tool_name, tool_input)

        # Default mode: ask for permission
        return await self._ask_permission(tool_name, tool_input)

    async def _ask_permission(self, tool_name: str, tool_input: dict) -> bool:
        """Ask for permission using the callback."""
        if self.callback is None:
            # Default to allowing if no callback
            return True

        return self.callback(tool_name, tool_input)

    def _match_pattern(self, tool_name: str, pattern: str) -> bool:
        """Check if tool name matches a pattern."""
        # Handle Bash(cmd:*) patterns
        if "(" in pattern:
            base_pattern, cmd_pattern = pattern.split("(", 1)
            cmd_pattern = cmd_pattern.rstrip(")")

            if tool_name == base_pattern:
                return True

            # Check if tool input matches
            # This would need tool_input context to work fully
            return tool_name == base_pattern

        return tool_name == pattern

    def add_rule(self, pattern: str, allow: bool = True, reason: str | None = None):
        """Add a permission rule."""
        self.rules.append(PermissionRule(pattern=pattern, allow=allow, reason=reason))

    def deny_tool(self, tool_name: str):
        """Permanently deny a tool for this session."""
        self._denied_tools.add(tool_name)

    def allow_tool(self, tool_name: str):
        """Remove a tool from the denied list."""
        self._denied_tools.discard(tool_name)
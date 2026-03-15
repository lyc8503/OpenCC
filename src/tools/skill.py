"""
Skill tool - Execute predefined skills.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from typing import Callable


class SkillRegistry:
    """Registry for available skills."""
    _instance: "SkillRegistry | None" = None
    skills: dict[str, Callable] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register_skill(self, name: str, handler: Callable):
        """Register a skill handler."""
        self.skills[name] = handler

    def get_skill(self, name: str) -> Callable | None:
        """Get a skill handler by name."""
        return self.skills.get(name)


@registry.register
class SkillTool(Tool):
    """Execute a skill within the main conversation."""

    name = "Skill"
    description = """Execute a skill within the main conversation.

When users reference a "slash command" or "/<something>" (e.g., "/commit", "/review-pr"),
they are referring to a skill. Use this tool to invoke it.

Available skills are listed in system-reminder messages in the conversation.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "skill": {
                "description": "The skill name (e.g., 'commit', 'review-pr', 'pdf')",
                "type": "string"
            },
            "args": {
                "description": "Optional arguments for the skill",
                "type": "string"
            }
        },
        "required": ["skill"],
        "additionalProperties": False
    }

    # Built-in skills
    BUILTIN_SKILLS = {
        "commit": "Create a git commit with staged changes",
        "review-pr": "Review a pull request",
        "test": "Run tests",
        "lint": "Run linter",
        "format": "Format code",
    }

    async def execute(self, skill: str, args: str | None = None) -> ToolResult:
        """Execute the skill."""
        registry = SkillRegistry()

        # Check for registered skill
        handler = registry.get_skill(skill)

        if handler:
            try:
                result = await handler(args)
                return ToolResult(
                    output=str(result),
                    metadata={"skill": skill, "args": args}
                )
            except Exception as e:
                return ToolResult(
                    output=f"Skill execution error: {e}",
                    is_error=True
                )

        # Check for built-in skill
        if skill in self.BUILTIN_SKILLS:
            return ToolResult(
                output=f"Skill '{skill}' is available but no handler registered.\n"
                       f"Description: {self.BUILTIN_SKILLS[skill]}\n"
                       f"Args: {args or 'none'}",
                metadata={"skill": skill, "args": args, "builtin": True}
            )

        return ToolResult(
            output=f"Unknown skill: {skill}\n"
                   f"Available skills: {list(self.BUILTIN_SKILLS.keys())}",
            is_error=True
        )


def register_skill(name: str):
    """Decorator to register a skill handler."""
    def decorator(func: Callable):
        registry = SkillRegistry()
        registry.register_skill(name, func)
        return func
    return decorator
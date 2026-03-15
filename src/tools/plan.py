"""
Plan mode tools - Planning and implementation workflow.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path


class PlanManager:
    """Global plan manager."""
    _instance = None
    in_plan_mode: bool = False
    plan_file: str | None = None
    plan_content: str = ""

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance


@registry.register
class EnterPlanModeTool(Tool):
    """Enter planning mode for implementation tasks."""

    name = "EnterPlanMode"
    description = """Use this tool proactively when about to start a non-trivial implementation task.

Getting user sign-off on your approach before writing code prevents wasted effort.
This tool transitions you into plan mode where you can explore and design an implementation.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {},
        "additionalProperties": False
    }

    async def execute(self) -> ToolResult:
        """Enter plan mode."""
        manager = PlanManager()

        if manager.in_plan_mode:
            return ToolResult(output="Already in plan mode.")

        manager.in_plan_mode = True
        manager.plan_file = None
        manager.plan_content = ""

        return ToolResult(
            output="Entered plan mode.\n\n"
                   "In this mode, you should:\n"
                   "1. Explore the codebase to understand existing patterns\n"
                   "2. Design an implementation approach\n"
                   "3. Write your plan to a file\n"
                   "4. Use ExitPlanMode to get user approval\n\n"
                   "You have read-only access to tools. No code modifications until exit."
        )


@registry.register
class ExitPlanModeTool(Tool):
    """Exit plan mode and request user approval."""

    name = "ExitPlanMode"
    description = """Use this tool when you have finished writing your plan.

This tool signals that you're done planning and ready for user review.
The user will see the contents of your plan file.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "allowedPrompts": {
                "description": "Prompt-based permissions needed to implement the plan",
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tool": {
                            "type": "string",
                            "enum": ["Bash"]
                        },
                        "prompt": {
                            "type": "string"
                        }
                    },
                    "required": ["tool", "prompt"]
                }
            }
        },
        "additionalProperties": False
    }

    async def execute(self, allowedPrompts: list | None = None) -> ToolResult:
        """Exit plan mode."""
        manager = PlanManager()

        if not manager.in_plan_mode:
            return ToolResult(output="Not in plan mode.")

        manager.in_plan_mode = False

        return ToolResult(
            output="Exited plan mode.\n\n"
                   "The plan is ready for user review.\n"
                   "Once approved, you can begin implementation.",
            metadata={
                "plan_content": manager.plan_content,
                "allowed_prompts": allowedPrompts
            }
        )


def write_plan(content: str, plan_file: str = "PLAN.md") -> None:
    """Write plan content during plan mode."""
    manager = PlanManager()
    manager.plan_file = plan_file
    manager.plan_content = content


def is_in_plan_mode() -> bool:
    """Check if currently in plan mode."""
    return PlanManager().in_plan_mode
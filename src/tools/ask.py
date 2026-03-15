"""
AskUserQuestion tool - Ask the user questions during execution.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from typing import Literal


@registry.register
class AskUserQuestionTool(Tool):
    """Ask the user questions during execution."""

    name = "AskUserQuestion"
    description = """Use this tool when you need to ask the user questions during execution. This allows you to:

1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices
4. Offer choices to the user about direction

Plan mode note: In plan mode, use this tool to clarify requirements or choose between approaches BEFORE finalizing your plan.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "questions": {
                "description": "Questions to ask the user (1-4 questions)",
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "description": "The complete question to ask the user. Should be clear, specific, and end with a question mark.",
                            "type": "string"
                        },
                        "header": {
                            "description": "Very short label displayed as a chip/tag (max 12 chars). Examples: \"Auth method\", \"Library\", \"Approach\".",
                            "type": "string"
                        },
                        "options": {
                            "description": "The available choices for this question. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option - that is provided automatically.",
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {
                                        "description": "The display text for this option. Should be concise (1-5 words) and clearly describe the choice.",
                                        "type": "string"
                                    },
                                    "description": {
                                        "description": "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.",
                                        "type": "string"
                                    },
                                    "preview": {
                                        "description": "Optional preview content rendered when this option is focused. For mockups, code snippets, or visual comparisons.",
                                        "type": "string"
                                    }
                                },
                                "required": ["label", "description"],
                                "additionalProperties": False
                            }
                        },
                        "multiSelect": {
                            "description": "Set to true to allow the user to select multiple options instead of just one.",
                            "type": "boolean",
                            "default": False
                        }
                    },
                    "required": ["question", "header", "options", "multiSelect"],
                    "additionalProperties": False
                }
            },
            "metadata": {
                "description": "Optional metadata for tracking and analytics purposes. Not displayed to user.",
                "type": "object",
                "properties": {
                    "source": {
                        "description": "Optional identifier for the source of this question.",
                        "type": "string"
                    }
                }
            }
        },
        "required": ["questions"],
        "additionalProperties": False
    }

    def __init__(self, working_directory: str = "."):
        super().__init__(working_directory)
        self._callback = None

    def set_callback(self, callback):
        """Set a callback to handle questions."""
        self._callback = callback

    async def execute(
        self,
        questions: list[dict],
        metadata: dict | None = None
    ) -> ToolResult:
        """Ask the user questions."""

        if self._callback:
            # Use the callback to get answers
            try:
                answers = await self._callback(questions)
                return ToolResult(
                    output=f"User responses: {answers}",
                    metadata={"answers": answers}
                )
            except Exception as e:
                return ToolResult(
                    output=f"Error getting user response: {e}",
                    is_error=True
                )

        # Default behavior: return formatted questions for CLI
        lines = ["# Questions for you:", ""]
        for i, q in enumerate(questions, 1):
            lines.append(f"## {q['header']}")
            lines.append(q["question"])
            lines.append("")
            for j, opt in enumerate(q["options"], 1):
                lines.append(f"  [{j}] {opt['label']}: {opt['description']}")
                if opt.get("preview"):
                    lines.append(f"      Preview: {opt['preview'][:50]}...")
            lines.append("")

        lines.append("Please provide your answers.")

        return ToolResult(
            output="\n".join(lines),
            metadata={"questions": questions, "waiting_for_input": True}
        )
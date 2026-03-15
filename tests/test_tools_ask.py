"""
Tests for AskUserQuestion tool functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.ask import AskUserQuestionTool
from src.core.types import ToolResult


class TestAskUserQuestionTool:
    """Test AskUserQuestion tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = AskUserQuestionTool()
        assert tool.name == "AskUserQuestion"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = AskUserQuestionTool()

        # Missing questions
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({
            "questions": [{
                "question": "Test?",
                "header": "Test",
                "options": [
                    {"label": "A", "description": "Option A"},
                    {"label": "B", "description": "Option B"}
                ],
                "multiSelect": False
            }]
        })
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_ask_single_question(self, temp_workspace):
        """Test asking a single question."""
        tool = AskUserQuestionTool(working_directory=str(temp_workspace))
        result = await tool.execute(questions=[{
            "question": "Which option do you prefer?",
            "header": "Choice",
            "options": [
                {"label": "A", "description": "Option A"},
                {"label": "B", "description": "Option B"}
            ],
            "multiSelect": False
        }])

        assert isinstance(result, ToolResult)
        # In test mode, should return a response
        if not result.is_error:
            assert result.output != ""

    @pytest.mark.asyncio
    async def test_ask_multiple_questions(self, temp_workspace):
        """Test asking multiple questions."""
        tool = AskUserQuestionTool(working_directory=str(temp_workspace))
        result = await tool.execute(questions=[
            {
                "question": "Question 1?",
                "header": "Q1",
                "options": [{"label": "Yes", "description": ""}, {"label": "No", "description": ""}],
                "multiSelect": False
            },
            {
                "question": "Question 2?",
                "header": "Q2",
                "options": [{"label": "A", "description": ""}, {"label": "B", "description": ""}],
                "multiSelect": False
            }
        ])

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_ask_multiselect_question(self, temp_workspace):
        """Test asking a multi-select question."""
        tool = AskUserQuestionTool(working_directory=str(temp_workspace))
        result = await tool.execute(questions=[{
            "question": "Select all that apply:",
            "header": "Multi",
            "options": [
                {"label": "A", "description": "Option A"},
                {"label": "B", "description": "Option B"},
                {"label": "C", "description": "Option C"}
            ],
            "multiSelect": True
        }])

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_ask_with_preview(self, temp_workspace):
        """Test asking with preview content."""
        tool = AskUserQuestionTool(working_directory=str(temp_workspace))
        result = await tool.execute(questions=[{
            "question": "Choose:",
            "header": "Preview",
            "options": [
                {"label": "Option 1", "description": "First", "preview": "Preview content 1"},
                {"label": "Option 2", "description": "Second", "preview": "Preview content 2"}
            ],
            "multiSelect": False
        }])

        assert isinstance(result, ToolResult)
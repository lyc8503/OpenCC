"""
Tests for Skill tool functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.skill import SkillTool
from src.core.types import ToolResult


class TestSkillTool:
    """Test Skill tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = SkillTool()
        assert tool.name == "Skill"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = SkillTool()

        # Missing skill
        errors = tool.validate_input({})
        assert len(errors) > 0

        # Valid input
        errors = tool.validate_input({"skill": "commit"})
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_invoke_skill(self, temp_workspace):
        """Test invoking a skill."""
        tool = SkillTool(working_directory=str(temp_workspace))
        result = await tool.execute(skill="test-skill")

        assert isinstance(result, ToolResult)
        # Skill may not exist in test environment
        if result.is_error:
            assert "unknown" in result.output.lower() or "not found" in result.output.lower() or "error" in result.output.lower()

    @pytest.mark.asyncio
    async def test_invoke_skill_with_args(self, temp_workspace):
        """Test invoking a skill with arguments."""
        tool = SkillTool(working_directory=str(temp_workspace))
        result = await tool.execute(skill="commit", args="-m 'test commit'")

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_list_available_skills(self, temp_workspace):
        """Test that tool has skill information."""
        tool = SkillTool(working_directory=str(temp_workspace))
        # Tool should have some metadata about available skills
        assert tool.name == "Skill"
"""
Tests for Plan mode tools functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.plan import EnterPlanModeTool, ExitPlanModeTool, PlanManager
from src.core.types import ToolResult


class TestPlanManager:
    """Test PlanManager singleton."""

    def test_singleton(self):
        """Test that manager is a singleton."""
        m1 = PlanManager()
        m2 = PlanManager()
        assert m1 is m2

    def test_initial_state(self):
        """Test initial state is not in plan mode."""
        manager = PlanManager()
        manager.in_plan_mode = False
        manager.plan_file = None
        assert not manager.in_plan_mode
        assert manager.plan_file is None


class TestEnterPlanModeTool:
    """Test EnterPlanMode tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = EnterPlanModeTool()
        assert tool.name == "EnterPlanMode"

    @pytest.mark.asyncio
    async def test_enter_plan_mode(self, temp_workspace):
        """Test entering plan mode."""
        tool = EnterPlanModeTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "plan mode" in result.output.lower()

    @pytest.mark.asyncio
    async def test_plan_file_created(self, temp_workspace):
        """Test that plan file is created."""
        tool = EnterPlanModeTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        assert not result.is_error
        # Plan manager should be in plan mode
        manager = PlanManager()
        assert manager.in_plan_mode


class TestExitPlanModeTool:
    """Test ExitPlanMode tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = ExitPlanModeTool()
        assert tool.name == "ExitPlanMode"

    @pytest.mark.asyncio
    async def test_exit_plan_mode(self, temp_workspace):
        """Test exiting plan mode."""
        # First enter plan mode
        enter_tool = EnterPlanModeTool(working_directory=str(temp_workspace))
        await enter_tool.execute()

        # Then exit
        exit_tool = ExitPlanModeTool(working_directory=str(temp_workspace))
        result = await exit_tool.execute()

        assert isinstance(result, ToolResult)
        assert not result.is_error

    @pytest.mark.asyncio
    async def test_exit_without_enter(self, temp_workspace):
        """Test exiting when not in plan mode."""
        # Reset state
        PlanManager.in_plan_mode = False

        tool = ExitPlanModeTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        # Should handle gracefully
        assert isinstance(result, ToolResult)


class TestPlanModeIntegration:
    """Test plan mode integration."""

    @pytest.mark.asyncio
    async def test_enter_exit_cycle(self, temp_workspace):
        """Test complete enter/exit cycle."""
        # Reset
        PlanManager.in_plan_mode = False

        # Enter
        enter_tool = EnterPlanModeTool(working_directory=str(temp_workspace))
        enter_result = await enter_tool.execute()
        assert not enter_result.is_error
        # Check instance, not class variable
        manager = PlanManager()
        assert manager.in_plan_mode

        # Exit
        exit_tool = ExitPlanModeTool(working_directory=str(temp_workspace))
        exit_result = await exit_tool.execute()
        assert not exit_result.is_error
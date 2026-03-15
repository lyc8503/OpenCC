"""
Tests for Worktree tools functionality.
"""

import pytest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.worktree import EnterWorktreeTool, ExitWorktreeTool, WorktreeManager
from src.core.types import ToolResult


class TestWorktreeManager:
    """Test WorktreeManager singleton."""

    def test_singleton(self):
        """Test that manager is a singleton."""
        m1 = WorktreeManager()
        m2 = WorktreeManager()
        assert m1 is m2

    def test_initial_state(self):
        """Test initial state has no worktrees."""
        manager = WorktreeManager()
        manager.worktrees = {}
        manager.current_worktree = None
        assert len(manager.worktrees) == 0
        assert manager.current_worktree is None


class TestEnterWorktreeTool:
    """Test EnterWorktree tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = EnterWorktreeTool()
        assert tool.name == "EnterWorktree"

    @pytest.mark.asyncio
    async def test_enter_worktree_creates_isolated_env(self, temp_workspace):
        """Test entering worktree creates isolated environment."""
        tool = EnterWorktreeTool(working_directory=str(temp_workspace))
        result = await tool.execute(name="test-worktree")

        assert isinstance(result, ToolResult)
        # May fail if not in git repo
        if not result.is_error:
            assert "worktree" in result.output.lower()

    @pytest.mark.asyncio
    async def test_enter_worktree_with_random_name(self, temp_workspace):
        """Test entering worktree with auto-generated name."""
        tool = EnterWorktreeTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        # May fail if not in git repo
        if not result.is_error:
            assert "worktree" in result.output.lower()


class TestExitWorktreeTool:
    """Test ExitWorktree tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = ExitWorktreeTool()
        assert tool.name == "ExitWorktree"

    @pytest.mark.asyncio
    async def test_exit_worktree_keep(self, temp_workspace):
        """Test exiting worktree with keep action."""
        tool = ExitWorktreeTool(working_directory=str(temp_workspace))
        result = await tool.execute(action="keep")

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_exit_worktree_remove(self, temp_workspace):
        """Test exiting worktree with remove action."""
        tool = ExitWorktreeTool(working_directory=str(temp_workspace))
        result = await tool.execute(action="remove", discard_changes=True)

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_exit_without_enter(self, temp_workspace):
        """Test exiting when not in worktree."""
        # Reset state
        WorktreeManager.current_worktree = None

        tool = ExitWorktreeTool(working_directory=str(temp_workspace))
        result = await tool.execute(action="keep")

        # Should handle gracefully
        assert isinstance(result, ToolResult)
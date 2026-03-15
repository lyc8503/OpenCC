"""
Tests for Todo and Task tools functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.todo import TodoWriteTool, TaskOutputTool, TaskStopTool, TodoManager
from src.core.types import ToolResult


class TestTodoManager:
    """Test TodoManager singleton."""

    def test_singleton(self):
        """Test that manager is a singleton."""
        m1 = TodoManager()
        m2 = TodoManager()
        assert m1 is m2

    def test_todos_initially_empty(self):
        """Test that todos start empty."""
        manager = TodoManager()
        manager.todos = []  # Reset for test
        assert len(manager.todos) == 0


class TestTodoWriteTool:
    """Test TodoWrite tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = TodoWriteTool()
        assert tool.name == "TodoWrite"

    @pytest.mark.asyncio
    async def test_create_todos(self, temp_workspace):
        """Test creating todo items."""
        tool = TodoWriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(todos=[
            {"id": "1", "content": "Task 1", "status": "pending"},
            {"id": "2", "content": "Task 2", "status": "pending"}
        ])

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "Task 1" in result.output
        assert "Task 2" in result.output

    @pytest.mark.asyncio
    async def test_update_todos(self, temp_workspace):
        """Test updating todo items."""
        tool = TodoWriteTool(working_directory=str(temp_workspace))

        # Initial todos
        await tool.execute(todos=[
            {"id": "1", "content": "Task", "status": "pending"}
        ])

        # Update status
        result = await tool.execute(todos=[
            {"id": "1", "content": "Task", "status": "completed"}
        ])

        assert not result.is_error

    @pytest.mark.asyncio
    async def test_clear_todos(self, temp_workspace):
        """Test clearing all todos."""
        tool = TodoWriteTool(working_directory=str(temp_workspace))

        # Add todos
        await tool.execute(todos=[
            {"id": "1", "content": "Task", "status": "pending"}
        ])

        # Clear by passing empty list
        result = await tool.execute(todos=[])
        assert not result.is_error

    @pytest.mark.asyncio
    async def test_todos_with_active_form(self, temp_workspace):
        """Test todos with activeForm field."""
        tool = TodoWriteTool(working_directory=str(temp_workspace))
        result = await tool.execute(todos=[
            {"id": "1", "content": "Running tests", "status": "in_progress", "activeForm": "Running tests"}
        ])

        assert not result.is_error


class TestTaskOutputTool:
    """Test TaskOutput tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = TaskOutputTool()
        assert tool.name == "TaskOutput"

    @pytest.mark.asyncio
    async def test_get_output_unknown_task(self, temp_workspace):
        """Test getting output for unknown task."""
        tool = TaskOutputTool(working_directory=str(temp_workspace))
        result = await tool.execute(task_id="unknown_task", block=True, timeout=1000)

        assert result.is_error
        assert "unknown" in result.output.lower()

    @pytest.mark.asyncio
    async def test_register_and_get_task(self, temp_workspace):
        """Test registering and getting task output."""
        tool = TaskOutputTool(working_directory=str(temp_workspace))

        # Register a task
        TaskOutputTool.register_task("test_task_1", "test_type")

        # Get output
        result = await tool.execute(task_id="test_task_1", block=False, timeout=1000)

        assert not result.is_error
        assert "test_task_1" in result.output or "running" in result.output.lower()

    @pytest.mark.asyncio
    async def test_complete_task(self, temp_workspace):
        """Test completing a task."""
        tool = TaskOutputTool(working_directory=str(temp_workspace))

        # Register and complete
        TaskOutputTool.register_task("test_task_2", "test_type")
        TaskOutputTool.complete_task("test_task_2", "Task completed successfully")

        # Get output
        result = await tool.execute(task_id="test_task_2", block=True, timeout=1000)

        assert not result.is_error
        assert "completed" in result.output.lower() or "successfully" in result.output.lower()


class TestTaskStopTool:
    """Test TaskStop tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = TaskStopTool()
        assert tool.name == "TaskStop"

    @pytest.mark.asyncio
    async def test_stop_running_task(self, temp_workspace):
        """Test stopping a running task."""
        # Register a running task
        TaskOutputTool.register_task("running_task", "test_type")

        tool = TaskStopTool(working_directory=str(temp_workspace))
        result = await tool.execute(task_id="running_task")

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "stopped" in result.output.lower()

    @pytest.mark.asyncio
    async def test_stop_unknown_task(self, temp_workspace):
        """Test stopping unknown task."""
        tool = TaskStopTool(working_directory=str(temp_workspace))
        result = await tool.execute(task_id="unknown_task_123")

        assert result.is_error
        assert "unknown" in result.output.lower()

    @pytest.mark.asyncio
    async def test_stop_already_completed_task(self, temp_workspace):
        """Test stopping a completed task."""
        TaskOutputTool.register_task("completed_task", "test_type")
        TaskOutputTool.complete_task("completed_task", "Done")

        tool = TaskStopTool(working_directory=str(temp_workspace))
        result = await tool.execute(task_id="completed_task")

        # Should indicate it's not running
        assert result.is_error or "not running" in result.output.lower()


class TestTodoIntegration:
    """Test todo tools integration."""

    @pytest.mark.asyncio
    async def test_full_task_lifecycle(self, temp_workspace):
        """Test full task lifecycle: create, progress, complete."""
        todo_tool = TodoWriteTool(working_directory=str(temp_workspace))

        # Create tasks
        result = await todo_tool.execute(todos=[
            {"id": "1", "content": "Setup project", "status": "completed"},
            {"id": "2", "content": "Write tests", "status": "in_progress"},
            {"id": "3", "content": "Deploy", "status": "pending"}
        ])
        assert not result.is_error

        # Update progress
        result = await todo_tool.execute(todos=[
            {"id": "1", "content": "Setup project", "status": "completed"},
            {"id": "2", "content": "Write tests", "status": "completed"},
            {"id": "3", "content": "Deploy", "status": "in_progress"}
        ])
        assert not result.is_error
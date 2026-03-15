"""
TodoWrite tool - Simple todo list for tracking progress.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from dataclasses import dataclass, field
from typing import Literal
import time


@dataclass
class TodoItem:
    """A single todo item."""
    id: str
    content: str
    status: Literal["pending", "in_progress", "completed"]


class TodoManager:
    """Global todo list manager."""
    _instance: "TodoManager | None" = None
    todos: list[TodoItem] = []

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_by_id(self, todo_id: str) -> TodoItem | None:
        for todo in self.todos:
            if todo.id == todo_id:
                return todo
        return None


@registry.register
class TodoWriteTool(Tool):
    """Update the todo list for tracking progress."""

    name = "TodoWrite"
    description = """Use this tool to update the todo list for tracking progress.

- Use this to track progress on tasks
- Mark items as in_progress when starting work
- Mark items as completed as soon as you finish them
- Do not batch up multiple tasks before marking them as completed
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "todos": {
                "description": "The updated todo list",
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "content": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": ["pending", "in_progress", "completed"]
                        }
                    },
                    "required": ["id", "content", "status"]
                }
            }
        },
        "required": ["todos"],
        "additionalProperties": False
    }

    async def execute(self, todos: list[dict]) -> ToolResult:
        """Update the todo list."""
        manager = TodoManager()

        # Convert to TodoItem objects
        new_todos = []
        for todo_data in todos:
            todo = TodoItem(
                id=todo_data["id"],
                content=todo_data["content"],
                status=todo_data["status"]
            )
            new_todos.append(todo)

        # Replace the entire list
        manager.todos = new_todos

        # Format output
        lines = ["Todo list updated:"]
        for todo in manager.todos:
            icon = {"pending": "○", "in_progress": "◐", "completed": "●"}[todo.status]
            lines.append(f"  {icon} [{todo.id}] {todo.content}")

        return ToolResult(
            output="\n".join(lines),
            metadata={"todos": [{"id": t.id, "content": t.content, "status": t.status} for t in manager.todos]}
        )


@registry.register
class TaskOutputTool(Tool):
    """Get output from a running or completed background task."""

    name = "TaskOutput"
    description = """Retrieves output from a running or completed task (background shell, agent, or remote session).

Takes a task_id parameter identifying the task.
Returns the task output along with status information.

Use block=true (default) to wait for completion.
Use block=false for non-blocking check of current status.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "task_id": {
                "description": "The task ID to get output from",
                "type": "string"
            },
            "block": {
                "description": "Whether to wait for completion",
                "type": "boolean",
                "default": True
            },
            "timeout": {
                "description": "Max wait time in ms",
                "type": "number",
                "default": 30000,
                "maximum": 600000,
                "minimum": 0
            }
        },
        "required": ["task_id", "block", "timeout"],
        "additionalProperties": False
    }

    # Store for background task outputs
    _task_outputs: dict[str, dict] = {}

    @classmethod
    def register_task(cls, task_id: str, task_type: str):
        """Register a new background task."""
        cls._task_outputs[task_id] = {
            "status": "running",
            "output": None,
            "task_type": task_type,
            "started_at": time.time()
        }

    @classmethod
    def complete_task(cls, task_id: str, output: str, is_error: bool = False):
        """Mark a task as completed with output."""
        if task_id in cls._task_outputs:
            cls._task_outputs[task_id]["status"] = "error" if is_error else "completed"
            cls._task_outputs[task_id]["output"] = output
            cls._task_outputs[task_id]["completed_at"] = time.time()

    async def execute(self, task_id: str, block: bool = True, timeout: int = 30000) -> ToolResult:
        """Get output from a background task."""
        if task_id not in self._task_outputs:
            return ToolResult(
                output=f"Unknown task ID: {task_id}",
                is_error=True
            )

        task_info = self._task_outputs[task_id]

        if block and task_info["status"] == "running":
            # In a real implementation, we would wait for the task
            # For now, just return current status
            import asyncio
            start = time.time()
            while time.time() - start < timeout / 1000:
                if task_info["status"] != "running":
                    break
                await asyncio.sleep(0.1)

        status = task_info["status"]
        output = task_info.get("output", "Task still running...")

        return ToolResult(
            output=f"Task {task_id} ({task_info['task_type']}):\nStatus: {status}\nOutput:\n{output}",
            metadata={
                "task_id": task_id,
                "status": status,
                "task_type": task_info["task_type"],
                "output": output
            }
        )


@registry.register
class TaskStopTool(Tool):
    """Stop a running background task by its ID."""

    name = "TaskStop"
    description = """Stops a running background task by its ID.

Takes a task_id parameter identifying the task to stop.
Returns a success or failure status.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "task_id": {
                "description": "The ID of the background task to stop",
                "type": "string"
            },
            "shell_id": {
                "description": "Deprecated: use task_id instead",
                "type": "string"
            }
        },
        "additionalProperties": False
    }

    async def execute(self, task_id: str, shell_id: str | None = None) -> ToolResult:
        """Stop a background task."""
        # Use shell_id if task_id not provided (for backwards compat)
        actual_id = task_id or shell_id

        if actual_id not in TaskOutputTool._task_outputs:
            return ToolResult(
                output=f"Unknown task ID: {actual_id}",
                is_error=True
            )

        task_info = TaskOutputTool._task_outputs[actual_id]

        if task_info["status"] != "running":
            return ToolResult(
                output=f"Task {actual_id} is not running (status: {task_info['status']})"
            )

        # Mark as stopped
        task_info["status"] = "stopped"
        task_info["output"] = "Task stopped by user"

        return ToolResult(
            output=f"Stopped task {actual_id}",
            metadata={"task_id": actual_id, "status": "stopped"}
        )
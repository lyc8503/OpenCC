"""
Bash tool - Execute shell commands.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from .todo import TaskOutputTool
import asyncio
import subprocess
import os


@registry.register
class BashTool(Tool):
    """Execute a given bash command and return its output."""

    name = "Bash"
    description = "Executes a given bash command and returns its output."
    requires_permission = True

    parameters = {'$schema': 'https://json-schema.org/draft/2020-12/schema', 'type': 'object', 'properties': {'command': {'description': 'The command to execute', 'type': 'string'}, 'timeout': {'description': 'Optional timeout in milliseconds (max 600000)', 'type': 'number'}, 'description': {'description': 'Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" in the description - just describe what it does.\n\nFor simple commands (git, npm, standard CLI tools), keep it brief (5-10 words):\n- ls → "List files in current directory"\n- git status → "Show working tree status"\n- npm install → "Install package dependencies"\n\nFor commands that are harder to parse at a glance (piped commands, obscure flags, etc.), add enough context to clarify what it does:\n- find . -name "*.tmp" -exec rm {} \\; → "Find and delete all .tmp files recursively"\n- git reset --hard origin/main → "Discard all local changes and match remote main"\n- curl -s url | jq \'.data[]\' → "Fetch JSON from URL and extract data array elements"', 'type': 'string'}, 'run_in_background': {'description': 'Set to true to run this command in the background. Use TaskOutput to read the output later.', 'type': 'boolean'}, 'dangerouslyDisableSandbox': {'description': 'Set this to true to dangerously override sandbox mode and run commands without sandboxing.', 'type': 'boolean'}}, 'required': ['command'], 'additionalProperties': False}

    def __init__(self, working_directory: str = "."):
        super().__init__(working_directory)
        self._background_tasks: dict[str, asyncio.Task] = {}

    async def execute(
        self,
        command: str,
        timeout: int = 120000,
        description: str | None = None,
        run_in_background: bool = False,
        dangerouslyDisableSandbox: bool = False
    ) -> ToolResult:
        """Execute the bash command."""

        # Handle background execution
        if run_in_background:
            task_id = f"bg_{len(self._background_tasks)}"
            # Register with TaskOutputTool
            TaskOutputTool.register_task(task_id, "bash")

            task = asyncio.create_task(self._run_command(command, timeout))
            self._background_tasks[task_id] = task

            # Add callback to mark complete when done
            def on_done(t):
                try:
                    result = t.result()
                    TaskOutputTool.complete_task(task_id, result)
                except Exception as e:
                    TaskOutputTool.complete_task(task_id, str(e), is_error=True)

            task.add_done_callback(on_done)

            return ToolResult(
                output=f"Background task started with ID: {task_id}",
                metadata={"task_id": task_id}
            )

        # Normal execution
        try:
            result = await self._run_command(command, timeout)
            return ToolResult(output=result)
        except asyncio.TimeoutError:
            return ToolResult(
                output=f"Command timed out after {timeout}ms",
                is_error=True
            )
        except Exception as e:
            return ToolResult(output=f"Error: {e}", is_error=True)

    async def _run_command(self, command: str, timeout: int) -> str:
        """Run a command and return its output."""
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=self.working_directory
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout / 1000
            )
        except asyncio.TimeoutError:
            process.kill()
            raise

        output = ""
        if stdout:
            output += stdout.decode("utf-8", errors="replace")
        if stderr:
            output += stderr.decode("utf-8", errors="replace")

        return output.strip()

    async def get_background_output(self, task_id: str) -> str:
        """Get output from a background task."""
        if task_id not in self._background_tasks:
            return f"Unknown task ID: {task_id}"

        task = self._background_tasks[task_id]
        if task.done():
            try:
                return task.result()
            except Exception as e:
                return f"Task failed: {e}"
        else:
            return "Task still running..."
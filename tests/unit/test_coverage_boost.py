"""
Tests for CLI entry point.
"""

import pytest
from unittest.mock import patch, MagicMock


class TestCLI:
    """Tests for CLI module."""

    def test_cli_module_import(self):
        """Test CLI module can be imported."""
        from src import cli
        assert cli is not None

    def test_main_exists(self):
        """Test main function exists."""
        from src.cli import main
        assert callable(main)


class TestReadToolAdvanced:
    """Advanced tests for Read tool."""

    @pytest.fixture
    def read_tool(self, temp_dir):
        """Create a Read tool instance."""
        from src.tools.read import ReadTool
        return ReadTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_read_with_offset_and_limit(self, read_tool, temp_dir):
        """Test reading with offset and limit."""
        from pathlib import Path
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("line1\nline2\nline3\nline4\nline5\n")

        result = await read_tool.execute(
            file_path=str(test_file),
            offset=2,
            limit=2
        )
        assert result.is_error is False
        # Should show lines 2 and 3 (offset is 0-indexed in output)

    @pytest.mark.asyncio
    async def test_read_image_file(self, read_tool, temp_dir):
        """Test reading an image file."""
        from pathlib import Path
        # Create a minimal PNG
        test_image = Path(temp_dir) / "test.png"
        # PNG magic bytes
        test_image.write_bytes(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)

        result = await read_tool.execute(file_path=str(test_image))
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_read_json_file(self, read_tool, temp_dir):
        """Test reading a JSON file."""
        from pathlib import Path
        import json
        test_file = Path(temp_dir) / "test.json"
        test_file.write_text(json.dumps({"key": "value"}))

        result = await read_tool.execute(file_path=str(test_file))
        assert result.is_error is False


class TestBashToolAdvanced:
    """Advanced tests for Bash tool."""

    @pytest.fixture
    def bash_tool(self, temp_dir):
        """Create a Bash tool instance."""
        from src.tools.bash import BashTool
        return BashTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_bash_sandbox(self, bash_tool):
        """Test bash command execution."""
        result = await bash_tool.execute(command="echo test")
        assert result.is_error is False
        assert "test" in result.output

    @pytest.mark.asyncio
    async def test_bash_with_working_dir(self, bash_tool, temp_dir):
        """Test command runs in working directory."""
        result = await bash_tool.execute(command="pwd")
        assert temp_dir in result.output


class TestGrepToolAdvanced:
    """Advanced tests for Grep tool."""

    @pytest.fixture
    def grep_tool(self, temp_dir):
        """Create a Grep tool instance."""
        from src.tools.grep import GrepTool
        from pathlib import Path

        # Create test files
        Path(temp_dir, "file1.py").write_text("def hello():\n    print('hello')\n")
        Path(temp_dir, "file2.py").write_text("def world():\n    print('world')\n")

        return GrepTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_grep_python_files(self, grep_tool):
        """Test grep with Python file filter."""
        result = await grep_tool.execute(
            pattern="def",
            glob="*.py"
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_grep_with_context(self, grep_tool):
        """Test grep with context lines."""
        result = await grep_tool.execute(
            pattern="print",
            output_mode="content",
            C=2
        )
        assert result.is_error is False


class TestTodoToolsAdvanced:
    """Advanced tests for Todo tools."""

    @pytest.fixture
    def todo_tool(self, temp_dir):
        """Create a TodoWrite tool instance."""
        from src.tools.todo import TodoWriteTool
        return TodoWriteTool(working_directory=temp_dir)

    @pytest.fixture
    def task_output_tool(self, temp_dir):
        """Create a TaskOutput tool instance."""
        from src.tools.todo import TaskOutputTool
        return TaskOutputTool(working_directory=temp_dir)

    @pytest.fixture
    def task_stop_tool(self, temp_dir):
        """Create a TaskStop tool instance."""
        from src.tools.todo import TaskStopTool
        return TaskStopTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_todo_write_multiple(self, todo_tool):
        """Test writing multiple todos."""
        result = await todo_tool.execute(
            todos=[
                {"id": "1", "content": "Task 1", "status": "pending"},
                {"id": "2", "content": "Task 2", "status": "in_progress"},
                {"id": "3", "content": "Task 3", "status": "completed"}
            ]
        )
        assert result.is_error is False
        assert result.metadata["todos"][0]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_task_output_not_found(self, task_output_tool):
        """Test getting output for non-existent task."""
        result = await task_output_tool.execute(
            task_id="nonexistent",
            block=False,
            timeout=1000
        )
        assert result.is_error is True

    @pytest.mark.asyncio
    async def test_task_register_and_complete(self, task_output_tool):
        """Test registering and completing a task."""
        from src.tools.todo import TaskOutputTool

        TaskOutputTool.register_task("test-123", "shell")

        result = await task_output_tool.execute(
            task_id="test-123",
            block=False,
            timeout=100
        )
        assert result.is_error is False

        # Complete the task
        TaskOutputTool.complete_task("test-123", "Done")

        result = await task_output_tool.execute(
            task_id="test-123",
            block=False,
            timeout=100
        )
        assert result.is_error is False
        assert "Done" in result.output

    @pytest.mark.asyncio
    async def test_task_stop(self, task_stop_tool):
        """Test stopping a task."""
        from src.tools.todo import TaskOutputTool

        TaskOutputTool.register_task("stop-test", "shell")

        result = await task_stop_tool.execute(task_id="stop-test")
        assert result.is_error is False


class TestCronToolsAdvanced:
    """Advanced tests for Cron tools."""

    @pytest.fixture
    def cron_create_tool(self, temp_dir):
        """Create a CronCreate tool instance."""
        from src.tools.cron import CronCreateTool
        return CronCreateTool(working_directory=temp_dir)

    @pytest.fixture
    def cron_delete_tool(self, temp_dir):
        """Create a CronDelete tool instance."""
        from src.tools.cron import CronDeleteTool
        return CronDeleteTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_create_and_delete_cron(self, cron_create_tool, cron_delete_tool):
        """Test creating and deleting a cron job."""
        create_result = await cron_create_tool.execute(
            cron="0 9 * * *",
            prompt="Daily reminder",
            recurring=True
        )
        assert create_result.is_error is False

        # Get job ID from metadata
        job_id = create_result.metadata.get("job_id", "cron-1")

        delete_result = await cron_delete_tool.execute(id=job_id)
        assert delete_result.is_error is False


class TestPlanToolAdvanced:
    """Advanced tests for Plan tools."""

    @pytest.fixture
    def plan_tool(self, temp_dir):
        """Create plan tools."""
        from src.tools.plan import EnterPlanModeTool
        return EnterPlanModeTool(working_directory=temp_dir)

    @pytest.fixture
    def exit_plan_tool(self, temp_dir):
        """Create ExitPlanMode tool."""
        from src.tools.plan import ExitPlanModeTool
        return ExitPlanModeTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_enter_plan_mode(self, plan_tool):
        """Test entering plan mode."""
        result = await plan_tool.execute()
        assert result is not None

    @pytest.mark.asyncio
    async def test_exit_plan_mode(self, exit_plan_tool):
        """Test exiting plan mode."""
        result = await exit_plan_tool.execute()
        assert result is not None


class TestWorktreeToolAdvanced:
    """Advanced tests for Worktree tools."""

    @pytest.fixture
    def enter_worktree_tool(self, temp_dir):
        """Create an EnterWorktree tool instance."""
        from src.tools.worktree import EnterWorktreeTool
        return EnterWorktreeTool(working_directory=temp_dir)

    @pytest.fixture
    def exit_worktree_tool(self, temp_dir):
        """Create an ExitWorktree tool instance."""
        from src.tools.worktree import ExitWorktreeTool
        return ExitWorktreeTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_enter_worktree_schema(self, enter_worktree_tool):
        """Test EnterWorktree tool schema."""
        schema = enter_worktree_tool.get_schema()
        assert schema.name == "EnterWorktree"

    @pytest.mark.asyncio
    async def test_exit_worktree_schema(self, exit_worktree_tool):
        """Test ExitWorktree tool schema."""
        schema = exit_worktree_tool.get_schema()
        assert schema.name == "ExitWorktree"


class TestAgentToolAdvanced:
    """Advanced tests for Agent tool."""

    @pytest.fixture
    def agent_tool(self, temp_dir):
        """Create an Agent tool instance."""
        from src.tools.agent import AgentTool
        return AgentTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_agent_tool_with_prompt(self, agent_tool):
        """Test Agent tool with prompt."""
        # Agent tool requires LLM setup, so we just test schema
        schema = agent_tool.get_schema()
        assert "prompt" in schema.parameters["properties"]
        assert "subagent_type" in schema.parameters["properties"]
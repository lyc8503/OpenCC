"""
Unit tests for remaining tools (Ask, Task, Web, etc).
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock


class TestAskUserQuestionTool:
    """Tests for AskUserQuestion tool."""

    @pytest.fixture
    def ask_tool(self, temp_dir):
        """Create an AskUserQuestion tool instance."""
        from src.tools.ask import AskUserQuestionTool
        return AskUserQuestionTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_tool_schema(self, ask_tool):
        """Test tool has correct schema."""
        schema = ask_tool.get_schema()
        assert schema.name == "AskUserQuestion"
        assert "questions" in schema.parameters["properties"]

    @pytest.mark.asyncio
    async def test_execute_with_callback(self, ask_tool):
        """Test execute with callback set."""
        async def mock_callback(questions):
            return {"answers": {"test question": "option1"}}

        ask_tool.set_callback(mock_callback)
        result = await ask_tool.execute(
            questions=[{
                "question": "test question?",
                "header": "Test",
                "options": [{"label": "option1", "description": "desc"}],
                "multiSelect": False
            }]
        )
        assert result.is_error is False
        assert "answers" in result.metadata

    @pytest.mark.asyncio
    async def test_execute_without_callback(self, ask_tool):
        """Test execute without callback returns formatted questions."""
        result = await ask_tool.execute(
            questions=[{
                "question": "Test question?",
                "header": "Test",
                "options": [
                    {"label": "Option A", "description": "First option"},
                    {"label": "Option B", "description": "Second option"}
                ],
                "multiSelect": False
            }]
        )
        assert result.is_error is False
        assert "Questions for you" in result.output
        assert "Option A" in result.output

    @pytest.mark.asyncio
    async def test_validate_questions(self, ask_tool):
        """Test input validation for questions."""
        errors = ask_tool.validate_input({
            "questions": [{
                "question": "Test?",
                "header": "Test",
                "options": [{"label": "A", "description": "desc"}],
                "multiSelect": False
            }]
        })
        assert errors == []

    @pytest.mark.asyncio
    async def test_validate_too_many_questions(self, ask_tool):
        """Test validation fails with too many questions."""
        questions = [{
            "question": f"Q{i}?",
            "header": f"H{i}",
            "options": [{"label": "A", "description": "desc"}],
            "multiSelect": False
        } for i in range(5)]  # Max is 4

        errors = ask_tool.validate_input({"questions": questions})
        assert len(errors) > 0


class TestTaskTools:
    """Tests for Task management tools."""

    @pytest.fixture
    def todo_write_tool(self, temp_dir):
        """Create a TodoWrite tool instance."""
        from src.tools.todo import TodoWriteTool
        return TodoWriteTool(working_directory=temp_dir)

    @pytest.fixture
    def task_output_tool(self, temp_dir):
        """Create a TaskOutput tool instance."""
        from src.tools.todo import TaskOutputTool
        return TaskOutputTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_create_task(self, todo_write_tool):
        """Test creating/updating todo list."""
        result = await todo_write_tool.execute(
            todos=[{"id": "1", "content": "Test task", "status": "pending"}]
        )
        assert result.is_error is False
        assert "todos" in result.metadata

    @pytest.mark.asyncio
    async def test_list_tasks(self, todo_write_tool):
        """Test that todo list is tracked."""
        # Create todos
        result = await todo_write_tool.execute(
            todos=[
                {"id": "1", "content": "Task 1", "status": "pending"},
                {"id": "2", "content": "Task 2", "status": "in_progress"}
            ]
        )
        # TodoWriteTool replaces the entire list
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_get_task(self, todo_write_tool):
        """Test updating a task."""
        result = await todo_write_tool.execute(
            todos=[{"id": "1", "content": "Task to complete", "status": "completed"}]
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_get_nonexistent_task(self, task_output_tool):
        """Test getting output from non-existent task."""
        result = await task_output_tool.execute(
            task_id="nonexistent",
            block=False,
            timeout=1000
        )
        assert result.is_error is True


class TestWebTools:
    """Tests for Web tools."""

    @pytest.fixture
    def web_fetch_tool(self, temp_dir):
        """Create a WebFetch tool instance."""
        from src.tools.web import WebFetchTool
        return WebFetchTool(working_directory=temp_dir)

    @pytest.fixture
    def web_search_tool(self, temp_dir):
        """Create a WebSearch tool instance."""
        from src.tools.web import WebSearchTool
        return WebSearchTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_web_fetch_schema(self, web_fetch_tool):
        """Test WebFetch tool schema."""
        schema = web_fetch_tool.get_schema()
        assert schema.name == "WebFetch"
        assert "url" in schema.parameters["properties"]
        assert "prompt" in schema.parameters["properties"]

    @pytest.mark.asyncio
    async def test_web_search_schema(self, web_search_tool):
        """Test WebSearch tool schema."""
        schema = web_search_tool.get_schema()
        assert schema.name == "WebSearch"
        assert "query" in schema.parameters["properties"]


class TestCronTools:
    """Tests for Cron tools."""

    @pytest.fixture
    def cron_create_tool(self, temp_dir):
        """Create a CronCreate tool instance."""
        from src.tools.cron import CronCreateTool
        return CronCreateTool(working_directory=temp_dir)

    @pytest.fixture
    def cron_list_tool(self, temp_dir):
        """Create a CronList tool instance."""
        from src.tools.cron import CronListTool
        return CronListTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_create_cron(self, cron_create_tool):
        """Test creating a cron job."""
        result = await cron_create_tool.execute(
            cron="0 9 * * *",
            prompt="Daily reminder",
            recurring=True
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_list_crons(self, cron_list_tool, cron_create_tool):
        """Test listing cron jobs."""
        await cron_create_tool.execute(
            cron="0 9 * * *",
            prompt="Test job",
            recurring=True
        )
        result = await cron_list_tool.execute()
        assert result.is_error is False


class TestAgentTool:
    """Tests for Agent tool."""

    @pytest.fixture
    def agent_tool(self, temp_dir):
        """Create an Agent tool instance."""
        from src.tools.agent import AgentTool
        return AgentTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_agent_tool_schema(self, agent_tool):
        """Test Agent tool schema."""
        schema = agent_tool.get_schema()
        assert schema.name == "Agent"
        assert "prompt" in schema.parameters["properties"]


class TestNotebookTools:
    """Tests for Notebook tools."""

    @pytest.fixture
    def notebook_edit_tool(self, temp_dir):
        """Create a NotebookEdit tool instance."""
        from src.tools.notebook import NotebookEditTool
        return NotebookEditTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_notebook_edit_schema(self, notebook_edit_tool):
        """Test NotebookEdit tool schema."""
        schema = notebook_edit_tool.get_schema()
        assert schema.name == "NotebookEdit"

    @pytest.mark.asyncio
    async def test_notebook_edit_invalid_path(self, notebook_edit_tool):
        """Test editing with invalid path."""
        result = await notebook_edit_tool.execute(
            notebook_path="/nonexistent/path.ipynb",
            new_source="print('hello')",
            cell_type="code"
        )
        assert result.is_error is True


class TestSkillTool:
    """Tests for Skill tool."""

    @pytest.fixture
    def skill_tool(self, temp_dir):
        """Create a Skill tool instance."""
        from src.tools.skill import SkillTool
        return SkillTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_skill_tool_schema(self, skill_tool):
        """Test Skill tool schema."""
        schema = skill_tool.get_schema()
        assert schema.name == "Skill"
        assert "skill" in schema.parameters["properties"]


class TestPlanTools:
    """Tests for Plan tools."""

    @pytest.fixture
    def plan_tool(self, temp_dir):
        """Create plan tools."""
        from src.tools.plan import EnterPlanModeTool
        return EnterPlanModeTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_plan_tool_schema(self, plan_tool):
        """Test Plan tool schema."""
        schema = plan_tool.get_schema()
        assert schema.name == "EnterPlanMode"


class TestWorktreeTools:
    """Tests for Worktree tools."""

    @pytest.fixture
    def worktree_tool(self, temp_dir):
        """Create a worktree tool instance."""
        from src.tools.worktree import EnterWorktreeTool
        return EnterWorktreeTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_worktree_tool_schema(self, worktree_tool):
        """Test Worktree tool schema."""
        schema = worktree_tool.get_schema()
        assert schema.name == "EnterWorktree"
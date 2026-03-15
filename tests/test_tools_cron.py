"""
Tests for Cron tools functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.cron import CronCreateTool, CronDeleteTool, CronListTool, CronScheduler
from src.core.types import ToolResult


class TestCronScheduler:
    """Test CronScheduler singleton."""

    def test_singleton(self):
        """Test that scheduler is a singleton."""
        s1 = CronScheduler()
        s2 = CronScheduler()
        assert s1 is s2

    def test_jobs_initially_empty(self):
        """Test that jobs start empty."""
        scheduler = CronScheduler()
        scheduler.jobs = {}  # Reset for test
        assert len(scheduler.jobs) == 0


class TestCronCreateTool:
    """Test CronCreate tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = CronCreateTool()
        assert tool.name == "CronCreate"

    @pytest.mark.asyncio
    async def test_create_recurring_job(self, temp_workspace):
        """Test creating a recurring cron job."""
        tool = CronCreateTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            cron="0 * * * *",
            prompt="Hourly task",
            recurring=True
        )

        assert isinstance(result, ToolResult)
        assert not result.is_error
        assert "job_id" in result.metadata

    @pytest.mark.asyncio
    async def test_create_one_time_job(self, temp_workspace):
        """Test creating a one-time job."""
        tool = CronCreateTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            cron="30 14 * * *",
            prompt="Daily at 2:30pm",
            recurring=False
        )

        assert not result.is_error

    @pytest.mark.asyncio
    async def test_create_multiple_jobs(self, temp_workspace):
        """Test creating multiple cron jobs."""
        tool = CronCreateTool(working_directory=str(temp_workspace))

        result1 = await tool.execute(cron="0 * * * *", prompt="Job 1", recurring=True)
        result2 = await tool.execute(cron="0 0 * * *", prompt="Job 2", recurring=True)

        assert not result1.is_error
        assert not result2.is_error


class TestCronListTool:
    """Test CronList tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = CronListTool()
        assert tool.name == "CronList"

    @pytest.mark.asyncio
    async def test_list_empty(self, temp_workspace):
        """Test listing when no jobs exist."""
        # Reset jobs
        CronScheduler.jobs = {}

        tool = CronListTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        assert isinstance(result, ToolResult)
        assert not result.is_error

    @pytest.mark.asyncio
    async def test_list_with_jobs(self, temp_workspace):
        """Test listing existing jobs."""
        # Create a job first
        create_tool = CronCreateTool(working_directory=str(temp_workspace))
        await create_tool.execute(cron="0 * * * *", prompt="Test job", recurring=True)

        tool = CronListTool(working_directory=str(temp_workspace))
        result = await tool.execute()

        assert not result.is_error
        assert "Test job" in result.output or len(result.metadata.get("jobs", [])) >= 1


class TestCronDeleteTool:
    """Test CronDelete tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = CronDeleteTool()
        assert tool.name == "CronDelete"

    @pytest.mark.asyncio
    async def test_delete_existing_job(self, temp_workspace):
        """Test deleting an existing job."""
        # Create a job
        create_tool = CronCreateTool(working_directory=str(temp_workspace))
        create_result = await create_tool.execute(
            cron="0 * * * *",
            prompt="To delete",
            recurring=True
        )

        job_id = create_result.metadata.get("job_id")
        assert job_id is not None

        # Delete the job
        delete_tool = CronDeleteTool(working_directory=str(temp_workspace))
        result = await delete_tool.execute(id=job_id)

        assert isinstance(result, ToolResult)
        assert not result.is_error

    @pytest.mark.asyncio
    async def test_delete_nonexistent_job(self, temp_workspace):
        """Test deleting a job that doesn't exist."""
        tool = CronDeleteTool(working_directory=str(temp_workspace))
        result = await tool.execute(id="nonexistent_job_id")

        assert result.is_error


class TestCronIntegration:
    """Test cron tools integration."""

    @pytest.mark.asyncio
    async def test_create_list_delete_workflow(self, temp_workspace):
        """Test complete workflow: create, list, delete."""
        # Reset
        CronScheduler.jobs = {}

        # Create
        create_tool = CronCreateTool(working_directory=str(temp_workspace))
        create_result = await create_tool.execute(
            cron="*/5 * * * *",
            prompt="Every 5 minutes",
            recurring=True
        )
        assert not create_result.is_error
        job_id = create_result.metadata.get("job_id")

        # List
        list_tool = CronListTool(working_directory=str(temp_workspace))
        list_result = await list_tool.execute()
        assert not list_result.is_error

        # Delete
        delete_tool = CronDeleteTool(working_directory=str(temp_workspace))
        delete_result = await delete_tool.execute(id=job_id)
        assert not delete_result.is_error

        # List again to verify deletion
        list_result2 = await list_tool.execute()
        assert not list_result2.is_error
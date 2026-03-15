"""
Tests for Agent (sub-agent) tool functionality.
"""

import pytest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.agent import AgentTool
from src.core.types import ToolResult


class TestAgentToolDefinition:
    """Test Agent tool definition - no API calls required."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = AgentTool()
        assert tool.name == "Agent"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = AgentTool()

        # Missing required
        errors = tool.validate_input({})
        assert len(errors) >= 2  # description and prompt

        # Valid input
        errors = tool.validate_input({
            "description": "Test task",
            "prompt": "Do something"
        })
        assert len(errors) == 0

    def test_tool_has_schema(self):
        """Test tool has valid schema."""
        tool = AgentTool()
        schema = tool.get_schema()
        assert schema.name == "Agent"
        assert "description" in schema.parameters.get("properties", {})
        assert "prompt" in schema.parameters.get("properties", {})

    def test_subagent_types_in_schema(self):
        """Test that subagent_type enum has correct values."""
        tool = AgentTool()
        schema = tool.get_schema()
        props = schema.parameters.get("properties", {})
        if "subagent_type" in props:
            enum = props["subagent_type"].get("enum", [])
            assert "Explore" in enum or "general-purpose" in enum


# Skip all agent execution tests - they require real API calls with valid models
api_test = pytest.mark.skipif(
    os.environ.get("PYTEST_RUN_API_TESTS") != "1",
    reason="Agent execution tests require real API calls - set PYTEST_RUN_API_TESTS=1 to run"
)


class TestAgentToolExecution:
    """Test Agent tool execution - requires API access."""

    @api_test
    @pytest.mark.asyncio
    async def test_launch_explore_agent(self, temp_workspace):
        """Test launching an explore agent."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="Find Python files",
            prompt="Find all Python files in the directory",
            subagent_type="Explore"
        )

        assert isinstance(result, ToolResult)
        if not result.is_error:
            assert result.output != ""

    @api_test
    @pytest.mark.asyncio
    async def test_launch_plan_agent(self, temp_workspace):
        """Test launching a plan agent."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="Plan implementation",
            prompt="Plan how to implement a new feature",
            subagent_type="Plan"
        )

        assert isinstance(result, ToolResult)

    @api_test
    @pytest.mark.asyncio
    async def test_launch_agent_with_model(self, temp_workspace):
        """Test launching agent with specific model."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="Test task",
            prompt="Do something",
            model="haiku"
        )

        assert isinstance(result, ToolResult)

    @api_test
    @pytest.mark.asyncio
    async def test_launch_agent_in_background(self, temp_workspace):
        """Test launching agent in background."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="Background task",
            prompt="Long running task",
            run_in_background=True
        )

        assert isinstance(result, ToolResult)
        # Background tasks should return immediately with task info
        assert result.metadata is not None or not result.is_error

    @api_test
    @pytest.mark.asyncio
    async def test_launch_agent_with_isolation(self, temp_workspace):
        """Test launching agent with worktree isolation."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="Isolated task",
            prompt="Task in isolation",
            isolation="worktree"
        )

        assert isinstance(result, ToolResult)

    @api_test
    @pytest.mark.asyncio
    async def test_launch_default_agent(self, temp_workspace):
        """Test launching default (general-purpose) agent."""
        tool = AgentTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            description="General task",
            prompt="Perform a general task"
        )

        assert isinstance(result, ToolResult)

    @api_test
    @pytest.mark.asyncio
    async def test_agent_description_validation(self, temp_workspace):
        """Test that description should be short."""
        tool = AgentTool(working_directory=str(temp_workspace))
        # Short description
        result = await tool.execute(
            description="Short desc",  # Should be 3-5 words
            prompt="Test"
        )

        assert isinstance(result, ToolResult)
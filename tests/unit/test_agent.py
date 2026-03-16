"""
Unit tests for Agent class.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from src.core.agent import Agent, AgentState, log_tool_call
from src.core.types import AgentConfig, Message, ContentBlock, ToolResult


class TestAgentState:
    """Tests for AgentState."""

    def test_default_state(self):
        """Test default agent state."""
        state = AgentState()
        assert state.messages == []
        assert state.tasks == {}
        assert state.agents == {}
        assert state.iteration == 0
        assert state.tool_call_count == 0

    def test_state_with_messages(self):
        """Test state with messages."""
        state = AgentState()
        state.messages.append(Message.user("Hello"))
        assert len(state.messages) == 1


class TestAgent:
    """Tests for Agent class."""

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM client."""
        mock = AsyncMock()
        mock.complete = AsyncMock(return_value={
            "content": [{"type": "text", "text": "Hello!"}],
            "stop_reason": "end_turn"
        })
        mock.stream = AsyncMock()
        return mock

    @pytest.fixture
    def agent(self, mock_llm, temp_dir):
        """Create an Agent instance."""
        config = AgentConfig(
            model="test-model",
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        return Agent(config=config, llm_client=mock_llm)

    def test_agent_creation(self, agent):
        """Test agent creation."""
        assert agent.config.model == "test-model"
        assert agent.state is not None

    def test_agent_add_task(self, agent):
        """Test adding a task."""
        task = agent.add_task(
            subject="Test task",
            description="Test description"
        )
        assert task.id == "1"
        assert task.subject == "Test task"
        assert task.status == "pending"

    def test_agent_get_task(self, agent):
        """Test getting a task."""
        agent.add_task("Task 1", "Description 1")
        task = agent.get_task("1")
        assert task is not None
        assert task.subject == "Task 1"

    def test_agent_get_nonexistent_task(self, agent):
        """Test getting non-existent task."""
        task = agent.get_task("999")
        assert task is None

    def test_agent_update_task(self, agent):
        """Test updating a task."""
        agent.add_task("Task to update", "Description")
        updated = agent.update_task("1", status="in_progress")
        assert updated.status == "in_progress"

    def test_agent_list_tasks(self, agent):
        """Test listing tasks."""
        agent.add_task("Task 1", "Desc 1")
        agent.add_task("Task 2", "Desc 2")
        tasks = agent.list_tasks()
        assert len(tasks) == 2

    @pytest.mark.asyncio
    async def test_agent_run_simple(self, agent, mock_llm):
        """Test simple agent run."""
        mock_llm.stream = AsyncMock()
        mock_llm.stream.__aiter__ = lambda self: self
        mock_llm.stream.__anext__ = AsyncMock(side_effect=StopAsyncIteration)

        # Mock the streaming
        async def mock_stream(*args, **kwargs):
            yield {"type": "text_delta", "text": "Hello"}
            yield {"type": "text_delta", "text": " world"}

        mock_llm.stream = mock_stream

        result = await agent.run("Hi")
        assert result is not None

    def test_has_tool_calls(self, agent):
        """Test _has_tool_calls method."""
        blocks = [
            ContentBlock(type="text", text="Hello"),
            ContentBlock(type="tool_use", tool_name="Read", tool_use_id="1")
        ]
        assert agent._has_tool_calls(blocks) is True

        text_only = [ContentBlock(type="text", text="Hello")]
        assert agent._has_tool_calls(text_only) is False

    def test_extract_text(self, agent):
        """Test _extract_text method."""
        blocks = [
            ContentBlock(type="text", text="Hello"),
            ContentBlock(type="text", text=" world")
        ]
        text = agent._extract_text(blocks)
        assert text == "Hello\n world"

    def test_build_system_prompt(self, agent):
        """Test system prompt building."""
        prompt = agent._build_system_prompt()
        assert prompt is not None
        assert len(prompt) > 0

    @pytest.mark.asyncio
    async def test_permission_check(self, mock_llm, temp_dir):
        """Test permission checking during tool execution."""
        # Create agent with permission callback
        callback_called = []

        def permission_callback(tool_name, tool_input):
            callback_called.append(tool_name)
            return True

        config = AgentConfig(
            working_directory=temp_dir,
            permission_mode="default"
        )
        agent = Agent(
            config=config,
            llm_client=mock_llm,
            permission_callback=permission_callback
        )

        # The permission callback should be called for tools


class TestLogToolCall:
    """Tests for log_tool_call function."""

    def test_log_tool_call_start(self, capsys):
        """Test logging tool call start."""
        log_tool_call("Read", {"file_path": "/test.txt"})
        captured = capsys.readouterr()
        assert "TOOL CALL" in captured.err
        assert "Read" in captured.err

    def test_log_tool_call_result(self, capsys):
        """Test logging tool call result."""
        result = ToolResult(output="Success", is_error=False)
        log_tool_call("Read", {"file_path": "/test.txt"}, result=result)
        captured = capsys.readouterr()
        assert "TOOL RESULT" in captured.err
        assert "OK" in captured.err

    def test_log_tool_call_error(self, capsys):
        """Test logging tool call error."""
        log_tool_call("Read", {"file_path": "/test.txt"}, error="File not found")
        captured = capsys.readouterr()
        assert "Read" in captured.err


class TestAgentConfig:
    """Tests for AgentConfig with agent."""

    def test_agent_with_custom_tools(self, temp_dir):
        """Test agent with custom tool list."""
        from src.core.tool import Tool

        class CustomTool(Tool):
            name = "CustomTool"
            description = "Custom"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="custom")

        config = AgentConfig(
            working_directory=temp_dir,
            tools=["Read", "Write"]
        )
        agent = Agent(config=config, tools=[CustomTool])
        # Agent should have custom tool registered
        assert agent is not None

    def test_agent_max_iterations(self, temp_dir):
        """Test agent respects max iterations."""
        config = AgentConfig(
            working_directory=temp_dir,
            max_iterations=5
        )
        agent = Agent(config=config)
        assert agent.config.max_iterations == 5


class TestAgentStreaming:
    """Tests for agent streaming."""

    @pytest.fixture
    def stream_agent(self, mock_llm, temp_dir):
        """Create an agent for streaming tests."""
        config = AgentConfig(
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        return Agent(config=config, llm_client=mock_llm)

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM client."""
        mock = AsyncMock()
        mock.complete = AsyncMock(return_value={
            "content": [{"type": "text", "text": "Response"}],
            "stop_reason": "end_turn"
        })
        return mock

    @pytest.mark.asyncio
    async def test_stream_no_tool_calls(self, stream_agent, mock_llm):
        """Test streaming without tool calls."""
        async def mock_stream(*args, **kwargs):
            yield {"type": "text_delta", "text": "Hello"}
            yield {"type": "text_delta", "text": " world"}

        mock_llm.stream = mock_stream

        chunks = []
        async for chunk in stream_agent.run_stream("Hi"):
            chunks.append(chunk)

        assert len(chunks) == 2
        assert chunks[0] == "Hello"
        assert chunks[1] == " world"

    @pytest.mark.asyncio
    async def test_stream_with_thinking(self, stream_agent, mock_llm):
        """Test streaming with thinking content."""
        async def mock_stream(*args, **kwargs):
            yield {"type": "thinking_delta", "text": "Thinking..."}
            yield {"type": "text_delta", "text": "Answer"}

        mock_llm.stream = mock_stream

        chunks = []
        async for chunk in stream_agent.run_stream("Hi"):
            chunks.append(chunk)

        # Text deltas should be yielded
        assert "Answer" in chunks
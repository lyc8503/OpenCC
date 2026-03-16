"""
Integration tests for Agent with tools.
"""

import pytest
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from src.core.agent import Agent
from src.core.types import AgentConfig, Message, ContentBlock
from src.core.tool import registry


class TestAgentToolIntegration:
    """Integration tests for Agent with real tools."""

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM that returns tool calls."""
        mock = AsyncMock()
        return mock

    @pytest.fixture
    def agent(self, mock_llm, temp_dir):
        """Create an agent with mock LLM."""
        config = AgentConfig(
            model="test-model",
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        return Agent(config=config, llm_client=mock_llm)

    @pytest.mark.asyncio
    async def test_agent_calls_read_tool(self, agent, mock_llm, temp_dir):
        """Test agent calling Read tool."""
        # Create test file
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("Test content\nLine 2\nLine 3\n")

        # Setup mock LLM to return tool call then text
        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Read",
                        "input": {"file_path": str(test_file)}
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "I read the file."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Read the test file")

        # Check that messages include tool result
        assert len(agent.state.messages) > 0

    @pytest.mark.asyncio
    async def test_agent_calls_write_tool(self, agent, mock_llm, temp_dir):
        """Test agent calling Write tool."""
        test_file = Path(temp_dir) / "output.txt"

        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Write",
                        "input": {
                            "file_path": str(test_file),
                            "content": "Hello from agent"
                        }
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "File written."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Write a test file")

        # Check file was created
        assert test_file.exists()
        assert "Hello from agent" in test_file.read_text()

    @pytest.mark.asyncio
    async def test_agent_calls_bash_tool(self, agent, mock_llm, temp_dir):
        """Test agent calling Bash tool."""
        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Bash",
                        "input": {"command": "echo test123"}
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "Command executed."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Run a test command")

        # Should have tool result in messages
        assert agent.state.tool_call_count >= 1

    @pytest.mark.asyncio
    async def test_agent_calls_glob_tool(self, agent, mock_llm, temp_dir):
        """Test agent calling Glob tool."""
        # Create some files
        for i in range(3):
            Path(temp_dir, f"file{i}.txt").write_text(f"content {i}")

        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Glob",
                        "input": {"pattern": "*.txt"}
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "Found the files."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Find text files")

    @pytest.mark.asyncio
    async def test_agent_multiple_tool_calls(self, agent, mock_llm, temp_dir):
        """Test agent making multiple tool calls in sequence."""
        file1 = Path(temp_dir) / "file1.txt"
        file1.write_text("content 1")

        file2 = Path(temp_dir) / "file2.txt"
        file2.write_text("content 2")

        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Read",
                        "input": {"file_path": str(file1)}
                    }]
                }
            elif call_count[0] == 2:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_2",
                        "name": "Read",
                        "input": {"file_path": str(file2)}
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "Read both files."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Read both files")

        # Should have executed 2 tool calls
        assert agent.state.tool_call_count >= 2

    @pytest.mark.asyncio
    async def test_agent_error_handling(self, agent, mock_llm):
        """Test agent handling tool errors."""
        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Read",
                        "input": {"file_path": "/nonexistent/path/file.txt"}
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "The file doesn't exist."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Read a file that doesn't exist")

        # Tool should have been called even if it errored
        assert agent.state.tool_call_count >= 1


class TestAgentPermissionIntegration:
    """Integration tests for agent permissions."""

    @pytest.fixture
    def mock_llm(self):
        """Create mock LLM."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_permission_denied(self, temp_dir, mock_llm):
        """Test that permission denied is handled correctly."""
        config = AgentConfig(
            working_directory=temp_dir,
            permission_mode="plan"  # Plan mode denies edit tools
        )

        # Permission callback that denies all
        def deny_all(tool_name, tool_input):
            return False

        agent = Agent(
            config=config,
            llm_client=mock_llm,
            permission_callback=deny_all
        )

        # Mock complete
        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "stop_reason": "tool_use",
                    "content": [{
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Write",
                        "input": {
                            "file_path": f"{temp_dir}/test.txt",
                            "content": "test"
                        }
                    }]
                }
            else:
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "Permission denied."}]
                }

        mock_llm.complete = mock_complete

        await agent.run("Write a file")


class TestAgentStateManagement:
    """Tests for agent state management."""

    @pytest.fixture
    def agent(self, temp_dir):
        """Create agent with mock LLM."""
        config = AgentConfig(
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        mock_llm = AsyncMock()
        return Agent(config=config, llm_client=mock_llm)

    def test_add_task(self, agent):
        """Test adding tasks."""
        task = agent.add_task("Task 1", "Description 1")
        assert task.id == "1"
        assert task.status == "pending"

        task2 = agent.add_task("Task 2", "Description 2")
        assert task2.id == "2"

    def test_update_task(self, agent):
        """Test updating tasks."""
        agent.add_task("Task", "Desc")
        updated = agent.update_task("1", status="completed", owner="test")
        assert updated.status == "completed"
        assert updated.owner == "test"

    def test_list_tasks(self, agent):
        """Test listing tasks."""
        agent.add_task("Task 1", "D1")
        agent.add_task("Task 2", "D2")

        tasks = agent.list_tasks()
        assert len(tasks) == 2

    def test_get_task(self, agent):
        """Test getting specific task."""
        agent.add_task("Task", "Desc")
        task = agent.get_task("1")
        assert task.subject == "Task"

    def test_get_nonexistent_task(self, agent):
        """Test getting non-existent task."""
        task = agent.get_task("999")
        assert task is None


class TestAgentMessageHandling:
    """Tests for agent message handling."""

    @pytest.fixture
    def agent(self, temp_dir):
        """Create agent for message tests."""
        config = AgentConfig(
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        mock_llm = AsyncMock()
        return Agent(config=config, llm_client=mock_llm)

    def test_message_creation(self, agent):
        """Test message is created correctly."""
        agent.state.messages.append(Message.user("Hello"))

        assert len(agent.state.messages) == 1
        assert agent.state.messages[0].role.value == "user"

    def test_message_api_format(self, agent):
        """Test message API format."""
        msg = Message.user("Test")
        api = msg.to_api_format()

        assert api["role"] == "user"
        assert api["content"] == "Test"

    def test_assistant_message_with_blocks(self, agent):
        """Test assistant message with content blocks."""
        blocks = [
            ContentBlock(type="text", text="Hello"),
            ContentBlock(
                type="tool_use",
                tool_use_id="tool_1",
                tool_name="Read",
                tool_input={"file_path": "/test"}
            )
        ]

        msg = Message.assistant(blocks)
        api = msg.to_api_format()

        assert api["role"] == "assistant"
        assert isinstance(api["content"], list)
        assert len(api["content"]) == 2

    def test_tool_result_message(self, agent):
        """Test tool result message."""
        msg = Message.tool_result("tool_1", "Success", is_error=False)
        api = msg.to_api_format()

        assert api["role"] == "tool"
        assert api["content"][0]["tool_use_id"] == "tool_1"
        assert api["content"][0]["is_error"] is False
"""
Tests for core Agent functionality.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.agent import Agent, AgentState
from src.core.types import AgentConfig, Message, ContentBlock


class TestAgentState:
    """Test AgentState dataclass."""

    def test_default_state(self):
        """Test default state initialization."""
        state = AgentState()
        assert state.messages == []
        assert state.tasks == {}
        assert state.agents == {}
        assert state.iteration == 0
        assert state.tool_call_count == 0

    def test_state_with_data(self):
        """Test state with initial data."""
        state = AgentState(
            messages=[Message.user("test")],
            iteration=5
        )
        assert len(state.messages) == 1
        assert state.iteration == 5


class TestAgentConfig:
    """Test AgentConfig dataclass."""

    def test_default_config(self):
        """Test default configuration."""
        config = AgentConfig()
        assert config.model == "claude-sonnet-4-6"
        assert config.max_tokens == 8192
        assert config.permission_mode == "default"
        assert config.working_directory == "."
        assert config.max_iterations == 50

    def test_custom_config(self):
        """Test custom configuration."""
        config = AgentConfig(
            model="claude-opus-4-6",
            max_tokens=4096,
            permission_mode="bypassPermissions",
            working_directory="/tmp/test"
        )
        assert config.model == "claude-opus-4-6"
        assert config.max_tokens == 4096
        assert config.permission_mode == "bypassPermissions"


class TestAgentInit:
    """Test Agent initialization."""

    def test_default_init(self):
        """Test agent with default configuration."""
        agent = Agent()
        assert agent.config is not None
        assert agent.state is not None
        assert agent.llm is not None

    def test_custom_config(self):
        """Test agent with custom configuration."""
        config = AgentConfig(
            model="claude-opus-4-6",
            working_directory="/tmp"
        )
        agent = Agent(config=config)
        assert agent.config.model == "claude-opus-4-6"


class TestAgentMessages:
    """Test Agent message handling."""

    def test_add_task(self):
        """Test adding a task."""
        agent = Agent()
        task = agent.add_task("Test task", "Description")
        assert task.id == "1"
        assert task.subject == "Test task"
        assert task.description == "Description"
        assert "1" in agent.state.tasks

    def test_get_task(self):
        """Test getting a task."""
        agent = Agent()
        agent.add_task("Test", "Desc")
        task = agent.get_task("1")
        assert task is not None
        assert task.subject == "Test"

    def test_get_nonexistent_task(self):
        """Test getting a non-existent task."""
        agent = Agent()
        task = agent.get_task("999")
        assert task is None

    def test_update_task(self):
        """Test updating a task."""
        agent = Agent()
        agent.add_task("Test", "Desc")
        updated = agent.update_task("1", status="in_progress")
        assert updated.status == "in_progress"

    def test_list_tasks(self):
        """Test listing tasks."""
        agent = Agent()
        agent.add_task("Task 1", "Desc 1")
        agent.add_task("Task 2", "Desc 2")
        tasks = agent.list_tasks()
        assert len(tasks) == 2


class TestContentBlock:
    """Test ContentBlock functionality."""

    def test_text_block(self):
        """Test text content block."""
        block = ContentBlock(type="text", text="Hello")
        api = block.to_api_format()
        assert api["type"] == "text"
        assert api["text"] == "Hello"

    def test_tool_use_block(self):
        """Test tool use content block."""
        block = ContentBlock(
            type="tool_use",
            tool_use_id="call_123",
            tool_name="Bash",
            tool_input={"command": "ls"}
        )
        api = block.to_api_format()
        assert api["type"] == "tool_use"
        assert api["name"] == "Bash"
        assert api["input"]["command"] == "ls"

    def test_tool_result_block(self):
        """Test tool result content block."""
        block = ContentBlock(
            type="tool_result",
            tool_use_id="call_123",
            tool_result_content="Output",
            is_error=False
        )
        api = block.to_api_format()
        assert api["type"] == "tool_result"
        assert api["tool_use_id"] == "call_123"


class TestMessage:
    """Test Message functionality."""

    def test_user_message(self):
        """Test user message creation."""
        msg = Message.user("Hello")
        assert msg.role.value == "user"
        assert msg.content == "Hello"

    def test_assistant_message(self):
        """Test assistant message creation."""
        msg = Message.assistant("Hi there")
        assert msg.role.value == "assistant"
        assert msg.content == "Hi there"

    def test_tool_result_message(self):
        """Test tool result message creation."""
        msg = Message.tool_result("call_123", "Result")
        assert msg.role.value == "tool"
        assert isinstance(msg.content, list)
        assert msg.content[0].type == "tool_result"

    def test_message_to_api_format(self):
        """Test message API format conversion."""
        msg = Message.user("Test")
        api = msg.to_api_format()
        assert api["role"] == "user"
        assert api["content"] == "Test"


class TestSystemPrompt:
    """Test system prompt generation."""

    def test_build_system_prompt(self):
        """Test building system prompt."""
        from src.core.system_prompt import build_system_prompt
        prompt = build_system_prompt("/tmp")
        assert len(prompt) > 0
        assert "Claude agent" in prompt or "software engineering" in prompt.lower()

    def test_system_prompt_contains_tools_section(self):
        """Test system prompt mentions tools."""
        from src.core.system_prompt import build_system_prompt
        prompt = build_system_prompt("/tmp")
        # Should contain some mention of tools
        assert "tool" in prompt.lower()


class TestToolRegistry:
    """Test tool registry functionality."""

    def test_registry_has_tools(self):
        """Test that registry has tools registered."""
        from src.core.tool import registry
        tools = registry.list_tools()
        assert len(tools) > 0
        assert "Bash" in tools
        assert "Read" in tools
        assert "Write" in tools

    def test_get_tool_schema(self):
        """Test getting tool schema."""
        from src.core.tool import registry
        schemas = registry.get_all_schemas()
        assert len(schemas) > 0

        bash_schema = next((s for s in schemas if s.name == "Bash"), None)
        assert bash_schema is not None
        assert "command" in bash_schema.parameters.get("properties", {})

    def test_get_tool_instance(self):
        """Test getting tool instance."""
        from src.core.tool import registry
        tool = registry.get_tool("Bash", "/tmp")
        assert tool is not None
        assert tool.name == "Bash"

    def test_get_nonexistent_tool(self):
        """Test getting non-existent tool."""
        from src.core.tool import registry
        tool = registry.get_tool("NonExistentTool", "/tmp")
        assert tool is None
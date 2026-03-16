"""
Unit tests for core types.
"""

import pytest
import time
from src.core.types import (
    Role, ContentBlock, Message, ToolResult,
    AgentConfig, Task, Memory, CronJob, AgentInfo
)


class TestRole:
    """Tests for Role enum."""

    def test_role_values(self):
        """Test Role enum values."""
        assert Role.USER.value == "user"
        assert Role.ASSISTANT.value == "assistant"
        assert Role.SYSTEM.value == "system"
        assert Role.TOOL.value == "tool"

    def test_role_string_conversion(self):
        """Test Role enum string conversion."""
        # Role inherits from str and Enum, so str(Role.USER) returns the enum name
        # To get the value, use .value property
        assert Role.USER.value == "user"
        # Role can be compared directly with string due to str inheritance
        assert Role.USER == "user"


class TestContentBlock:
    """Tests for ContentBlock dataclass."""

    def test_text_block(self):
        """Test creating a text content block."""
        block = ContentBlock(type="text", text="Hello world")
        assert block.type == "text"
        assert block.text == "Hello world"
        assert block.tool_use_id is None

    def test_text_block_api_format(self):
        """Test text block API format."""
        block = ContentBlock(type="text", text="Hello")
        api = block.to_api_format()
        assert api == {"type": "text", "text": "Hello"}

    def test_tool_use_block(self):
        """Test creating a tool use block."""
        block = ContentBlock(
            type="tool_use",
            tool_use_id="tool-123",
            tool_name="Read",
            tool_input={"file_path": "/test.txt"}
        )
        assert block.type == "tool_use"
        assert block.tool_name == "Read"

    def test_tool_use_block_api_format(self):
        """Test tool use block API format."""
        block = ContentBlock(
            type="tool_use",
            tool_use_id="tool-123",
            tool_name="Bash",
            tool_input={"command": "ls"}
        )
        api = block.to_api_format()
        assert api["type"] == "tool_use"
        assert api["id"] == "tool-123"
        assert api["name"] == "Bash"
        assert api["input"] == {"command": "ls"}

    def test_tool_result_block_api_format(self):
        """Test tool result block API format."""
        block = ContentBlock(
            type="tool_result",
            tool_use_id="tool-123",
            tool_result_content="Success",
            is_error=False
        )
        api = block.to_api_format()
        assert api["type"] == "tool_result"
        assert api["tool_use_id"] == "tool-123"
        assert api["is_error"] is False

    def test_tool_result_block_list_content(self):
        """Test tool result block with list content."""
        block = ContentBlock(
            type="tool_result",
            tool_use_id="tool-123",
            tool_result_content=[{"type": "text", "text": "result"}],
            is_error=True
        )
        api = block.to_api_format()
        assert api["content"] == [{"type": "text", "text": "result"}]
        assert api["is_error"] is True

    def test_image_block_api_format(self):
        """Test image block API format."""
        block = ContentBlock(
            type="image",
            source={"type": "base64", "media_type": "image/png", "data": "abc123"}
        )
        api = block.to_api_format()
        assert api["type"] == "image"
        assert api["source"]["type"] == "base64"


class TestMessage:
    """Tests for Message dataclass."""

    def test_user_message(self):
        """Test creating a user message."""
        msg = Message.user("Hello")
        assert msg.role == Role.USER
        assert msg.content == "Hello"
        assert msg.id is not None
        assert msg.timestamp > 0

    def test_assistant_message_string(self):
        """Test creating an assistant message with string content."""
        msg = Message.assistant("Hi there")
        assert msg.role == Role.ASSISTANT
        assert msg.content == "Hi there"

    def test_assistant_message_blocks(self):
        """Test creating an assistant message with content blocks."""
        blocks = [ContentBlock(type="text", text="Response")]
        msg = Message.assistant(blocks)
        assert msg.role == Role.ASSISTANT
        assert isinstance(msg.content, list)
        assert len(msg.content) == 1

    def test_system_message(self):
        """Test creating a system message."""
        msg = Message.system("System prompt")
        assert msg.role == Role.SYSTEM
        assert msg.content == "System prompt"

    def test_tool_result_message(self):
        """Test creating a tool result message."""
        msg = Message.tool_result("tool-123", "Result content", is_error=False)
        assert msg.role == Role.TOOL
        assert isinstance(msg.content, list)
        assert msg.content[0].type == "tool_result"

    def test_message_api_format_string(self):
        """Test message API format with string content."""
        msg = Message.user("Hello")
        api = msg.to_api_format()
        assert api["role"] == "user"
        assert api["content"] == "Hello"

    def test_message_api_format_blocks(self):
        """Test message API format with content blocks."""
        blocks = [ContentBlock(type="text", text="Hi")]
        msg = Message.assistant(blocks)
        api = msg.to_api_format()
        assert api["role"] == "assistant"
        assert isinstance(api["content"], list)


class TestToolResult:
    """Tests for ToolResult dataclass."""

    def test_success_result(self):
        """Test successful tool result."""
        result = ToolResult(output="Success", is_error=False)
        assert result.output == "Success"
        assert result.is_error is False
        assert result.metadata == {}

    def test_error_result(self):
        """Test error tool result."""
        result = ToolResult(output="Error message", is_error=True)
        assert result.is_error is True

    def test_result_with_metadata(self):
        """Test tool result with metadata."""
        result = ToolResult(
            output="Done",
            metadata={"file_path": "/test.txt", "lines": 10}
        )
        assert result.metadata["file_path"] == "/test.txt"
        assert result.metadata["lines"] == 10


class TestAgentConfig:
    """Tests for AgentConfig dataclass."""

    def test_default_config(self):
        """Test default agent configuration."""
        config = AgentConfig()
        assert config.model == "claude-sonnet-4-6"
        assert config.max_tokens == 8192
        assert config.temperature == 1.0
        assert config.permission_mode == "default"
        assert config.max_iterations == 50

    def test_custom_config(self):
        """Test custom agent configuration."""
        config = AgentConfig(
            model="claude-opus-4-6",
            max_tokens=4096,
            permission_mode="bypassPermissions",
            working_directory="/home/user"
        )
        assert config.model == "claude-opus-4-6"
        assert config.max_tokens == 4096
        assert config.permission_mode == "bypassPermissions"


class TestTask:
    """Tests for Task dataclass."""

    def test_task_creation(self):
        """Test creating a task."""
        task = Task(id="1", subject="Test task", description="Test description")
        assert task.id == "1"
        assert task.subject == "Test task"
        assert task.status == "pending"
        assert task.owner is None

    def test_task_with_dependencies(self):
        """Test task with dependencies."""
        task = Task(
            id="2",
            subject="Dependent task",
            description="Needs task 1",
            blocked_by=["1"],
            blocks=["3"]
        )
        assert "1" in task.blocked_by
        assert "3" in task.blocks


class TestMemory:
    """Tests for Memory dataclass."""

    def test_memory_creation(self):
        """Test creating a memory."""
        memory = Memory(
            name="test_memory",
            description="Test memory",
            type="user",
            content="Remember this"
        )
        assert memory.name == "test_memory"
        assert memory.type == "user"


class TestCronJob:
    """Tests for CronJob dataclass."""

    def test_cron_job_creation(self):
        """Test creating a cron job."""
        job = CronJob(
            id="cron-1",
            cron="0 9 * * *",
            prompt="Daily reminder",
            recurring=True
        )
        assert job.id == "cron-1"
        assert job.cron == "0 9 * * *"
        assert job.recurring is True


class TestAgentInfo:
    """Tests for AgentInfo dataclass."""

    def test_agent_info_creation(self):
        """Test creating agent info."""
        info = AgentInfo(
            id="agent-1",
            type="general-purpose",
            description="Test agent",
            prompt="Do something"
        )
        assert info.id == "agent-1"
        assert info.status == "running"
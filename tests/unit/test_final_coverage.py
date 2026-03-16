"""
Tests for CLI and entry points.
"""

import pytest
from unittest.mock import patch, MagicMock


class TestCLIModule:
    """Tests for CLI module."""

    def test_cli_import(self):
        """Test CLI module can be imported."""
        from src import cli
        assert cli is not None

    def test_cli_main_exists(self):
        """Test main function exists."""
        from src.cli import main
        assert callable(main)

    def test_cli_parse_args(self):
        """Test argument parsing."""
        from src.cli import parse_args

        with patch('sys.argv', ['cli', '--model', 'glm-5']):
            args = parse_args()
            assert args.model == 'glm-5'


class TestTUIMainModule:
    """Tests for TUI main module."""

    def test_tui_main_import(self):
        """Test TUI main module can be imported."""
        from src.tui import __main__
        assert __main__ is not None

    def test_tui_app_import(self):
        """Test TUI app can be imported."""
        from src.tui.app import OpenAgentTUI
        assert OpenAgentTUI is not None


class TestCoreTypesMore:
    """More tests for core types."""

    def test_message_user_creation(self):
        """Test creating user message."""
        from src.core.types import Message, Role

        msg = Message.user("Hello")
        assert msg.role == Role.USER
        assert msg.content == "Hello"

    def test_message_assistant_creation(self):
        """Test creating assistant message."""
        from src.core.types import Message, Role, ContentBlock

        blocks = [ContentBlock(type="text", text="Response")]
        msg = Message.assistant(blocks)
        assert msg.role == Role.ASSISTANT
        assert isinstance(msg.content, list)

    def test_message_tool_result(self):
        """Test creating tool result message."""
        from src.core.types import Message, Role

        msg = Message.tool_result("tool_1", "Success", is_error=False)
        assert msg.role == Role.TOOL

    def test_content_block_text(self):
        """Test creating text content block."""
        from src.core.types import ContentBlock

        block = ContentBlock(type="text", text="Hello")
        api = block.to_api_format()
        assert api["type"] == "text"
        assert api["text"] == "Hello"

    def test_content_block_tool_use(self):
        """Test creating tool use content block."""
        from src.core.types import ContentBlock

        block = ContentBlock(
            type="tool_use",
            tool_use_id="tool_1",
            tool_name="Read",
            tool_input={"file_path": "/test.txt"}
        )
        api = block.to_api_format()
        assert api["type"] == "tool_use"
        assert api["name"] == "Read"

    def test_task_creation(self):
        """Test creating a task."""
        from src.core.types import Task

        task = Task(id="1", subject="Test", description="Test task")
        assert task.id == "1"
        assert task.status == "pending"

    def test_task_with_dependencies(self):
        """Test task with dependencies."""
        from src.core.types import Task

        task = Task(
            id="2",
            subject="Dependent",
            description="Depends on task 1",
            blocked_by=["1"],
            blocks=["3"]
        )
        assert "1" in task.blocked_by
        assert "3" in task.blocks

    def test_memory_creation(self):
        """Test creating a memory."""
        from src.core.types import Memory

        memory = Memory(
            name="test",
            description="Test memory",
            type="user",
            content="Test content"
        )
        assert memory.name == "test"
        assert memory.type == "user"

    def test_cron_job_creation(self):
        """Test creating a cron job."""
        from src.core.types import CronJob

        job = CronJob(
            id="cron_1",
            cron="0 9 * * *",
            prompt="Daily reminder",
            recurring=True
        )
        assert job.id == "cron_1"
        assert job.recurring is True

    def test_agent_info_creation(self):
        """Test creating agent info."""
        from src.core.types import AgentInfo

        info = AgentInfo(
            id="agent_1",
            type="general-purpose",
            description="Test agent",
            prompt="Do something"
        )
        assert info.id == "agent_1"
        assert info.status == "running"


class TestToolRegistryMore:
    """More tests for tool registry."""

    def test_get_tool_by_name(self):
        """Test getting tool by name."""
        from src.core.tool import registry

        tool = registry.get_tool("Read", ".")
        assert tool is not None
        assert tool.name == "Read"

    def test_get_nonexistent_tool(self):
        """Test getting non-existent tool."""
        from src.core.tool import registry

        tool = registry.get_tool("NonExistentTool", ".")
        assert tool is None

    def test_list_all_tools(self):
        """Test listing all tools."""
        from src.core.tool import registry

        tools = registry.list_tools()
        assert len(tools) > 10  # Should have many tools

    def test_get_schemas_for_tools(self):
        """Test getting schemas for specific tools."""
        from src.core.tool import registry

        schemas = registry.get_all_schemas(["Read", "Write"])
        assert len(schemas) == 2


class TestSystemPrompt:
    """Tests for system prompt building."""

    def test_build_default_prompt(self):
        """Test building default system prompt."""
        from src.core.system_prompt import build_system_prompt

        prompt = build_system_prompt("/home/user/project")
        assert len(prompt) > 0
        assert "agent" in prompt.lower() or "assistant" in prompt.lower()

    def test_system_prompt_has_tools_info(self):
        """Test system prompt has tool information."""
        from src.core.system_prompt import build_system_prompt

        prompt = build_system_prompt("/home/user")
        # Should mention something about tools or capabilities
        assert len(prompt) > 100


class TestMemoryManagerMore:
    """More tests for memory manager."""

    @pytest.fixture
    def memory_manager(self, temp_dir):
        """Create a memory manager instance."""
        from src.memory.manager import MemoryManager
        return MemoryManager(temp_dir)

    def test_save_user_memory(self, memory_manager):
        """Test saving user memory."""
        memory = memory_manager.save_memory(
            "user_pref",
            "User preference",
            "user",
            "User prefers dark mode"
        )
        assert memory.name == "user_pref"
        assert memory.type == "user"

    def test_save_feedback_memory(self, memory_manager):
        """Test saving feedback memory."""
        memory = memory_manager.save_memory(
            "feedback_1",
            "User feedback",
            "feedback",
            "Don't use tabs, use spaces"
        )
        assert memory.type == "feedback"

    def test_load_nonexistent_memory(self, memory_manager):
        """Test loading non-existent memory."""
        loaded = memory_manager.load_memory("nonexistent")
        assert loaded is None

    def test_delete_memory(self, memory_manager):
        """Test deleting memory."""
        memory_manager.save_memory("to_delete", "Test", "user", "Content")
        memory_manager.delete_memory("to_delete")
        loaded = memory_manager.load_memory("to_delete")
        assert loaded is None

    def test_list_memories_empty(self, temp_dir):
        """Test listing memories when empty."""
        from src.memory.manager import MemoryManager
        import os

        # Create a fresh temp dir
        fresh_dir = os.path.join(temp_dir, "fresh")
        os.makedirs(fresh_dir, exist_ok=True)

        manager = MemoryManager(fresh_dir)
        memories = manager.list_memories()
        assert memories == []

    def test_clear_all_memories(self, memory_manager):
        """Test clearing all memories."""
        memory_manager.save_memory("m1", "M1", "user", "C1")
        memory_manager.save_memory("m2", "M2", "user", "C2")

        memory_manager.clear_all()

        memories = memory_manager.list_memories()
        assert len(memories) == 0


class TestPermissionManagerMore:
    """More tests for permission manager."""

    def test_bypass_permissions(self):
        """Test bypass permissions mode."""
        from src.utils.permission import PermissionManager

        pm = PermissionManager(mode="bypassPermissions")

        # Should allow all tools
        import asyncio
        result = asyncio.run(pm.check("Write", {"file_path": "/test", "content": "test"}))
        assert result is True

    def test_plan_mode_restrictions(self):
        """Test plan mode restrictions."""
        from src.utils.permission import PermissionManager

        pm = PermissionManager(mode="plan")

        import asyncio
        # Should allow safe tools
        result = asyncio.run(pm.check("Read", {"file_path": "/test"}))
        assert result is True

    def test_custom_callback(self):
        """Test custom permission callback."""
        from src.utils.permission import PermissionManager

        def deny_write(tool_name, tool_input):
            return tool_name != "Write"

        pm = PermissionManager(mode="default", callback=deny_write)

        import asyncio
        result = asyncio.run(pm.check("Write", {}))
        assert result is False

        result = asyncio.run(pm.check("Read", {}))
        assert result is True

    def test_deny_tool(self):
        """Test denying a tool."""
        from src.utils.permission import PermissionManager

        pm = PermissionManager()
        pm.deny_tool("Bash")

        # Tool should be in denied set
        assert "Bash" in pm._denied_tools

    def test_allow_tool(self):
        """Test allowing a previously denied tool."""
        from src.utils.permission import PermissionManager

        pm = PermissionManager()
        pm.deny_tool("Bash")
        pm.allow_tool("Bash")

        assert "Bash" not in pm._denied_tools
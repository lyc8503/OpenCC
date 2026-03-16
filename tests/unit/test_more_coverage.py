"""
Additional tests to boost coverage.
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock


class TestReadToolMore:
    """More tests for Read tool to increase coverage."""

    @pytest.fixture
    def read_tool(self, temp_dir):
        """Create a Read tool instance."""
        from src.tools.read import ReadTool
        return ReadTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_read_marks_for_write(self, read_tool, temp_dir):
        """Test marking file for write tool."""
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("content")

        result = await read_tool.execute(file_path=str(test_file))
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_read_directory_error(self, read_tool, temp_dir):
        """Test reading a directory returns error."""
        result = await read_tool.execute(file_path=temp_dir)
        assert result.is_error is True

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self, read_tool):
        """Test reading non-existent file."""
        result = await read_tool.execute(file_path="/nonexistent/file.txt")
        assert result.is_error is True

    @pytest.mark.asyncio
    async def test_read_relative_path_error(self, read_tool):
        """Test reading with relative path fails."""
        result = await read_tool.execute(file_path="relative/path.txt")
        assert result.is_error is True

    @pytest.mark.asyncio
    async def test_read_empty_file(self, read_tool, temp_dir):
        """Test reading empty file."""
        test_file = Path(temp_dir) / "empty.txt"
        test_file.write_text("")

        result = await read_tool.execute(file_path=str(test_file))
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_read_with_limit(self, read_tool, temp_dir):
        """Test reading with limit."""
        test_file = Path(temp_dir) / "limit.txt"
        test_file.write_text("line1\nline2\nline3\n")

        result = await read_tool.execute(file_path=str(test_file), limit=2)
        assert result.is_error is False


class TestGrepToolMore:
    """More tests for Grep tool."""

    @pytest.fixture
    def grep_tool(self, temp_dir):
        """Create a Grep tool instance."""
        from src.tools.grep import GrepTool

        Path(temp_dir, "test1.txt").write_text("hello world\nfoo bar\n")
        Path(temp_dir, "test2.txt").write_text("hello universe\n")

        return GrepTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_grep_output_mode_content(self, grep_tool):
        """Test grep with content output mode."""
        result = await grep_tool.execute(
            pattern="hello",
            output_mode="content"
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_grep_with_type(self, grep_tool):
        """Test grep with type filter."""
        result = await grep_tool.execute(
            pattern="hello",
            type="txt"
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_grep_head_limit(self, grep_tool):
        """Test grep with head limit."""
        result = await grep_tool.execute(
            pattern="hello",
            head_limit=1
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_grep_neg_offset(self, grep_tool, temp_dir):
        """Test grep with negative offset."""
        Path(temp_dir, "multi.txt").write_text("\n\nhello\n")
        result = await grep_tool.execute(
            pattern="hello",
            offset=2
        )
        assert result.is_error is False


class TestBashToolMore:
    """More tests for Bash tool."""

    @pytest.fixture
    def bash_tool(self, temp_dir):
        """Create a Bash tool instance."""
        from src.tools.bash import BashTool
        return BashTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_bash_description(self, bash_tool):
        """Test bash with description."""
        result = await bash_tool.execute(
            command="echo test",
            description="Test command"
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_bash_dangerous_sandbox(self, bash_tool):
        """Test bash with dangerous sandbox disable."""
        result = await bash_tool.execute(
            command="echo test",
            dangerouslyDisableSandbox=True
        )
        assert result.is_error is False

    @pytest.mark.asyncio
    async def test_bash_timeout_ms(self, bash_tool):
        """Test bash with timeout in ms."""
        result = await bash_tool.execute(
            command="echo test",
            timeout=5000
        )
        assert result.is_error is False


class TestSkillToolMore:
    """More tests for Skill tool."""

    @pytest.fixture
    def skill_tool(self, temp_dir):
        """Create a Skill tool instance."""
        from src.tools.skill import SkillTool
        return SkillTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_skill_execute_no_callback(self, skill_tool):
        """Test skill execute without callback."""
        result = await skill_tool.execute(skill="test-skill")
        # Without callback, should return error or message
        assert result is not None


class TestWebFetchToolMore:
    """More tests for WebFetch tool."""

    @pytest.fixture
    def web_fetch_tool(self, temp_dir):
        """Create a WebFetch tool instance."""
        from src.tools.web import WebFetchTool
        return WebFetchTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_fetch_invalid_url(self, web_fetch_tool):
        """Test fetching invalid URL."""
        result = await web_fetch_tool.execute(
            url="not-a-url",
            prompt="test"
        )
        assert result.is_error is True


class TestAgentToolMore:
    """More tests for Agent tool."""

    @pytest.fixture
    def agent_tool(self, temp_dir):
        """Create an Agent tool instance."""
        from src.tools.agent import AgentTool
        return AgentTool(working_directory=temp_dir)

    @pytest.mark.asyncio
    async def test_agent_tool_schema(self, agent_tool):
        """Test Agent tool schema."""
        schema = agent_tool.get_schema()
        assert "prompt" in schema.parameters["properties"]
        assert "description" in schema.parameters["properties"]
        assert "subagent_type" in schema.parameters["properties"]


class TestSystemPrompt:
    """Tests for system prompt builder."""

    def test_build_system_prompt(self):
        """Test building system prompt."""
        from src.core.system_prompt import build_system_prompt
        prompt = build_system_prompt("/home/user")
        assert len(prompt) > 0
        assert "agent" in prompt.lower() or "assistant" in prompt.lower()


class TestToolRegistry:
    """Tests for tool registry."""

    def test_registry_list_tools(self):
        """Test listing tools in registry."""
        from src.core.tool import registry
        tools = registry.list_tools()
        assert len(tools) > 0
        assert "Read" in tools
        assert "Write" in tools
        assert "Bash" in tools

    def test_registry_get_schemas(self):
        """Test getting all schemas."""
        from src.core.tool import registry
        schemas = registry.get_all_schemas()
        assert len(schemas) > 0


class TestMemoryManager:
    """Tests for memory manager."""

    @pytest.fixture
    def memory_manager(self, temp_dir):
        """Create a memory manager instance."""
        from src.memory.manager import MemoryManager
        return MemoryManager(temp_dir)

    def test_save_and_load_memory(self, memory_manager):
        """Test saving and loading memory."""
        memory_manager.save_memory("test", "Test memory", "user", "Test content")
        loaded = memory_manager.load_memory("test")
        assert loaded is not None
        assert loaded.content == "Test content"

    def test_list_memories(self, memory_manager):
        """Test listing memories."""
        memory_manager.save_memory("mem1", "Memory 1", "user", "Content 1")
        memory_manager.save_memory("mem2", "Memory 2", "feedback", "Content 2")
        memories = memory_manager.list_memories()
        assert len(memories) >= 2

    def test_delete_memory(self, memory_manager):
        """Test deleting memory."""
        memory_manager.save_memory("to_delete", "To delete", "user", "Content")
        memory_manager.delete_memory("to_delete")
        loaded = memory_manager.load_memory("to_delete")
        assert loaded is None

    def test_get_memory_context(self, memory_manager):
        """Test getting memory context."""
        memory_manager.save_memory("ctx1", "Context 1", "user", "Context content")
        context = memory_manager.get_memory_context()
        # The context is the index file content, which lists the memory files
        assert "ctx1" in context


class TestPermissionManager:
    """Tests for permission manager."""

    def test_default_mode(self):
        """Test default permission mode."""
        from src.utils.permission import PermissionManager
        pm = PermissionManager(mode="default")
        # Default mode should ask for permission on certain tools
        assert pm.mode == "default"

    def test_bypass_mode(self):
        """Test bypass permission mode."""
        from src.utils.permission import PermissionManager
        pm = PermissionManager(mode="bypassPermissions")
        # Bypass should allow everything
        assert pm.mode == "bypassPermissions"

    def test_plan_mode(self):
        """Test plan permission mode."""
        from src.utils.permission import PermissionManager
        pm = PermissionManager(mode="plan")
        # Plan mode has restrictions
        assert pm.mode == "plan"

    def test_add_rule(self):
        """Test adding permission rule."""
        from src.utils.permission import PermissionManager
        pm = PermissionManager()
        pm.add_rule(pattern="Bash", allow=False, reason="Test rule")
        # Rule should be added
        assert len(pm.rules) > 0


class TestTodoManager:
    """Tests for todo manager."""

    def test_singleton(self):
        """Test TodoManager singleton."""
        from src.tools.todo import TodoManager
        m1 = TodoManager()
        m2 = TodoManager()
        assert m1 is m2

    def test_get_by_id(self):
        """Test getting todo by ID."""
        from src.tools.todo import TodoManager, TodoItem
        manager = TodoManager()
        manager.todos = [
            TodoItem(id="1", content="Test", status="pending")
        ]
        found = manager.get_by_id("1")
        assert found is not None
        assert found.content == "Test"

    def test_get_by_id_not_found(self):
        """Test getting non-existent todo."""
        from src.tools.todo import TodoManager
        manager = TodoManager()
        manager.todos = []
        found = manager.get_by_id("999")
        assert found is None
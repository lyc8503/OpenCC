"""
Unit tests for utility modules.
"""

import pytest
from src.utils.permission import PermissionManager, PermissionRule


class TestPermissionManager:
    """Tests for PermissionManager."""

    def test_default_mode(self):
        """Test default permission mode."""
        pm = PermissionManager()
        assert pm.mode == "default"

    def test_bypass_mode(self):
        """Test bypass permissions mode."""
        pm = PermissionManager(mode="bypassPermissions")
        assert pm.mode == "bypassPermissions"

    @pytest.mark.asyncio
    async def test_bypass_allows_all(self):
        """Test that bypass mode allows all tools."""
        pm = PermissionManager(mode="bypassPermissions")
        result = await pm.check("Bash", {"command": "rm -rf /"})
        assert result is True

    @pytest.mark.asyncio
    async def test_accept_edits_mode(self):
        """Test acceptEdits mode."""
        pm = PermissionManager(mode="acceptEdits")
        # Edit tools should be allowed
        assert await pm.check("Edit", {}) is True
        assert await pm.check("Write", {}) is True
        assert await pm.check("Bash", {}) is True

    @pytest.mark.asyncio
    async def test_plan_mode(self):
        """Test plan mode allows only safe tools."""
        pm = PermissionManager(mode="plan")
        # Safe tools should be allowed
        assert await pm.check("Read", {}) is True
        assert await pm.check("Glob", {}) is True
        assert await pm.check("Grep", {}) is True
        # Edit tools should be denied
        assert await pm.check("Edit", {}) is False
        assert await pm.check("Write", {}) is False

    @pytest.mark.asyncio
    async def test_auto_mode_safe_tools(self):
        """Test auto mode with safe tools."""
        pm = PermissionManager(mode="auto")
        # Safe tools should be auto-approved
        assert await pm.check("Read", {}) is True
        assert await pm.check("Glob", {}) is True

    @pytest.mark.asyncio
    async def test_callback_permission(self):
        """Test permission callback."""
        called = []

        def callback(tool_name, tool_input):
            called.append((tool_name, tool_input))
            return True

        pm = PermissionManager(mode="default", callback=callback)
        result = await pm.check("TestTool", {"arg": "value"})
        assert result is True
        assert len(called) == 1
        assert called[0][0] == "TestTool"

    def test_add_rule(self):
        """Test adding permission rules."""
        pm = PermissionManager()
        pm.add_rule("Bash(rm:*)", allow=False, reason="Dangerous")
        assert len(pm.rules) == 1

    @pytest.mark.asyncio
    async def test_rule_deny(self):
        """Test deny rule."""
        pm = PermissionManager(mode="bypassPermissions")
        pm.add_rule("Bash", allow=False)
        result = await pm.check("Bash", {})
        assert result is False

    def test_match_pattern_simple(self):
        """Test simple pattern matching."""
        pm = PermissionManager()
        assert pm._match_pattern("Bash", "Bash") is True
        assert pm._match_pattern("Bash", "Edit") is False

    def test_match_pattern_with_args(self):
        """Test pattern matching with arguments."""
        pm = PermissionManager()
        assert pm._match_pattern("Bash", "Bash(rm:*)") is True

    def test_deny_tool(self):
        """Test deny_tool method."""
        pm = PermissionManager()
        pm.deny_tool("Bash")
        assert "Bash" in pm._denied_tools

    def test_allow_tool(self):
        """Test allow_tool method."""
        pm = PermissionManager()
        pm.deny_tool("Bash")
        pm.allow_tool("Bash")
        assert "Bash" not in pm._denied_tools


class TestPermissionRule:
    """Tests for PermissionRule."""

    def test_rule_creation(self):
        """Test creating a permission rule."""
        rule = PermissionRule(pattern="Bash", allow=True)
        assert rule.pattern == "Bash"
        assert rule.allow is True

    def test_rule_with_reason(self):
        """Test rule with reason."""
        rule = PermissionRule(
            pattern="Bash(rm:*)",
            allow=False,
            reason="Dangerous command"
        )
        assert rule.reason == "Dangerous command"


class TestLLMClient:
    """Tests for LLM client utilities."""

    def test_create_anthropic_client(self):
        """Test creating Anthropic client."""
        from src.utils.llm import create_llm_client, AnthropicClient
        client = create_llm_client(provider="anthropic", model="claude-sonnet-4-6")
        assert isinstance(client, AnthropicClient)

    def test_create_openai_client(self):
        """Test creating OpenAI client."""
        from src.utils.llm import create_llm_client, OpenAIClient
        client = create_llm_client(provider="openai", model="gpt-4o")
        assert isinstance(client, OpenAIClient)

    def test_invalid_provider(self):
        """Test creating client with invalid provider."""
        from src.utils.llm import create_llm_client
        with pytest.raises(ValueError):
            create_llm_client(provider="invalid")

    def test_openai_format_messages(self):
        """Test OpenAI message formatting."""
        from src.utils.llm import OpenAIClient
        client = OpenAIClient()

        formatted = client._format_messages(
            system="You are helpful",
            messages=[
                {"role": "user", "content": "Hello"}
            ]
        )

        assert formatted[0]["role"] == "system"
        assert formatted[1]["role"] == "user"

    def test_openai_format_tool_results(self):
        """Test OpenAI formatting of tool results."""
        from src.utils.llm import OpenAIClient
        client = OpenAIClient()

        formatted = client._format_messages(
            system="System",
            messages=[
                {"role": "tool", "tool_call_id": "call-123", "content": "result"}
            ]
        )

        assert formatted[1]["role"] == "tool"
        assert formatted[1]["tool_call_id"] == "call-123"


class TestMemoryManager:
    """Tests for MemoryManager."""

    @pytest.fixture
    def memory_manager(self, temp_dir):
        """Create a MemoryManager instance."""
        from src.memory.manager import MemoryManager
        return MemoryManager(working_directory=temp_dir)

    def test_memory_dir_creation(self, memory_manager):
        """Test that memory directory is created."""
        memory_manager._ensure_dir()
        assert memory_manager.memory_dir.exists()

    def test_save_memory(self, memory_manager):
        """Test saving a memory."""
        memory_manager._ensure_dir()
        memory = memory_manager.save_memory(
            name="test",
            description="Test memory",
            type="user",
            content="Remember this"
        )
        assert memory.name == "test"
        assert memory.type == "user"

    def test_load_memory(self, memory_manager):
        """Test loading a memory."""
        memory_manager.save_memory(
            name="test_load",
            description="Test",
            type="feedback",
            content="Feedback content"
        )

        loaded = memory_manager.load_memory("test_load")
        assert loaded is not None
        assert loaded.name == "test_load"
        assert loaded.content == "Feedback content"

    def test_load_nonexistent_memory(self, memory_manager):
        """Test loading non-existent memory."""
        loaded = memory_manager.load_memory("nonexistent")
        assert loaded is None

    def test_list_memories(self, memory_manager):
        """Test listing memories."""
        memory_manager.save_memory("m1", "Desc 1", "user", "Content 1")
        memory_manager.save_memory("m2", "Desc 2", "project", "Content 2")

        all_memories = memory_manager.list_memories()
        assert len(all_memories) == 2

        user_memories = memory_manager.list_memories(type="user")
        assert len(user_memories) == 1

    def test_delete_memory(self, memory_manager):
        """Test deleting a memory."""
        memory_manager.save_memory("to_delete", "Desc", "user", "Content")

        result = memory_manager.delete_memory("to_delete")
        assert result is True

        loaded = memory_manager.load_memory("to_delete")
        assert loaded is None

    def test_get_memory_context(self, memory_manager):
        """Test getting memory context."""
        memory_manager.save_memory("ctx", "Context", "user", "Some content")

        context = memory_manager.get_memory_context()
        assert "ctx" in context or context == ""

    def test_clear_all(self, memory_manager):
        """Test clearing all memories."""
        memory_manager.save_memory("m1", "D1", "user", "C1")
        memory_manager.save_memory("m2", "D2", "user", "C2")

        memory_manager.clear_all()

        memories = memory_manager.list_memories()
        assert len(memories) == 0
"""
Tests comparing src agent and Claude CLI tool definitions.

These tests verify that the src implementation matches Claude CLI exactly.
Run these tests separately as they require Claude CLI to be installed.
"""

import pytest
import sys
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


# Skip all tests in this module if Claude CLI is not available
pytestmark = pytest.mark.skipif(
    not shutil.which("claude"),
    reason="Claude CLI not installed"
)


class TestToolDefinitions:
    """Test that tool definitions match Claude CLI exactly."""

    @pytest.mark.asyncio
    async def test_tool_count(self, mock_server):
        """Test that both implementations provide the same number of tools."""
        from tests.agent_interface import SrcAgent, ClaudeCliAgent
        from tests.mock_server import create_text_response

        mock_server.set_response_generator(lambda r: create_text_response("Done"))
        mock_server.clear_recorded_requests()

        # Run src agent
        src_agent = SrcAgent(base_url=mock_server.get_base_url())
        src_agent.setup()
        await src_agent.run("Hello")
        src_request = mock_server.get_first_request()
        src_agent.teardown()

        # Run Claude CLI
        mock_server.clear_recorded_requests()
        claude_agent = ClaudeCliAgent(base_url=mock_server.get_base_url())
        claude_agent.setup()
        await claude_agent.run("Hello")
        claude_request = mock_server.get_first_request()
        claude_agent.teardown()

        # Compare tool counts
        tools_src = src_request.get("tools", []) if src_request else []
        tools_claude = claude_request.get("tools", []) if claude_request else []

        assert len(tools_src) == len(tools_claude), \
            f"Tool count mismatch: src={len(tools_src)}, claude={len(tools_claude)}"

    @pytest.mark.asyncio
    async def test_tool_names(self, mock_server):
        """Test that both implementations provide the same tool names."""
        from tests.agent_interface import SrcAgent, ClaudeCliAgent
        from tests.mock_server import create_text_response

        mock_server.set_response_generator(lambda r: create_text_response("Done"))
        mock_server.clear_recorded_requests()

        # Run src agent
        src_agent = SrcAgent(base_url=mock_server.get_base_url())
        src_agent.setup()
        await src_agent.run("Hello")
        src_request = mock_server.get_first_request()
        src_agent.teardown()

        # Run Claude CLI
        mock_server.clear_recorded_requests()
        claude_agent = ClaudeCliAgent(base_url=mock_server.get_base_url())
        claude_agent.setup()
        await claude_agent.run("Hello")
        claude_request = mock_server.get_first_request()
        claude_agent.teardown()

        # Compare tool names
        names_src = sorted([t.get("name") for t in src_request.get("tools", [])])
        names_claude = sorted([t.get("name") for t in claude_request.get("tools", [])])

        assert names_src == names_claude, \
            f"Tool names mismatch:\nsrc={names_src}\nclaude={names_claude}"

    @pytest.mark.asyncio
    async def test_all_tools_required_fields(self, mock_server):
        """Test that all tool required fields match."""
        from tests.agent_interface import SrcAgent, ClaudeCliAgent
        from tests.mock_server import create_text_response

        mock_server.set_response_generator(lambda r: create_text_response("Done"))
        mock_server.clear_recorded_requests()

        # Run src agent
        src_agent = SrcAgent(base_url=mock_server.get_base_url())
        src_agent.setup()
        await src_agent.run("Hello")
        src_request = mock_server.get_first_request()
        src_agent.teardown()

        # Run Claude CLI
        mock_server.clear_recorded_requests()
        claude_agent = ClaudeCliAgent(base_url=mock_server.get_base_url())
        claude_agent.setup()
        await claude_agent.run("Hello")
        claude_request = mock_server.get_first_request()
        claude_agent.teardown()

        # Compare all tools
        tools_src = {t.get("name"): t for t in src_request.get("tools", [])}
        tools_claude = {t.get("name"): t for t in claude_request.get("tools", [])}

        mismatches = []
        for name in tools_src:
            if name not in tools_claude:
                continue
            schema_src = tools_src[name].get("input_schema", {})
            schema_claude = tools_claude[name].get("input_schema", {})

            required_src = set(schema_src.get("required", []))
            required_claude = set(schema_claude.get("required", []))

            if required_src != required_claude:
                mismatches.append(f"{name}: src={required_src}, claude={required_claude}")

        assert not mismatches, f"Required field mismatches:\n" + "\n".join(mismatches)
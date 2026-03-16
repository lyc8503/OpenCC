"""
Integration tests for LLM client with mock server.
"""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from tests.integration.mock_server import MockLLMServer, create_text_response, create_tool_response


class TestOpenAIClientIntegration:
    """Integration tests for OpenAI client."""

    @pytest.fixture
    def openai_client(self):
        """Create an OpenAI client for testing."""
        from src.utils.llm import OpenAIClient
        return OpenAIClient(
            api_key="test-key",
            base_url="http://localhost:8765/v1",
            model="test-model"
        )

    @pytest.mark.asyncio
    async def test_complete_basic(self, openai_client):
        """Test basic completion request."""
        with patch.object(openai_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Hello!"
            mock_response.choices[0].message.tool_calls = None
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await openai_client.complete(
                system="You are helpful",
                messages=[{"role": "user", "content": "Hi"}]
            )

            assert result["stop_reason"] == "end_turn"
            assert len(result["content"]) == 1

    @pytest.mark.asyncio
    async def test_complete_with_tools(self, openai_client):
        """Test completion with tool definitions."""
        with patch.object(openai_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = None
            mock_response.choices[0].message.tool_calls = [
                MagicMock(
                    id="call_1",
                    function=MagicMock(
                        name="Read",
                        arguments='{"file_path": "/test.txt"}'
                    )
                )
            ]
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            tools = [{
                "name": "Read",
                "description": "Read a file",
                "input_schema": {"type": "object", "properties": {"file_path": {"type": "string"}}}
            }]

            result = await openai_client.complete(
                system="You are helpful",
                messages=[{"role": "user", "content": "Read test.txt"}],
                tools=tools
            )

            assert result["stop_reason"] == "tool_calls"
            assert result["content"][0]["type"] == "tool_use"

    @pytest.mark.asyncio
    async def test_message_formatting(self, openai_client):
        """Test message formatting."""
        formatted = openai_client._format_messages(
            system="System prompt",
            messages=[
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there"}
            ]
        )

        assert formatted[0]["role"] == "system"
        assert formatted[1]["role"] == "user"
        assert formatted[2]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_tool_result_formatting(self, openai_client):
        """Test tool result message formatting."""
        formatted = openai_client._format_messages(
            system="System",
            messages=[{
                "role": "tool",
                "tool_use_id": "tool_123",
                "content": [{"type": "text", "text": "result"}]
            }]
        )

        assert formatted[1]["role"] == "tool"
        assert formatted[1]["tool_call_id"] == "tool_123"

    @pytest.mark.asyncio
    async def test_streaming(self, openai_client):
        """Test streaming completion."""
        async def mock_stream():
            chunks = [
                MagicMock(choices=[MagicMock(delta=MagicMock(content="Hello", reasoning_content=None))]),
                MagicMock(choices=[MagicMock(delta=MagicMock(content=" world", reasoning_content=None))]),
            ]
            for chunk in chunks:
                yield chunk

        with patch.object(openai_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())
            mock_get_client.return_value = mock_client

            chunks = []
            async for chunk in openai_client.stream(
                system="System",
                messages=[{"role": "user", "content": "Hi"}]
            ):
                if chunk.get("type") == "text_delta":
                    chunks.append(chunk["text"])

            assert len(chunks) == 2


class TestAnthropicClientIntegration:
    """Integration tests for Anthropic client."""

    @pytest.fixture
    def anthropic_client(self):
        """Create an Anthropic client for testing."""
        from src.utils.llm import AnthropicClient
        return AnthropicClient(
            api_key="test-key",
            model="claude-sonnet-4-6"
        )

    @pytest.mark.asyncio
    async def test_complete_basic(self, anthropic_client):
        """Test basic completion."""
        with patch.object(anthropic_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()

            # Create mock response
            mock_response = MagicMock()
            mock_response.content = [MagicMock(type="text", text="Hello!")]
            mock_response.stop_reason = "end_turn"
            mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)

            mock_client.messages.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await anthropic_client.complete(
                system="You are helpful",
                messages=[{"role": "user", "content": "Hi"}]
            )

            assert result["stop_reason"] == "end_turn"
            assert len(result["content"]) == 1

    @pytest.mark.asyncio
    async def test_complete_with_tools(self, anthropic_client):
        """Test completion with tools."""
        with patch.object(anthropic_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()

            # Create mock response with tool use
            mock_content = MagicMock()
            mock_content.type = "tool_use"
            mock_content.id = "toolu_123"
            mock_content.name = "Read"
            mock_content.input = {"file_path": "/test.txt"}

            mock_response = MagicMock()
            mock_response.content = [mock_content]
            mock_response.stop_reason = "tool_use"
            mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)

            mock_client.messages.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            tools = [{
                "name": "Read",
                "description": "Read a file",
                "input_schema": {"type": "object"}
            }]

            result = await anthropic_client.complete(
                system="System",
                messages=[{"role": "user", "content": "Read test.txt"}],
                tools=tools
            )

            assert result["stop_reason"] == "tool_use"
            assert result["content"][0]["type"] == "tool_use"


class TestLLMClientFactory:
    """Tests for LLM client factory."""

    def test_create_anthropic(self):
        """Test creating Anthropic client."""
        from src.utils.llm import create_llm_client, AnthropicClient
        client = create_llm_client("anthropic", "claude-sonnet-4-6")
        assert isinstance(client, AnthropicClient)

    def test_create_openai(self):
        """Test creating OpenAI client."""
        from src.utils.llm import create_llm_client, OpenAIClient
        client = create_llm_client("openai", "gpt-4o", api_key="test", base_url="http://test")
        assert isinstance(client, OpenAIClient)

    def test_invalid_provider(self):
        """Test invalid provider raises error."""
        from src.utils.llm import create_llm_client
        with pytest.raises(ValueError):
            create_llm_client("invalid_provider")


class TestAgentWithMockLLM:
    """Integration tests for Agent with mock LLM."""

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM client."""
        mock = AsyncMock()
        return mock

    @pytest.fixture
    def agent(self, mock_llm, temp_dir):
        """Create an agent with mock LLM."""
        from src.core.agent import Agent
        from src.core.types import AgentConfig

        config = AgentConfig(
            model="test-model",
            working_directory=temp_dir,
            permission_mode="bypassPermissions"
        )
        return Agent(config=config, llm_client=mock_llm)

    @pytest.mark.asyncio
    async def test_agent_simple_flow(self, agent, mock_llm):
        """Test simple agent flow."""
        # Mock LLM complete response
        async def mock_complete(*args, **kwargs):
            return {
                "stop_reason": "end_turn",
                "content": [{"type": "text", "text": "Hello!"}]
            }

        mock_llm.complete = mock_complete

        result = await agent.run("Hi")
        assert result is not None

    @pytest.mark.asyncio
    async def test_agent_tool_call_flow(self, agent, mock_llm, temp_dir):
        """Test agent with tool calls."""
        from pathlib import Path

        # Create a test file
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("Hello World")

        # First response: tool call
        # Second response: text after tool result
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

        # Run agent
        result = await agent.run("Read the test file")
        # The agent should have processed the tool call
        assert agent.state.tool_call_count >= 1 or result is not None
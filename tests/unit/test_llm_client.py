"""
Unit tests for LLM client.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestOpenAIClient:
    """Tests for OpenAI client."""

    @pytest.fixture
    def openai_client(self):
        """Create an OpenAI client for testing."""
        from src.utils.llm import OpenAIClient
        return OpenAIClient(
            api_key="test-key",
            base_url="http://localhost:8765/v1",
            model="test-model"
        )

    def test_client_creation(self, openai_client):
        """Test client creation."""
        assert openai_client.model == "test-model"
        assert openai_client.api_key == "test-key"

    def test_format_messages_with_system(self, openai_client):
        """Test message formatting with system prompt."""
        formatted = openai_client._format_messages(
            system="System prompt",
            messages=[{"role": "user", "content": "Hello"}]
        )
        assert formatted[0]["role"] == "system"
        assert formatted[0]["content"] == "System prompt"

    def test_format_messages_with_assistant(self, openai_client):
        """Test message formatting with assistant message."""
        formatted = openai_client._format_messages(
            system="System",
            messages=[
                {"role": "user", "content": "Hi"},
                {"role": "assistant", "content": "Hello!"}
            ]
        )
        assert len(formatted) == 3
        assert formatted[2]["role"] == "assistant"

    def test_format_tool_result(self, openai_client):
        """Test formatting tool result message."""
        formatted = openai_client._format_messages(
            system="System",
            messages=[{
                "role": "tool",
                "tool_use_id": "tool_123",
                "content": [{"type": "text", "text": "result"}]
            }]
        )
        assert formatted[1]["role"] == "tool"

    @pytest.mark.asyncio
    async def test_complete_with_mock(self, openai_client):
        """Test complete with mocked client."""
        with patch.object(openai_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Response text"
            mock_response.choices[0].message.tool_calls = None
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await openai_client.complete(
                system="System",
                messages=[{"role": "user", "content": "Hi"}]
            )

            assert result["stop_reason"] == "end_turn"
            assert len(result["content"]) == 1

    @pytest.mark.asyncio
    async def test_complete_with_tool_calls(self, openai_client):
        """Test complete with tool calls."""
        with patch.object(openai_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = None
            mock_tool_call = MagicMock()
            mock_tool_call.id = "call_1"
            mock_tool_call.function.name = "Read"
            mock_tool_call.function.arguments = '{"file_path": "/test.txt"}'
            mock_response.choices[0].message.tool_calls = [mock_tool_call]
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await openai_client.complete(
                system="System",
                messages=[{"role": "user", "content": "Read test"}],
                tools=[{"name": "Read", "description": "Read file", "input_schema": {}}]
            )

            assert result["stop_reason"] == "tool_calls"

    @pytest.mark.asyncio
    async def test_stream_with_mock(self, openai_client):
        """Test streaming with mocked client."""
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

            texts = []
            async for chunk in openai_client.stream(
                system="System",
                messages=[{"role": "user", "content": "Hi"}]
            ):
                if chunk.get("type") == "text_delta":
                    texts.append(chunk["text"])

            assert len(texts) == 2


class TestAnthropicClient:
    """Tests for Anthropic client."""

    @pytest.fixture
    def anthropic_client(self):
        """Create an Anthropic client for testing."""
        from src.utils.llm import AnthropicClient
        return AnthropicClient(
            api_key="test-key",
            model="claude-sonnet-4-6"
        )

    def test_client_creation(self, anthropic_client):
        """Test client creation."""
        assert anthropic_client.model == "claude-sonnet-4-6"

    @pytest.mark.asyncio
    async def test_complete_with_mock(self, anthropic_client):
        """Test complete with mocked client."""
        with patch.object(anthropic_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.content = [MagicMock(type="text", text="Response")]
            mock_response.stop_reason = "end_turn"
            mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
            mock_client.messages.create = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await anthropic_client.complete(
                system="System",
                messages=[{"role": "user", "content": "Hi"}]
            )

            assert result["stop_reason"] == "end_turn"

    @pytest.mark.asyncio
    async def test_complete_with_tool_use(self, anthropic_client):
        """Test complete with tool use."""
        with patch.object(anthropic_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
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

            result = await anthropic_client.complete(
                system="System",
                messages=[{"role": "user", "content": "Read test"}],
                tools=[{"name": "Read", "description": "Read file", "input_schema": {}}]
            )

            assert result["stop_reason"] == "tool_use"


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
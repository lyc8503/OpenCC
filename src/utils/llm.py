"""
LLM client abstraction.
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator
import os
import json
import sys

# Global debug flag
DEBUG = os.environ.get("OPEN_AGENT_DEBUG", "").lower() in ("1", "true", "yes")


def log_debug(*args, **kwargs):
    """Print debug message if DEBUG is enabled."""
    if DEBUG:
        print("[DEBUG]", *args, **kwargs, file=sys.stderr)


def log_api_call(direction: str, data: dict):
    """Log API call details."""
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"[API {direction}]", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)

    # Pretty print the data
    if isinstance(data, dict):
        for key, value in data.items():
            if key == "tools" and isinstance(value, list):
                # Just list tool names
                print(f"  {key}: [{len(value)} tools: {', '.join(t.get('function', {}).get('name', t.get('name', 'unknown')) for t in value[:5])}{'...' if len(value) > 5 else ''}]", file=sys.stderr)
            elif key == "messages" and isinstance(value, list):
                # Summarize messages
                print(f"  {key}: [{len(value)} messages]", file=sys.stderr)
                for i, msg in enumerate(value[-3:]):  # Last 3 messages
                    role = msg.get("role", "unknown")
                    content = msg.get("content", "")
                    if isinstance(content, str):
                        preview = content[:100] + "..." if len(content) > 100 else content
                        print(f"    [{i}] {role}: {preview}", file=sys.stderr)
                    elif isinstance(content, list):
                        # Content blocks
                        types = [b.get("type", "unknown") for b in content]
                        print(f"    [{i}] {role}: {types}", file=sys.stderr)
                    else:
                        print(f"    [{i}] {role}: {type(content).__name__}", file=sys.stderr)
            elif key == "content" and isinstance(value, list):
                # Response content
                print(f"  {key}:", file=sys.stderr)
                for block in value:
                    block_type = block.get("type", "unknown")
                    if block_type == "text":
                        text = block.get("text", "")
                        preview = text[:100] + "..." if len(text) > 100 else text
                        print(f"    [text]: {preview}", file=sys.stderr)
                    elif block_type == "tool_use":
                        print(f"    [tool_use]: {block.get('name')}({json.dumps(block.get('input', {}), ensure_ascii=False)[:200]})", file=sys.stderr)
                    else:
                        print(f"    [{block_type}]: ...", file=sys.stderr)
            else:
                print(f"  {key}: {value}", file=sys.stderr)
    else:
        print(f"  {data}", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def complete(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> dict:
        """Make a completion request."""
        pass

    @abstractmethod
    async def stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> AsyncIterator[dict]:
        """Stream a completion request."""
        pass


class AnthropicClient(LLMClient):
    """Client for Anthropic's Claude API."""

    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-6"):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
        return self._client

    async def complete(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> dict:
        client = self._get_client()

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages
        }

        if tools:
            kwargs["tools"] = tools

        # Log request
        log_api_call("REQUEST", {
            "model": self.model,
            "provider": "anthropic",
            "messages": messages,
            "tools": tools
        })

        response = await client.messages.create(**kwargs)

        result = {
            "content": [
                {"type": b.type, "text": b.text} if b.type == "text"
                else {"type": b.type, "id": b.id, "name": b.name, "input": b.input}
                for b in response.content
            ],
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }

        # Log response
        log_api_call("RESPONSE", {
            "model": self.model,
            "stop_reason": result["stop_reason"],
            "usage": result["usage"],
            "content": result["content"]
        })

        return result

    async def stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> AsyncIterator[dict]:
        client = self._get_client()

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages
        }

        if tools:
            kwargs["tools"] = tools

        log_api_call("REQUEST (STREAM)", {
            "model": self.model,
            "provider": "anthropic",
            "messages": messages,
            "tools": tools
        })

        async with client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    delta = event.delta
                    if hasattr(delta, "type") and delta.type == "text_delta":
                        yield {"type": "text_delta", "text": delta.text}
                elif event.type == "content_block_start":
                    block = event.content_block
                    if block.type == "tool_use":
                        yield {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": getattr(block, "input", {})
                        }

        # Get final message
        final = await stream.get_final_message()
        for block in final.content:
            if block.type == "tool_use":
                yield {
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                }


class OpenAIClient(LLMClient):
    """Client for OpenAI-compatible APIs."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.base_url = base_url or os.environ.get("OPENAI_BASE_URL")
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    async def complete(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> dict:
        client = self._get_client()

        # Convert messages to OpenAI format
        formatted_messages = [{"role": "system", "content": system}]

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content")

            # Handle string content directly
            if isinstance(content, str):
                formatted_messages.append({"role": role, "content": content})
                continue

            # Handle list of content blocks
            if isinstance(content, list):
                text_parts = []
                tool_calls_to_add = []
                tool_results_to_add = []

                for block in content:
                    block_type = block.get("type")

                    if block_type == "text":
                        text_parts.append(block.get("text", ""))

                    elif block_type == "tool_use":
                        # Add assistant message with tool_calls
                        tool_calls_to_add.append({
                            "id": block.get("id"),
                            "type": "function",
                            "function": {
                                "name": block.get("name"),
                                "arguments": json.dumps(block.get("input", {}), ensure_ascii=False)
                            }
                        })

                    elif block_type == "tool_result":
                        # Add tool result message
                        result_content = block.get("content", "")
                        if isinstance(result_content, list):
                            result_content = result_content[0].get("text", "") if result_content else ""
                        tool_results_to_add.append({
                            "role": "tool",
                            "tool_call_id": block.get("tool_use_id"),
                            "content": str(result_content)
                        })

                # Add text content if any
                if text_parts:
                    formatted_messages.append({"role": role, "content": "\n".join(text_parts)})

                # Add tool_calls if any (as assistant message)
                if tool_calls_to_add:
                    formatted_messages.append({
                        "role": "assistant",
                        "content": None,
                        "tool_calls": tool_calls_to_add
                    })

                # Add tool results
                formatted_messages.extend(tool_results_to_add)

        # Build tools list
        openai_tools = None
        if tools:
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": t["input_schema"]
                    }
                }
                for t in tools
            ]

        # Log request
        log_api_call("REQUEST", {
            "model": self.model,
            "provider": "openai",
            "base_url": self.base_url,
            "messages": formatted_messages,
            "tools": openai_tools
        })

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": formatted_messages
        }

        if openai_tools:
            kwargs["tools"] = openai_tools

        response = await client.chat.completions.create(**kwargs)

        message = response.choices[0].message
        content = []

        if message.content:
            content.append({"type": "text", "text": message.content})

        if message.tool_calls:
            for tc in message.tool_calls:
                content.append({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.function.name,
                    "input": json.loads(tc.function.arguments)
                })

        result = {
            "content": content,
            "stop_reason": "tool_calls" if message.tool_calls else "end_turn"
        }

        # Log response
        log_api_call("RESPONSE", {
            "model": self.model,
            "stop_reason": result["stop_reason"],
            "content": result["content"]
        })

        return result

    async def stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> AsyncIterator[dict]:
        client = self._get_client()

        formatted_messages = [{"role": "system", "content": system}]
        formatted_messages.extend(messages)

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": formatted_messages,
            "stream": True
        }

        if tools:
            kwargs["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": t["input_schema"]
                    }
                }
                for t in tools
            ]

        current_tool = None
        current_args = ""

        async for chunk in await client.chat.completions.create(**kwargs):
            delta = chunk.choices[0].delta

            if delta.content:
                yield {"type": "text_delta", "text": delta.content}

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.id:
                        # New tool call
                        if current_tool:
                            yield {
                                "type": "tool_use",
                                "id": current_tool["id"],
                                "name": current_tool["name"],
                                "input": json.loads(current_args)
                            }
                        current_tool = {"id": tc.id, "name": tc.function.name if tc.function else None}
                        current_args = ""

                    if tc.function and tc.function.arguments:
                        current_args += tc.function.arguments

        if current_tool:
            yield {
                "type": "tool_use",
                "id": current_tool["id"],
                "name": current_tool["name"],
                "input": json.loads(current_args) if current_args else {}
            }


def create_llm_client(
    provider: str = "anthropic",
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None
) -> LLMClient:
    """Create an LLM client based on provider."""
    if provider == "anthropic":
        return AnthropicClient(api_key=api_key, model=model or "claude-sonnet-4-6")
    elif provider == "openai":
        return OpenAIClient(api_key=api_key, base_url=base_url, model=model or "gpt-4o")
    else:
        raise ValueError(f"Unknown provider: {provider}")
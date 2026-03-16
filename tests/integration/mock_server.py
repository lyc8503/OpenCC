"""
Mock LLM server for integration testing.
"""

import json
import asyncio
from aiohttp import web
from typing import Callable, Any


class MockLLMServer:
    """Mock LLM API server for testing."""

    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.app = web.Application()
        self.runner = None
        self.site = None
        self.request_log: list[dict] = []
        self.response_handlers: dict[str, Callable] = {}

    async def start(self):
        """Start the mock server."""
        self.app.router.add_post("/v1/chat/completions", self._handle_chat)
        self.app.router.add_post("/v1/messages", self._handle_messages)

        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, self.host, self.port)
        await self.site.start()

    async def stop(self):
        """Stop the mock server."""
        if self.runner:
            await self.runner.cleanup()

    def set_response_handler(self, endpoint: str, handler: Callable):
        """Set a custom response handler for an endpoint."""
        self.response_handlers[endpoint] = handler

    def get_requests(self) -> list[dict]:
        """Get all logged requests."""
        return self.request_log

    def clear_requests(self):
        """Clear request log."""
        self.request_log.clear()

    async def _handle_chat(self, request: web.Request) -> web.Response:
        """Handle OpenAI-style chat completion request."""
        body = await request.json()
        self.request_log.append({
            "endpoint": "chat/completions",
            "body": body
        })

        if "chat/completions" in self.response_handlers:
            return await self.response_handlers["chat/completions"](body)

        # Default response
        return web.json_response({
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Test response"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5
            }
        })

    async def _handle_messages(self, request: web.Request) -> web.Response:
        """Handle Anthropic-style messages request."""
        body = await request.json()
        self.request_log.append({
            "endpoint": "messages",
            "body": body
        })

        if "messages" in self.response_handlers:
            return await self.response_handlers["messages"](body)

        # Default response
        return web.json_response({
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "text",
                "text": "Test response"
            }],
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 10,
                "output_tokens": 5
            }
        })


class MockStreamingServer:
    """Mock server with streaming support."""

    def __init__(self):
        self.chunks: list[dict] = []

    def set_chunks(self, chunks: list[dict]):
        """Set chunks to stream."""
        self.chunks = chunks

    async def stream_response(self, request: web.Request) -> web.StreamResponse:
        """Stream a response."""
        response = web.StreamResponse()
        response.content_type = "text/event-stream"
        await response.prepare(request)

        for chunk in self.chunks:
            data = f"data: {json.dumps(chunk)}\n\n"
            await response.write(data.encode())

        await response.write(b"data: [DONE]\n\n")
        return response


def create_tool_response(tool_name: str, tool_result: str) -> dict:
    """Create a tool use response."""
    return {
        "id": "msg_tool",
        "type": "message",
        "role": "assistant",
        "content": [{
            "type": "tool_use",
            "id": "toolu_test",
            "name": tool_name,
            "input": {}
        }],
        "stop_reason": "tool_use"
    }


def create_text_response(text: str) -> dict:
    """Create a text response."""
    return {
        "id": "msg_text",
        "type": "message",
        "role": "assistant",
        "content": [{
            "type": "text",
            "text": text
        }],
        "stop_reason": "end_turn"
    }


# pytest fixtures
import pytest


@pytest.fixture
async def mock_server():
    """Create and start a mock server for tests."""
    server = MockLLMServer()
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def mock_server_url(mock_server):
    """Get the mock server URL."""
    return f"http://{mock_server.host}:{mock_server.port}"
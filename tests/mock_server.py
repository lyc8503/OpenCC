"""
Mock Anthropic API Server for end-to-end testing.

Provides a real HTTP server that simulates the Anthropic API,
allowing both src agent and Claude CLI to make actual HTTP requests.
"""

import json
import threading
import time
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Callable
from contextlib import contextmanager
from urllib.parse import urlparse


class MockAnthropicHandler(BaseHTTPRequestHandler):
    """Handler for mock Anthropic API requests."""

    # Class-level response generator
    response_generator: Callable = None
    # Class-level server instance for request recording
    server_instance: "MockAnthropicServer" = None

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path).path
        if parsed_path == "/v1/models":
            # Return list of available models
            response = {
                "data": [
                    {"id": "claude-sonnet-4-6", "object": "model"},
                    {"id": "claude-opus-4-6", "object": "model"},
                    {"id": "claude-haiku-4-5", "object": "model"}
                ]
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle POST requests."""
        parsed_path = urlparse(self.path).path
        if parsed_path == "/v1/messages":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request = json.loads(body)

            # Record the request
            if MockAnthropicHandler.server_instance:
                MockAnthropicHandler.server_instance.record_request(request)

            response = self._generate_response(request)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def _generate_response(self, request: dict) -> dict:
        """Generate a mock response based on the request."""
        # Access class-level attribute directly to avoid binding issues
        generator = MockAnthropicHandler.response_generator
        if generator:
            return generator(request)

        # Default response
        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": "Default response"}],
            "model": request.get("model", "claude-sonnet-4-6"),
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 10, "output_tokens": 20}
        }


class MockAnthropicServer:
    """Mock Anthropic API server for testing."""

    def __init__(self, port: int = 18765):
        self.port = port
        self.server: HTTPServer = None
        self.thread: threading.Thread = None
        self._recorded_requests: list[dict] = []

    def set_response_generator(self, generator: Callable):
        """Set custom response generator."""
        MockAnthropicHandler.response_generator = generator

    def start(self):
        """Start the mock server."""
        MockAnthropicHandler.server_instance = self
        self.server = HTTPServer(("localhost", self.port), MockAnthropicHandler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.daemon = True
        self.thread.start()
        time.sleep(0.1)  # Wait for server to start

    def stop(self):
        """Stop the mock server."""
        if self.server:
            self.server.shutdown()
            self.server = None

    def get_base_url(self) -> str:
        """Get the base URL for the mock server."""
        return f"http://localhost:{self.port}"

    def record_request(self, request: dict):
        """Record a request for later inspection."""
        self._recorded_requests.append(request)

    def get_recorded_requests(self) -> list[dict]:
        """Get all recorded requests."""
        return self._recorded_requests

    def clear_recorded_requests(self):
        """Clear recorded requests."""
        self._recorded_requests = []

    def get_first_request(self) -> dict | None:
        """Get the first recorded request, if any."""
        return self._recorded_requests[0] if self._recorded_requests else None


# =============================================================================
# Response Generators
# =============================================================================

def create_text_response(text: str, model: str = "claude-sonnet-4-6") -> dict:
    """Create a text response."""
    return {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "type": "message",
        "role": "assistant",
        "content": [{"type": "text", "text": text}],
        "model": model,
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 100, "output_tokens": 200}
    }


def create_tool_use_response(
    tool_name: str,
    tool_input: dict,
    tool_id: str = None,
    model: str = "claude-sonnet-4-6"
) -> dict:
    """Create a tool use response."""
    return {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "type": "message",
        "role": "assistant",
        "content": [{
            "type": "tool_use",
            "id": tool_id or f"call_{uuid.uuid4().hex[:8]}",
            "name": tool_name,
            "input": tool_input
        }],
        "model": model,
        "stop_reason": "tool_use",
        "usage": {"input_tokens": 100, "output_tokens": 200}
    }


class ResponseSequence:
    """A sequence of responses to return in order."""

    def __init__(self, responses: list[dict]):
        self.responses = responses
        self.index = 0

    def __call__(self, request: dict) -> dict:
        """Return the next response in sequence."""
        if self.index < len(self.responses):
            response = self.responses[self.index]
            self.index += 1
            return response
        # Default to a simple completion
        return create_text_response("Done.")

    def reset(self):
        """Reset the sequence."""
        self.index = 0


@contextmanager
def mock_anthropic_server(port: int = 18765):
    """Context manager for mock server."""
    server = MockAnthropicServer(port=port)
    server.start()
    try:
        yield server
    finally:
        server.stop()
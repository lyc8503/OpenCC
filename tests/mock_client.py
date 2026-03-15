"""
Mock LLM Client for testing.
"""

from typing import AsyncIterator


class MockLLMClient:
    """Mock LLM client for testing with predefined responses."""

    def __init__(self, responses: list[dict] | None = None):
        self.responses = responses or []
        self.call_count = 0

    async def complete(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> dict:
        """Return mock response."""
        if self.call_count < len(self.responses):
            response = self.responses[self.call_count]
            self.call_count += 1
            return response
        return {"content": [{"type": "text", "text": "No more responses"}]}

    async def stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> AsyncIterator[dict]:
        """Stream mock response."""
        for response in self.responses:
            if "content" in response:
                for block in response["content"]:
                    if block.get("type") == "text":
                        yield {"type": "text_delta", "text": block.get("text", "")}
                    elif block.get("type") == "tool_use":
                        yield {
                            "type": "tool_use",
                            "id": block.get("id", "mock_id"),
                            "name": block.get("name", ""),
                            "input": block.get("input", {})
                        }
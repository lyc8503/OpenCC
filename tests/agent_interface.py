"""
Agent interface for unified testing.

Both implementations make real HTTP requests to the same mock server.
"""

import json
import subprocess
import tempfile
import os
import asyncio
from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass
import httpx


@dataclass
class AgentResponse:
    """Response from an agent."""
    text: str
    tool_calls: list[dict]
    success: bool
    error: str | None = None


class AgentInterface(ABC):
    """Abstract interface for agent implementations."""

    @abstractmethod
    async def run(self, prompt: str) -> AgentResponse:
        """Run the agent with a prompt."""
        pass

    @abstractmethod
    def setup(self):
        """Set up the agent environment."""
        pass

    @abstractmethod
    def teardown(self):
        """Clean up the agent environment."""
        pass


class SrcAgent(AgentInterface):
    """
    Our agent implementation that makes HTTP requests to mock server.

    This agent sends real HTTP requests, just like Claude CLI.
    """

    def __init__(self, base_url: str, model: str = "claude-sonnet-4-6"):
        self.base_url = base_url
        self.model = model
        self.temp_dir: Path | None = None
        self._messages: list[dict] = []

    def setup(self):
        """Set up working directory."""
        self.temp_dir = Path(tempfile.mkdtemp())

    def teardown(self):
        """Clean up temporary files."""
        if self.temp_dir and self.temp_dir.exists():
            import shutil
            shutil.rmtree(self.temp_dir)

    async def run(self, prompt: str) -> AgentResponse:
        """Run agent by making HTTP requests to the mock server."""
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))

        from src.core.agent import Agent
        from src.core.types import AgentConfig

        config = AgentConfig(
            model=self.model,
            permission_mode="bypassPermissions",
            working_directory=str(self.temp_dir) if self.temp_dir else "."
        )

        # Create agent with custom LLM client pointing to mock server
        client = MockServerClient(base_url=self.base_url, model=self.model)

        agent = Agent(config=config, llm_client=client)

        try:
            result = await agent.run(prompt)

            # Extract tool calls from messages
            tool_calls = []
            for msg in agent.state.messages:
                if hasattr(msg, 'content') and isinstance(msg.content, list):
                    for block in msg.content:
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_calls.append({
                                "name": block.tool_name,
                                "input": block.tool_input,
                                "id": block.tool_use_id
                            })

            return AgentResponse(
                text=result,
                tool_calls=tool_calls,
                success=True
            )
        except Exception as e:
            return AgentResponse(
                text="",
                tool_calls=[],
                success=False,
                error=str(e)
            )


class MockServerClient:
    """LLM client that connects to mock server."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model
        self.api_key = "mock-api-key"

    async def complete(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ) -> dict:
        """Make HTTP request to mock server."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/messages",
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": messages,
                    "tools": tools
                },
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                timeout=60.0
            )
            response.raise_for_status()
            return response.json()

    async def stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        max_tokens: int = 8192
    ):
        """Stream not implemented for mock server."""
        # Just yield the complete response as one chunk
        result = await self.complete(system, messages, tools, max_tokens)
        for block in result.get("content", []):
            if block.get("type") == "text":
                yield {"type": "text_delta", "text": block.get("text", "")}
            elif block.get("type") == "tool_use":
                yield {
                    "type": "tool_use",
                    "id": block.get("id"),
                    "name": block.get("name"),
                    "input": block.get("input", {})
                }


class ClaudeCliAgent(AgentInterface):
    """
    Claude CLI implementation that makes HTTP requests to mock server.

    Uses ANTHROPIC_BASE_URL to redirect requests to our mock server.
    """

    def __init__(self, base_url: str, model: str = "sonnet"):
        self.base_url = base_url
        self.model = model
        self.temp_dir: Path | None = None

    def setup(self):
        """Set up environment for Claude CLI."""
        self.temp_dir = Path(tempfile.mkdtemp())

    def teardown(self):
        """Clean up temporary files."""
        if self.temp_dir and self.temp_dir.exists():
            import shutil
            shutil.rmtree(self.temp_dir)

    async def run(self, prompt: str) -> AgentResponse:
        """Run Claude CLI with prompt, redirecting to mock server."""
        cmd = [
            "claude",
            "--print",
            "--model", self.model,
            "--dangerously-skip-permissions",
            "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,TaskCreate,TaskGet,TaskUpdate,TaskList,CronCreate,CronList,CronDelete,Skill,TodoWrite,TaskOutput,TaskStop,EnterPlanMode,ExitPlanMode,EnterWorktree,ExitWorktree,WebFetch,WebSearch,AskUserQuestion,NotebookEdit,ToolSearch,Agent",
        ]

        env = os.environ.copy()
        env["CLAUDE_CODE_ENTRYPOINT"] = "sdk-cli"
        # Redirect to mock server
        env["ANTHROPIC_BASE_URL"] = self.base_url
        env["ANTHROPIC_API_KEY"] = "mock-api-key"

        try:
            result = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                env=env,
                timeout=120,
                cwd=str(self.temp_dir) if self.temp_dir else None
            )

            if result.returncode != 0:
                return AgentResponse(
                    text="",
                    tool_calls=[],
                    success=False,
                    error=result.stderr or f"Exit code: {result.returncode}\nStdout: {result.stdout}"
                )

            return AgentResponse(
                text=result.stdout,
                tool_calls=[],  # CLI doesn't expose tool calls
                success=True
            )

        except subprocess.TimeoutExpired:
            return AgentResponse(
                text="",
                tool_calls=[],
                success=False,
                error="Command timed out"
            )
        except FileNotFoundError:
            return AgentResponse(
                text="",
                tool_calls=[],
                success=False,
                error="Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
            )
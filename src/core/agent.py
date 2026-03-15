"""
Core Agent implementation.
"""

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable
import asyncio
import json
import uuid
import sys
from .types import (
    AgentConfig, Message, ContentBlock, ToolResult, AgentInfo, Task
)
from .tool import registry, Tool
from .system_prompt import build_system_prompt
from ..utils.llm import LLMClient, create_llm_client
from ..memory.manager import MemoryManager
from ..utils.permission import PermissionManager


def log_tool_call(tool_name: str, tool_input: dict, result: ToolResult | None = None, error: str | None = None):
    """Log tool execution."""
    print(f"\n{'='*60}", file=sys.stderr)
    if result is None:
        # Tool call start
        print(f"[TOOL CALL] {tool_name}", file=sys.stderr)
        print(f"  Input: {json.dumps(tool_input, ensure_ascii=False, indent=2)[:500]}", file=sys.stderr)
    else:
        # Tool call result
        status = "ERROR" if result.is_error else "OK"
        print(f"[TOOL RESULT] {tool_name} - {status}", file=sys.stderr)
        output = result.output[:500] + "..." if len(result.output) > 500 else result.output
        print(f"  Output: {output}", file=sys.stderr)
        if result.metadata:
            print(f"  Metadata: {result.metadata}", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)


@dataclass
class AgentState:
    """State maintained during agent execution."""
    messages: list[Message] = field(default_factory=list)
    tasks: dict[str, Task] = field(default_factory=dict)
    agents: dict[str, AgentInfo] = field(default_factory=dict)
    iteration: int = 0
    tool_call_count: int = 0


class Agent:
    """
    Main agent class that orchestrates tool calls and LLM interactions.
    """

    def __init__(
        self,
        config: AgentConfig | None = None,
        llm_client: LLMClient | None = None,
        tools: list[type[Tool]] | None = None,
        permission_callback: Callable[[str, dict], bool] | None = None
    ):
        self.config = config or AgentConfig()

        # Create LLM client with config settings if not provided
        if llm_client is None:
            self.llm = create_llm_client(
                provider=self.config.provider,
                model=self.config.model,
                api_key=self.config.api_key,
                base_url=self.config.base_url
            )
        else:
            self.llm = llm_client

        self.state = AgentState()
        self.memory = MemoryManager(self.config.working_directory)
        self.permission = PermissionManager(
            mode=self.config.permission_mode,
            callback=permission_callback
        )

        # Register tools
        if tools:
            for tool_class in tools:
                registry.register(tool_class)

    async def run(self, prompt: str, system_prompt: str | None = None) -> str:
        """
        Run the agent with the given prompt.

        Returns the final response text.
        """
        # Initialize state
        self.state = AgentState()

        # Build system prompt
        system = system_prompt or self.config.system_prompt or self._build_system_prompt()

        # Add user message
        self.state.messages.append(Message.user(prompt))

        # Main loop
        while self.state.iteration < self.config.max_iterations:
            self.state.iteration += 1

            # Call LLM
            response = await self._call_llm(system)

            # Check if we're done (no tool calls)
            if not self._has_tool_calls(response):
                return self._extract_text(response)

            # Process tool calls
            tool_results = await self._process_tool_calls(response)

            # Add assistant message and tool results to state
            self.state.messages.append(Message.assistant(response))
            for result in tool_results:
                self.state.messages.append(result)

        return "Max iterations reached without completion."

    async def run_stream(self, prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
        """
        Run the agent and stream the response.
        """
        self.state = AgentState()
        system = system_prompt or self.config.system_prompt or self._build_system_prompt()
        self.state.messages.append(Message.user(prompt))

        while self.state.iteration < self.config.max_iterations:
            self.state.iteration += 1

            # Stream LLM response
            response_blocks = []
            current_text = ""

            schemas = registry.get_all_schemas(self.config.tools)
            tools = [s.to_api_format() for s in schemas] if schemas else None

            async for chunk in self.llm.stream(
                system=system,
                messages=[m.to_api_format() for m in self.state.messages],
                tools=tools,
                max_tokens=self.config.max_tokens
            ):
                if chunk.get("type") == "text_delta":
                    delta = chunk.get("text", "")
                    current_text += delta
                    yield delta
                elif chunk.get("type") == "tool_use":
                    response_blocks.append(ContentBlock(
                        type="tool_use",
                        tool_use_id=chunk.get("id", str(uuid.uuid4())),
                        tool_name=chunk.get("name"),
                        tool_input=chunk.get("input", {})
                    ))

            if current_text:
                response_blocks.insert(0, ContentBlock(type="text", text=current_text))

            if not any(b.type == "tool_use" for b in response_blocks):
                return

            # Process tool calls
            if any(b.type == "tool_use" for b in response_blocks):
                tool_results = await self._process_tool_calls(response_blocks)
                self.state.messages.append(Message.assistant(response_blocks))
                for result in tool_results:
                    self.state.messages.append(result)

    async def _call_llm(self, system: str) -> list[ContentBlock]:
        """Make a call to the LLM."""
        schemas = registry.get_all_schemas(self.config.tools)
        tools = [s.to_api_format() for s in schemas] if schemas else None

        response = await self.llm.complete(
            system=system,
            messages=[m.to_api_format() for m in self.state.messages],
            tools=tools,
            max_tokens=self.config.max_tokens
        )

        blocks = []
        for block in response.get("content", []):
            if block.get("type") == "text":
                blocks.append(ContentBlock(type="text", text=block.get("text", "")))
            elif block.get("type") == "tool_use":
                blocks.append(ContentBlock(
                    type="tool_use",
                    tool_use_id=block.get("id", str(uuid.uuid4())),
                    tool_name=block.get("name"),
                    tool_input=block.get("input", {})
                ))

        return blocks

    def _has_tool_calls(self, blocks: list[ContentBlock]) -> bool:
        """Check if response contains tool calls."""
        return any(b.type == "tool_use" for b in blocks)

    def _extract_text(self, blocks: list[ContentBlock]) -> str:
        """Extract text content from blocks."""
        texts = []
        for block in blocks:
            if block.type == "text" and block.text:
                texts.append(block.text)
        return "\n".join(texts)

    async def _process_tool_calls(self, blocks: list[ContentBlock]) -> list[Message]:
        """Process all tool calls in the response."""
        results = []

        tool_calls = [b for b in blocks if b.type == "tool_use"]

        # Execute tools in parallel where possible
        tasks = []
        for block in tool_calls:
            tasks.append(self._execute_tool(block.tool_name, block.tool_input, block.tool_use_id))

        tool_results = await asyncio.gather(*tasks, return_exceptions=True)

        for block, result in zip(tool_calls, tool_results):
            if isinstance(result, Exception):
                results.append(Message.tool_result(
                    block.tool_use_id,
                    f"Error: {result}",
                    is_error=True
                ))
            else:
                results.append(result)

        return results

    async def _execute_tool(self, tool_name: str, tool_input: dict, tool_use_id: str) -> Message:
        """Execute a single tool and return the result message."""
        self.state.tool_call_count += 1

        # Log tool call
        log_tool_call(tool_name, tool_input)

        # Check permission
        if not await self.permission.check(tool_name, tool_input):
            result = ToolResult(output="Permission denied by user.", is_error=True)
            log_tool_call(tool_name, tool_input, result)
            return Message.tool_result(
                tool_use_id,
                "Permission denied by user.",
                is_error=True
            )

        # Get tool
        tool = registry.get_tool(tool_name, self.config.working_directory)
        if not tool:
            result = ToolResult(output=f"Unknown tool: {tool_name}", is_error=True)
            log_tool_call(tool_name, tool_input, result)
            return Message.tool_result(
                tool_use_id,
                f"Unknown tool: {tool_name}",
                is_error=True
            )

        # Validate input
        errors = tool.validate_input(tool_input)
        if errors:
            result = ToolResult(output=f"Validation errors: {errors}", is_error=True)
            log_tool_call(tool_name, tool_input, result)
            return Message.tool_result(
                tool_use_id,
                f"Validation errors: {errors}",
                is_error=True
            )

        # Execute
        try:
            result = await tool.execute(**tool_input)
            log_tool_call(tool_name, tool_input, result)
            return Message.tool_result(tool_use_id, result.output, result.is_error)
        except Exception as e:
            result = ToolResult(output=f"Error: {e}", is_error=True)
            log_tool_call(tool_name, tool_input, result)
            return Message.tool_result(tool_use_id, f"Error: {e}", is_error=True)

    def _build_system_prompt(self) -> str:
        """Build the default system prompt matching Claude CLI format."""
        return build_system_prompt(self.config.working_directory)

    def add_task(self, subject: str, description: str, **kwargs) -> Task:
        """Add a task to track."""
        task_id = str(len(self.state.tasks) + 1)
        task = Task(id=task_id, subject=subject, description=description, **kwargs)
        self.state.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Task | None:
        """Get a task by ID."""
        return self.state.tasks.get(task_id)

    def update_task(self, task_id: str, **kwargs) -> Task | None:
        """Update a task."""
        task = self.state.tasks.get(task_id)
        if task:
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)
        return task

    def list_tasks(self) -> list[Task]:
        """List all tasks."""
        return list(self.state.tasks.values())
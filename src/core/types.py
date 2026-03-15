"""
Core type definitions for the Open Agent framework.
"""

from dataclasses import dataclass, field
from typing import Any, Literal
from enum import Enum
import uuid
import time


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


@dataclass
class ContentBlock:
    """Represents a content block in a message."""
    type: Literal["text", "tool_use", "tool_result", "image"]
    text: str | None = None
    tool_use_id: str | None = None
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_result_content: str | list[Any] | None = None
    is_error: bool = False
    source: dict[str, Any] | None = None  # For images

    def to_api_format(self) -> dict[str, Any]:
        """Convert to API format for LLM calls."""
        if self.type == "text":
            return {"type": "text", "text": self.text}
        elif self.type == "tool_use":
            return {
                "type": "tool_use",
                "id": self.tool_use_id,
                "name": self.tool_name,
                "input": self.tool_input or {}
            }
        elif self.type == "tool_result":
            content = self.tool_result_content
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            return {
                "type": "tool_result",
                "tool_use_id": self.tool_use_id,
                "content": content,
                "is_error": self.is_error
            }
        elif self.type == "image":
            return {
                "type": "image",
                "source": self.source
            }
        return {}


@dataclass
class Message:
    """Represents a conversation message."""
    role: Role
    content: str | list[ContentBlock]
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: float = field(default_factory=time.time)

    def to_api_format(self) -> dict[str, Any]:
        """Convert to API format for LLM calls."""
        if isinstance(self.content, str):
            return {"role": self.role.value, "content": self.content}
        else:
            return {
                "role": self.role.value,
                "content": [block.to_api_format() for block in self.content]
            }

    @classmethod
    def user(cls, content: str) -> "Message":
        """Create a user message."""
        return cls(role=Role.USER, content=content)

    @classmethod
    def assistant(cls, content: str | list[ContentBlock]) -> "Message":
        """Create an assistant message."""
        return cls(role=Role.ASSISTANT, content=content)

    @classmethod
    def system(cls, content: str) -> "Message":
        """Create a system message."""
        return cls(role=Role.SYSTEM, content=content)

    @classmethod
    def tool_result(cls, tool_use_id: str, result: str, is_error: bool = False) -> "Message":
        """Create a tool result message."""
        block = ContentBlock(
            type="tool_result",
            tool_use_id=tool_use_id,
            tool_result_content=result,
            is_error=is_error
        )
        return cls(role=Role.TOOL, content=[block])


@dataclass
class ToolResult:
    """Result from a tool execution."""
    output: str
    is_error: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentConfig:
    """Configuration for an agent."""
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 8192
    temperature: float = 1.0
    system_prompt: str | None = None
    tools: list[str] | None = None  # None means all tools
    permission_mode: Literal["default", "acceptEdits", "bypassPermissions", "plan", "auto"] = "default"
    working_directory: str = "."
    max_iterations: int = 50
    # LLM provider settings
    provider: Literal["anthropic", "openai"] = "anthropic"
    api_key: str | None = None
    base_url: str | None = None


@dataclass
class Task:
    """Represents a task in the task management system."""
    id: str
    subject: str
    description: str
    status: Literal["pending", "in_progress", "completed", "deleted"] = "pending"
    owner: str | None = None
    blocked_by: list[str] = field(default_factory=list)
    blocks: list[str] = field(default_factory=list)
    active_form: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


@dataclass
class Memory:
    """Represents a memory entry."""
    name: str
    description: str
    type: Literal["user", "feedback", "project", "reference"]
    content: str
    created_at: float = field(default_factory=time.time)


@dataclass
class CronJob:
    """Represents a scheduled cron job."""
    id: str
    cron: str
    prompt: str
    recurring: bool = True
    created_at: float = field(default_factory=time.time)


@dataclass
class AgentInfo:
    """Information about a subagent."""
    id: str
    type: str
    description: str
    prompt: str
    status: Literal["running", "completed", "failed"] = "running"
    result: str | None = None
    created_at: float = field(default_factory=time.time)
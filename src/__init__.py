"""
Open Agent - An open-source agent framework inspired by Claude Code.
"""

__version__ = "0.1.0"

from .core.agent import Agent
from .core.tool import Tool, ToolResult
from .core.types import Message, ContentBlock

__all__ = ["Agent", "Tool", "ToolResult", "Message", "ContentBlock"]
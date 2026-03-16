"""
Base Tool class and tool registry.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable
import json
import re
from .types import ToolResult


@dataclass
class ToolSchema:
    """JSON Schema definition for a tool."""
    name: str
    description: str
    parameters: dict[str, Any]

    def to_api_format(self) -> dict[str, Any]:
        """Convert to API format for LLM tool definitions."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters
        }


class Tool(ABC):
    """Base class for all tools."""

    name: str = ""
    description: str = ""
    parameters: dict[str, Any] = {}
    requires_permission: bool = False
    is_deferred: bool = False

    def __init__(self, working_directory: str = "."):
        self.working_directory = working_directory

    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool with given parameters."""
        pass

    def get_schema(self) -> ToolSchema:
        """Get the JSON schema for this tool."""
        return ToolSchema(
            name=self.name,
            description=self.description,
            parameters=self.parameters
        )

    def validate_input(self, input_data: dict[str, Any]) -> list[str]:
        """Validate input against the schema. Returns list of errors."""
        errors = []
        required = self.parameters.get("required", [])
        properties = self.parameters.get("properties", {})

        for field in required:
            if field not in input_data:
                errors.append(f"Missing required field: {field}")

        for key, value in input_data.items():
            if key not in properties:
                if not self.parameters.get("additionalProperties", True):
                    errors.append(f"Unknown field: {key}")
                continue

            prop = properties[key]
            prop_type = prop.get("type")

            if prop_type and not self._check_type(value, prop_type):
                errors.append(f"Field {key} has wrong type. Expected {prop_type}")

            if "enum" in prop and value not in prop["enum"]:
                errors.append(f"Field {key} must be one of {prop['enum']}")

            # Check array constraints
            if prop_type == "array" and isinstance(value, list):
                if "minItems" in prop and len(value) < prop["minItems"]:
                    errors.append(f"Field {key} must have at least {prop['minItems']} items")
                if "maxItems" in prop and len(value) > prop["maxItems"]:
                    errors.append(f"Field {key} must have at most {prop['maxItems']} items")

        return errors

    def _check_type(self, value: Any, expected_type: str | list) -> bool:
        """Check if value matches expected type."""
        type_map = {
            "string": str,
            "number": (int, float),
            "integer": int,
            "boolean": bool,
            "array": list,
            "object": dict,
            "null": type(None)
        }

        if isinstance(expected_type, list):
            return any(self._check_type(value, t) for t in expected_type)

        expected = type_map.get(expected_type)
        if expected is None:
            return True

        if expected_type == "number":
            return isinstance(value, (int, float)) and not isinstance(value, bool)
        if expected_type == "integer":
            return isinstance(value, int) and not isinstance(value, bool)

        return isinstance(value, expected)


class ToolRegistry:
    """Registry for all available tools."""

    def __init__(self):
        self._tools: dict[str, type[Tool]] = {}
        self._instances: dict[str, Tool] = {}

    def register(self, tool_class: type[Tool]) -> type[Tool]:
        """Register a tool class."""
        instance = tool_class()
        self._tools[instance.name] = tool_class
        return tool_class

    def get_tool(self, name: str, working_directory: str = ".") -> Tool | None:
        """Get a tool instance by name."""
        if name not in self._tools:
            return None

        cache_key = f"{name}:{working_directory}"
        if cache_key not in self._instances:
            self._instances[cache_key] = self._tools[name](working_directory=working_directory)

        return self._instances[cache_key]

    def get_all_schemas(self, tool_names: list[str] | None = None) -> list[ToolSchema]:
        """Get schemas for all or specified tools."""
        if tool_names is None:
            tool_names = list(self._tools.keys())

        schemas = []
        for name in tool_names:
            if name in self._tools:
                instance = self._tools[name]()
                schemas.append(instance.get_schema())

        return schemas

    def list_tools(self) -> list[str]:
        """List all registered tool names."""
        return list(self._tools.keys())


# Global registry
registry = ToolRegistry()


def tool(cls: type[Tool]) -> type[Tool]:
    """Decorator to register a tool."""
    return registry.register(cls)
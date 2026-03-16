"""
Unit tests for tool registry and base tool class.
"""

import pytest
from src.core.tool import Tool, ToolRegistry, ToolSchema, registry
from src.core.types import ToolResult


class MockTool(Tool):
    """Mock tool for testing."""

    name = "MockTool"
    description = "A mock tool for testing"
    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "input": {"type": "string"}
        },
        "required": ["input"]
    }

    async def execute(self, input: str) -> ToolResult:
        """Execute the mock tool."""
        return ToolResult(output=f"Processed: {input}")


class TestToolSchema:
    """Tests for ToolSchema."""

    def test_schema_creation(self):
        """Test creating a tool schema."""
        schema = ToolSchema(
            name="TestTool",
            description="Test description",
            parameters={"type": "object"}
        )
        assert schema.name == "TestTool"

    def test_api_format(self):
        """Test schema API format."""
        schema = ToolSchema(
            name="Test",
            description="Test tool",
            parameters={"type": "object", "properties": {}}
        )
        api = schema.to_api_format()
        assert api["name"] == "Test"
        assert "input_schema" in api


class TestTool:
    """Tests for base Tool class."""

    def test_tool_name(self):
        """Test tool name attribute."""
        tool = MockTool()
        assert tool.name == "MockTool"

    def test_get_schema(self):
        """Test getting tool schema."""
        tool = MockTool()
        schema = tool.get_schema()
        assert schema.name == "MockTool"
        assert schema.description == "A mock tool for testing"

    def test_validate_input_success(self):
        """Test input validation success."""
        tool = MockTool()
        errors = tool.validate_input({"input": "test"})
        assert errors == []

    def test_validate_input_missing_required(self):
        """Test input validation with missing required field."""
        tool = MockTool()
        errors = tool.validate_input({})
        assert len(errors) == 1
        assert "Missing required field: input" in errors[0]

    def test_validate_input_wrong_type(self):
        """Test input validation with wrong type."""
        tool = MockTool()
        errors = tool.validate_input({"input": 123})
        assert len(errors) == 1
        assert "wrong type" in errors[0]

    @pytest.mark.asyncio
    async def test_execute(self):
        """Test tool execution."""
        tool = MockTool()
        result = await tool.execute(input="hello")
        assert result.output == "Processed: hello"
        assert result.is_error is False


class TestToolRegistry:
    """Tests for ToolRegistry."""

    def test_registry_singleton(self):
        """Test that registry is a singleton-like global."""
        assert registry is not None

    def test_register_tool(self):
        """Test registering a tool."""
        test_registry = ToolRegistry()

        @test_registry.register
        class RegisteredTool(Tool):
            name = "RegisteredTool"
            description = "Test"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        assert "RegisteredTool" in test_registry._tools

    def test_get_tool(self):
        """Test getting a tool instance."""
        test_registry = ToolRegistry()

        @test_registry.register
        class GetTestTool(Tool):
            name = "GetTestTool"
            description = "Test"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        tool = test_registry.get_tool("GetTestTool", ".")
        assert tool is not None
        assert tool.name == "GetTestTool"

    def test_get_nonexistent_tool(self):
        """Test getting a non-existent tool."""
        test_registry = ToolRegistry()
        tool = test_registry.get_tool("NonExistentTool", ".")
        assert tool is None

    def test_get_all_schemas(self):
        """Test getting all tool schemas."""
        test_registry = ToolRegistry()

        @test_registry.register
        class SchemaTool1(Tool):
            name = "SchemaTool1"
            description = "Test 1"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        @test_registry.register
        class SchemaTool2(Tool):
            name = "SchemaTool2"
            description = "Test 2"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        schemas = test_registry.get_all_schemas()
        names = [s.name for s in schemas]
        assert "SchemaTool1" in names
        assert "SchemaTool2" in names

    def test_list_tools(self):
        """Test listing all tools."""
        test_registry = ToolRegistry()

        @test_registry.register
        class ListTool(Tool):
            name = "ListTool"
            description = "Test"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        tools = test_registry.list_tools()
        assert "ListTool" in tools

    def test_tool_instance_caching(self):
        """Test that tool instances are cached."""
        test_registry = ToolRegistry()

        @test_registry.register
        class CachedTool(Tool):
            name = "CachedTool"
            description = "Test"
            parameters = {"type": "object"}

            async def execute(self):
                return ToolResult(output="ok")

        tool1 = test_registry.get_tool("CachedTool", "/tmp")
        tool2 = test_registry.get_tool("CachedTool", "/tmp")
        assert tool1 is tool2


class TestToolTypeChecking:
    """Tests for tool type checking."""

    def test_check_type_string(self):
        """Test type checking for strings."""
        tool = MockTool()
        assert tool._check_type("hello", "string") is True
        assert tool._check_type(123, "string") is False

    def test_check_type_integer(self):
        """Test type checking for integers."""
        tool = MockTool()
        assert tool._check_type(123, "integer") is True
        assert tool._check_type(123.5, "integer") is False
        assert tool._check_type(True, "integer") is False

    def test_check_type_number(self):
        """Test type checking for numbers."""
        tool = MockTool()
        assert tool._check_type(123, "number") is True
        assert tool._check_type(123.5, "number") is True
        assert tool._check_type("123", "number") is False

    def test_check_type_boolean(self):
        """Test type checking for booleans."""
        tool = MockTool()
        assert tool._check_type(True, "boolean") is True
        assert tool._check_type(False, "boolean") is True
        assert tool._check_type(1, "boolean") is False

    def test_check_type_array(self):
        """Test type checking for arrays."""
        tool = MockTool()
        assert tool._check_type([1, 2, 3], "array") is True
        assert tool._check_type({"a": 1}, "array") is False

    def test_check_type_object(self):
        """Test type checking for objects."""
        tool = MockTool()
        assert tool._check_type({"a": 1}, "object") is True
        assert tool._check_type([1, 2], "object") is False

    def test_check_type_list(self):
        """Test type checking with list of types."""
        tool = MockTool()
        assert tool._check_type("hello", ["string", "number"]) is True
        assert tool._check_type(123, ["string", "number"]) is True
        assert tool._check_type([], ["string", "number"]) is False

    def test_check_type_null(self):
        """Test type checking for null."""
        tool = MockTool()
        assert tool._check_type(None, "null") is True
        assert tool._check_type("", "null") is False
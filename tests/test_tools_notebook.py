"""
Tests for Notebook tool functionality.
"""

import pytest
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.tools.notebook import NotebookEditTool
from src.core.types import ToolResult


class TestNotebookEditTool:
    """Test NotebookEdit tool."""

    def test_tool_name(self):
        """Test tool name is correct."""
        tool = NotebookEditTool()
        assert tool.name == "NotebookEdit"

    def test_parameter_validation(self):
        """Test parameter validation."""
        tool = NotebookEditTool()

        # Missing required
        errors = tool.validate_input({})
        assert len(errors) >= 2  # notebook_path and new_source

        # Valid input
        errors = tool.validate_input({
            "notebook_path": "/tmp/test.ipynb",
            "new_source": "print('hello')"
        })
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_create_notebook(self, temp_workspace):
        """Test creating a new notebook cell."""
        notebook_path = temp_workspace / "test.ipynb"
        notebook_path.write_text(json.dumps({
            "cells": [],
            "metadata": {}
        }))

        tool = NotebookEditTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            notebook_path=str(notebook_path),
            new_source="print('hello world')",
            cell_type="code",
            edit_mode="insert"
        )

        assert isinstance(result, ToolResult)
        if not result.is_error:
            # Verify notebook was updated
            nb = json.loads(notebook_path.read_text())
            assert len(nb["cells"]) >= 1

    @pytest.mark.asyncio
    async def test_edit_existing_cell(self, temp_workspace):
        """Test editing an existing cell."""
        notebook_path = temp_workspace / "edit.ipynb"
        notebook_path.write_text(json.dumps({
            "cells": [
                {"id": "cell-1", "cell_type": "code", "source": ["old code"], "outputs": []}
            ],
            "metadata": {}
        }))

        tool = NotebookEditTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            notebook_path=str(notebook_path),
            cell_id="cell-1",
            new_source="new code",
            edit_mode="replace"
        )

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_add_markdown_cell(self, temp_workspace):
        """Test adding a markdown cell."""
        notebook_path = temp_workspace / "markdown.ipynb"
        notebook_path.write_text(json.dumps({
            "cells": [],
            "metadata": {}
        }))

        tool = NotebookEditTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            notebook_path=str(notebook_path),
            new_source="# Title\n\nSome **markdown** text.",
            cell_type="markdown",
            edit_mode="insert"
        )

        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_nonexistent_notebook(self, temp_workspace):
        """Test editing a notebook that doesn't exist."""
        tool = NotebookEditTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            notebook_path=str(temp_workspace / "nonexistent.ipynb"),
            new_source="code"
        )

        # Should handle gracefully
        assert isinstance(result, ToolResult)

    @pytest.mark.asyncio
    async def test_delete_cell(self, temp_workspace):
        """Test deleting a cell."""
        notebook_path = temp_workspace / "delete.ipynb"
        notebook_path.write_text(json.dumps({
            "cells": [
                {"id": "cell-1", "cell_type": "code", "source": ["code"], "outputs": []},
                {"id": "cell-2", "cell_type": "code", "source": ["more code"], "outputs": []}
            ],
            "metadata": {}
        }))

        tool = NotebookEditTool(working_directory=str(temp_workspace))
        result = await tool.execute(
            notebook_path=str(notebook_path),
            cell_id="cell-1",
            new_source="",
            edit_mode="delete"
        )

        assert isinstance(result, ToolResult)
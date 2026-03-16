"""
NotebookEdit tool - Edit Jupyter notebooks.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path
import json


@registry.register
class NotebookEditTool(Tool):
    """Edit Jupyter notebook cells."""

    name = "NotebookEdit"
    description = """Completely replaces the contents of a specific cell in a Jupyter notebook.

Jupyter notebooks are interactive documents that combine code, text, and visualizations.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "notebook_path": {
                "description": "The absolute path to the Jupyter notebook file",
                "type": "string"
            },
            "cell_id": {
                "description": "The ID of the cell to edit",
                "type": "string"
            },
            "cell_type": {
                "description": "The type of the cell",
                "type": "string",
                "enum": ["code", "markdown"],
                "default": "code"
            },
            "new_source": {
                "description": "The new source for the cell (not required for delete mode)",
                "type": "string"
            },
            "edit_mode": {
                "description": "The type of edit",
                "type": "string",
                "enum": ["replace", "insert", "delete"],
                "default": "replace"
            }
        },
        "required": ["notebook_path"],
        "additionalProperties": False
    }

    async def execute(
        self,
        notebook_path: str,
        new_source: str | None = None,
        cell_id: str | None = None,
        cell_type: str = "code",
        edit_mode: str = "replace"
    ) -> ToolResult:
        """Edit a notebook cell."""
        path = Path(notebook_path)

        if not path.is_absolute():
            return ToolResult(
                output="Error: notebook_path must be an absolute path",
                is_error=True
            )

        if not path.exists():
            return ToolResult(
                output=f"Error: Notebook does not exist: {notebook_path}",
                is_error=True
            )

        try:
            with open(path, "r") as f:
                nb = json.load(f)

            cells = nb.get("cells", [])

            # Helper to find cell by ID or numeric index
            def find_cell_index(cell_id: str) -> int:
                """Find cell by real ID or numeric index (1-based)."""
                # Try as numeric index first (1-based)
                if cell_id.isdigit():
                    idx = int(cell_id) - 1
                    if 0 <= idx < len(cells):
                        return idx
                # Try as real cell ID
                for i, c in enumerate(cells):
                    if c.get("id") == cell_id:
                        return i
                return -1

            if edit_mode == "delete" and cell_id:
                # Delete cell
                idx = find_cell_index(cell_id)
                if idx >= 0:
                    del cells[idx]
                else:
                    return ToolResult(
                        output=f"Error: Cell with id '{cell_id}' not found",
                        is_error=True
                    )

            elif edit_mode == "insert":
                # Insert new cell
                new_cell = {
                    "id": cell_id or f"cell_{len(cells)}",
                    "cell_type": cell_type,
                    "source": new_source.split("\n"),
                    "metadata": {},
                    "outputs": [] if cell_type == "code" else None
                }

                # Find insert position
                if cell_id:
                    idx = find_cell_index(cell_id)
                    if idx >= 0:
                        cells.insert(idx, new_cell)
                    else:
                        cells.append(new_cell)
                else:
                    cells.append(new_cell)

            else:  # replace
                if not cell_id:
                    return ToolResult(
                        output="Error: cell_id required for replace mode",
                        is_error=True
                    )

                idx = find_cell_index(cell_id)
                if idx < 0:
                    return ToolResult(
                        output=f"Error: Cell with id '{cell_id}' not found",
                        is_error=True
                    )

                cells[idx]["cell_type"] = cell_type
                cells[idx]["source"] = new_source.split("\n")
                if cell_type == "markdown":
                    cells[idx].pop("outputs", None)
                elif cell_type == "code" and "outputs" not in cells[idx]:
                    cells[idx]["outputs"] = []

            # Ensure cells list is updated in notebook
            nb["cells"] = cells

            # Write back
            with open(path, "w") as f:
                json.dump(nb, f, indent=1)

            return ToolResult(
                output=f"Successfully edited notebook {notebook_path}",
                metadata={"notebook_path": notebook_path, "cell_id": cell_id}
            )

        except Exception as e:
            return ToolResult(output=f"Error editing notebook: {e}", is_error=True)
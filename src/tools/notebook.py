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
                "description": "The new source for the cell",
                "type": "string"
            },
            "edit_mode": {
                "description": "The type of edit",
                "type": "string",
                "enum": ["replace", "insert", "delete"],
                "default": "replace"
            }
        },
        "required": ["notebook_path", "new_source"],
        "additionalProperties": False
    }

    async def execute(
        self,
        notebook_path: str,
        new_source: str,
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

            if edit_mode == "delete" and cell_id:
                # Delete cell
                nb["cells"] = [c for c in cells if c.get("id") != cell_id]

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
                    for i, c in enumerate(cells):
                        if c.get("id") == cell_id:
                            cells.insert(i, new_cell)
                            break
                else:
                    cells.append(new_cell)

                nb["cells"] = cells

            else:  # replace
                if not cell_id:
                    return ToolResult(
                        output="Error: cell_id required for replace mode",
                        is_error=True
                    )

                found = False
                for c in cells:
                    if c.get("id") == cell_id:
                        c["cell_type"] = cell_type
                        c["source"] = new_source.split("\n")
                        if cell_type == "markdown":
                            c.pop("outputs", None)
                        elif cell_type == "code" and "outputs" not in c:
                            c["outputs"] = []
                        found = True
                        break

                if not found:
                    return ToolResult(
                        output=f"Error: Cell with id '{cell_id}' not found",
                        is_error=True
                    )

            # Write back
            with open(path, "w") as f:
                json.dump(nb, f, indent=1)

            return ToolResult(
                output=f"Successfully edited notebook {notebook_path}",
                metadata={"notebook_path": notebook_path, "cell_id": cell_id}
            )

        except Exception as e:
            return ToolResult(output=f"Error editing notebook: {e}", is_error=True)
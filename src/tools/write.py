"""
Write tool - Write files to the filesystem.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from .edit import EditTool
from pathlib import Path


@registry.register
class WriteTool(Tool):
    """Writes a file to the local filesystem."""

    name = "Write"
    description = """Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents.
- Prefer the Edit tool for modifying existing files — it only sends the diff.
- Only use this tool to create new files or for complete rewrites.
"""
    requires_permission = True

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "file_path": {
                "description": "The absolute path to the file to write (must be absolute)",
                "type": "string"
            },
            "content": {
                "description": "The content to write to the file",
                "type": "string"
            }
        },
        "required": ["file_path", "content"],
        "additionalProperties": False
    }

    async def execute(self, file_path: str, content: str) -> ToolResult:
        """Write the file."""
        path = Path(file_path)

        if not path.is_absolute():
            return ToolResult(
                output="Error: file_path must be an absolute path",
                is_error=True
            )

        # Check if existing file was read first (using shared state with EditTool)
        if path.exists() and not EditTool.is_read(file_path):
            return ToolResult(
                output="Error: Must read file first before writing to it. Use the Read tool.",
                is_error=True
            )

        try:
            # Ensure parent directory exists
            path.parent.mkdir(parents=True, exist_ok=True)

            # Write the file
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

            return ToolResult(
                output=f"Successfully wrote {len(content)} characters to {file_path}",
                metadata={"file_path": file_path, "size": len(content)}
            )

        except Exception as e:
            return ToolResult(output=f"Error writing file: {e}", is_error=True)
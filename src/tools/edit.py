"""
Edit tool - Perform string replacements in files.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path


@registry.register
class EditTool(Tool):
    """Performs exact string replacements in files."""

    name = "Edit"
    description = """Performs exact string replacements in files.

Usage:
- You must use the Read tool at least once before editing.
- Preserve exact indentation (tabs/spaces) when editing.
- The edit will FAIL if old_string is not unique in the file.
- Use replace_all to change every instance of old_string.
"""
    requires_permission = True

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "file_path": {
                "description": "The absolute path to the file to modify",
                "type": "string"
            },
            "old_string": {
                "description": "The text to replace",
                "type": "string"
            },
            "new_string": {
                "description": "The text to replace it with",
                "type": "string"
            },
            "replace_all": {
                "description": "Replace all occurrences (default false)",
                "type": "boolean",
                "default": False
            }
        },
        "required": ["file_path", "old_string", "new_string"],
        "additionalProperties": False
    }

    def __init__(self, working_directory: str = "."):
        super().__init__(working_directory)
        self._read_files: set[str] = set()

    def mark_as_read(self, file_path: str):
        """Mark a file as having been read."""
        self._read_files.add(file_path)

    async def execute(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False
    ) -> ToolResult:
        """Edit the file."""
        path = Path(file_path)

        if not path.is_absolute():
            return ToolResult(
                output="Error: file_path must be an absolute path",
                is_error=True
            )

        if not path.exists():
            return ToolResult(
                output=f"Error: File does not exist: {file_path}",
                is_error=True
            )

        # Check if file was read first
        if file_path not in self._read_files:
            return ToolResult(
                output="Error: Must read file first before editing. Use the Read tool.",
                is_error=True
            )

        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            if old_string not in content:
                return ToolResult(
                    output="Error: old_string not found in file",
                    is_error=True
                )

            if old_string == new_string:
                return ToolResult(
                    output="Error: old_string and new_string are identical",
                    is_error=True
                )

            # Check uniqueness if not replace_all
            if not replace_all:
                count = content.count(old_string)
                if count > 1:
                    return ToolResult(
                        output=f"Error: old_string appears {count} times in file. Use replace_all=true or provide a more specific string.",
                        is_error=True
                    )

            # Perform replacement
            if replace_all:
                new_content = content.replace(old_string, new_string)
                replacements = content.count(old_string)
            else:
                new_content = content.replace(old_string, new_string, 1)
                replacements = 1

            # Write back
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)

            return ToolResult(
                output=f"Successfully replaced {replacements} occurrence(s) in {file_path}",
                metadata={"file_path": file_path, "replacements": replacements}
            )

        except Exception as e:
            return ToolResult(output=f"Error editing file: {e}", is_error=True)
"""
Glob tool - Fast file pattern matching.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path
import fnmatch
import os


@registry.register
class GlobTool(Tool):
    """Fast file pattern matching tool."""

    name = "Glob"
    description = """Fast file pattern matching tool that works with any codebase size.

- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "pattern": {
                "description": "The glob pattern to match files against",
                "type": "string"
            },
            "path": {
                "description": "The directory to search in. Defaults to current working directory.",
                "type": "string"
            }
        },
        "required": ["pattern"],
        "additionalProperties": False
    }

    async def execute(self, pattern: str, path: str | None = None) -> ToolResult:
        """Find files matching the pattern."""
        search_dir = Path(path) if path else Path(self.working_directory)

        if not search_dir.exists():
            return ToolResult(
                output=f"Error: Directory does not exist: {search_dir}",
                is_error=True
            )

        try:
            # Get all matching files with modification times
            matches = []
            for file_path in search_dir.rglob("*"):
                if file_path.is_file():
                    # Check if matches pattern
                    rel_path = file_path.relative_to(search_dir)
                    if fnmatch.fnmatch(str(rel_path), pattern) or fnmatch.fnmatch(file_path.name, pattern):
                        mtime = file_path.stat().st_mtime
                        matches.append((mtime, str(file_path)))

            # Sort by modification time (newest first)
            matches.sort(key=lambda x: x[0], reverse=True)

            if not matches:
                return ToolResult(output="No files found matching pattern.")

            result = "\n".join(m[1] for m in matches)
            return ToolResult(
                output=result,
                metadata={"count": len(matches), "files": [m[1] for m in matches]}
            )

        except Exception as e:
            return ToolResult(output=f"Error during glob: {e}", is_error=True)
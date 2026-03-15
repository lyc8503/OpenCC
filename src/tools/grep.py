"""
Grep tool - Search file contents using regex.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path
import re
import fnmatch


@registry.register
class GrepTool(Tool):
    """A powerful search tool built on ripgrep-style regex."""

    name = "Grep"
    description = """A powerful search tool built on ripgrep.

Usage:
- ALWAYS use Grep for search tasks. NEVER invoke grep or rg as a Bash command.
- Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths, "count" shows match counts
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "pattern": {
                "description": "The regular expression pattern to search for",
                "type": "string"
            },
            "path": {
                "description": "File or directory to search in. Defaults to current working directory.",
                "type": "string"
            },
            "glob": {
                "description": "Glob pattern to filter files (e.g., '*.js', '*.{ts,tsx}')",
                "type": "string"
            },
            "output_mode": {
                "description": "Output mode: 'content', 'files_with_matches', or 'count'",
                "type": "string",
                "enum": ["content", "files_with_matches", "count"],
                "default": "files_with_matches"
            },
            "-B": {
                "description": "Number of lines to show before each match",
                "type": "number"
            },
            "-A": {
                "description": "Number of lines to show after each match",
                "type": "number"
            },
            "-C": {
                "description": "Alias for context.",
                "type": "number"
            },
            "context": {
                "description": "Number of lines to show before and after each match (rg -C). Requires output_mode: \"content\", ignored otherwise.",
                "type": "number"
            },
            "-i": {
                "description": "Case insensitive search",
                "type": "boolean"
            },
            "type": {
                "description": "File type to search (js, py, rust, go, java, etc.)",
                "type": "string"
            },
            "head_limit": {
                "description": "Limit output to first N lines/entries, equivalent to \"| head -N\". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 0 (unlimited).",
                "type": "number"
            },
            "offset": {
                "description": "Skip first N lines/entries before applying head_limit, equivalent to \"| tail -n +N | head -N\". Works across all output modes. Defaults to 0.",
                "type": "number"
            },
            "-n": {
                "description": "Show line numbers in output (rg -n). Requires output_mode: \"content\", ignored otherwise. Defaults to true.",
                "type": "boolean"
            },
            "multiline": {
                "description": "Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.",
                "type": "boolean"
            }
        },
        "required": ["pattern"],
        "additionalProperties": False
    }

    # Map file types to glob patterns
    TYPE_GLOBS = {
        "js": "*.js",
        "ts": "*.ts",
        "tsx": "*.tsx",
        "py": "*.py",
        "rust": "*.rs",
        "go": "*.go",
        "java": "*.java",
        "c": "*.c",
        "cpp": "*.cpp",
        "h": "*.h",
        "hpp": "*.hpp",
        "rs": "*.rs",
        "rb": "*.rb",
        "php": "*.php",
        "swift": "*.swift",
        "kt": "*.kt",
        "scala": "*.scala",
        "json": "*.json",
        "yaml": "*.yaml",
        "yml": "*.yml",
        "md": "*.md",
        "html": "*.html",
        "css": "*.css",
        "scss": "*.scss",
    }

    async def execute(
        self,
        pattern: str,
        path: str | None = None,
        glob: str | None = None,
        output_mode: str = "files_with_matches",
        **kwargs
    ) -> ToolResult:
        """Search for pattern in files."""
        search_dir = Path(path) if path else Path(self.working_directory)

        if not search_dir.exists():
            return ToolResult(
                output=f"Error: Path does not exist: {search_dir}",
                is_error=True
            )

        # Build regex
        flags = re.MULTILINE
        if kwargs.get("-i"):
            flags |= re.IGNORECASE
        if kwargs.get("multiline"):
            flags |= re.DOTALL

        try:
            regex = re.compile(pattern, flags)
        except re.error as e:
            return ToolResult(output=f"Invalid regex: {e}", is_error=True)

        # Determine file filter
        file_glob = glob
        if not file_glob and kwargs.get("type"):
            file_glob = self.TYPE_GLOBS.get(kwargs["type"])

        # Search
        context_before = kwargs.get("-B") or kwargs.get("-C") or kwargs.get("context") or 0
        context_after = kwargs.get("-A") or kwargs.get("-C") or kwargs.get("context") or 0
        head_limit = kwargs.get("head_limit", 0)

        results = []
        file_matches: dict[str, list] = {}

        def should_search_file(file_path: Path) -> bool:
            if not file_glob:
                return True
            return fnmatch.fnmatch(file_path.name, file_glob)

        try:
            if search_dir.is_file():
                files = [search_dir]
            else:
                files = search_dir.rglob("*")

            for file_path in files:
                if not file_path.is_file():
                    continue
                if not should_search_file(file_path):
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        lines = f.readlines()

                    matches_in_file = []

                    for i, line in enumerate(lines):
                        if regex.search(line):
                            matches_in_file.append((i, line.rstrip()))

                    if matches_in_file:
                        if output_mode == "files_with_matches":
                            results.append(str(file_path))
                        elif output_mode == "count":
                            results.append(f"{file_path}: {len(matches_in_file)}")
                        else:  # content
                            for line_num, line in matches_in_file:
                                # Add context
                                context_output = []
                                for ctx_i in range(max(0, line_num - context_before), line_num):
                                    context_output.append(f"{file_path}:{ctx_i + 1}:{lines[ctx_i].rstrip()}")

                                context_output.append(f"{file_path}:{line_num + 1}:{line}")

                                for ctx_i in range(line_num + 1, min(len(lines), line_num + 1 + context_after)):
                                    context_output.append(f"{file_path}:{ctx_i + 1}:{lines[ctx_i].rstrip()}")

                                results.append("\n".join(context_output))

                        file_matches[str(file_path)] = matches_in_file

                        if head_limit and len(results) >= head_limit:
                            break

                except Exception:
                    continue

                if head_limit and len(results) >= head_limit:
                    break

            if not results:
                return ToolResult(output="No matches found.")

            if head_limit:
                output = "\n".join(str(r) for r in results[:head_limit])
            else:
                output = "\n".join(str(r) for r in results)
            return ToolResult(
                output=output,
                metadata={"count": len(results), "files_matched": len(file_matches)}
            )

        except Exception as e:
            return ToolResult(output=f"Error during search: {e}", is_error=True)
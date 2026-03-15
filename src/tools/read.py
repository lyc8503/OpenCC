"""
Read tool - Read files from the filesystem.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from .edit import EditTool
from pathlib import Path
import base64
import mimetypes


@registry.register
class ReadTool(Tool):
    """Reads a file from the local filesystem."""

    name = "Read"
    description = """Reads a file from the local filesystem. You can access any file directly by using this tool.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit for long files
- Results are returned using cat -n format, with line numbers starting at 1
- This tool can read images (PNG, JPG, etc) and present them visually
- This tool can read PDF files with the pages parameter
- This tool can read Jupyter notebooks (.ipynb files)
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "file_path": {
                "description": "The absolute path to the file to read",
                "type": "string"
            },
            "offset": {
                "description": "The line number to start reading from",
                "type": "number"
            },
            "limit": {
                "description": "The number of lines to read",
                "type": "number"
            },
            "pages": {
                "description": "Page range for PDF files (e.g., '1-5')",
                "type": "string"
            }
        },
        "required": ["file_path"],
        "additionalProperties": False
    }

    MAX_LINES = 2000
    IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}

    async def execute(
        self,
        file_path: str,
        offset: int | None = None,
        limit: int | None = None,
        pages: str | None = None
    ) -> ToolResult:
        """Read the file."""
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

        if path.is_dir():
            return ToolResult(
                output=f"Error: {file_path} is a directory, not a file",
                is_error=True
            )

        # Handle different file types
        ext = path.suffix.lower()

        # Image files
        if ext in self.IMAGE_EXTENSIONS:
            return await self._read_image(path)

        # PDF files
        if ext == ".pdf":
            return await self._read_pdf(path, pages)

        # Jupyter notebooks
        if ext == ".ipynb":
            result = await self._read_notebook(path)
            EditTool.mark_as_read(file_path)
            return result

        # Text files
        result = await self._read_text(path, offset, limit)
        # Mark as read for EditTool
        EditTool.mark_as_read(file_path)
        return result

    async def _read_text(self, path: Path, offset: int | None, limit: int | None) -> ToolResult:
        """Read a text file."""
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            # Apply offset and limit
            start = (offset or 1) - 1  # Convert to 0-indexed
            end = start + (limit or self.MAX_LINES)

            lines = lines[start:end]

            # Format with line numbers
            output_lines = []
            for i, line in enumerate(lines, start=(offset or 1)):
                # cat -n format: line number, tab, content
                output_lines.append(f"{i:6}\t{line.rstrip()}")

            return ToolResult(output="\n".join(output_lines))

        except Exception as e:
            return ToolResult(output=f"Error reading file: {e}", is_error=True)

    async def _read_image(self, path: Path) -> ToolResult:
        """Read an image file."""
        try:
            with open(path, "rb") as f:
                data = f.read()

            mime_type = mimetypes.guess_type(str(path))[0] or "image/png"
            base64_data = base64.b64encode(data).decode()

            return ToolResult(
                output=f"[Image: {path.name}]",
                metadata={
                    "type": "image",
                    "mime_type": mime_type,
                    "base64": base64_data
                }
            )
        except Exception as e:
            return ToolResult(output=f"Error reading image: {e}", is_error=True)

    async def _read_pdf(self, path: Path, pages: str | None) -> ToolResult:
        """Read a PDF file."""
        try:
            # Try to use PyPDF2 or similar
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(str(path))

                if pages:
                    # Parse page range
                    page_nums = self._parse_page_range(pages, len(doc))
                else:
                    if len(doc) > 10:
                        return ToolResult(
                            output=f"PDF has {len(doc)} pages. Please specify pages parameter.",
                            is_error=True
                        )
                    page_nums = range(len(doc))

                text_parts = []
                for i in page_nums:
                    page = doc[i]
                    text_parts.append(f"--- Page {i + 1} ---\n{page.get_text()}")

                return ToolResult(output="\n\n".join(text_parts))

            except ImportError:
                return ToolResult(
                    output="PDF reading requires PyMuPDF (fitz). Install with: pip install pymupdf",
                    is_error=True
                )

        except Exception as e:
            return ToolResult(output=f"Error reading PDF: {e}", is_error=True)

    async def _read_notebook(self, path: Path) -> ToolResult:
        """Read a Jupyter notebook."""
        try:
            import json

            with open(path, "r") as f:
                nb = json.load(f)

            output_parts = []

            for i, cell in enumerate(nb.get("cells", [])):
                cell_type = cell.get("cell_type", "unknown")
                # Get real cell ID, fallback to index+1
                cell_id = cell.get("id", str(i + 1))

                if cell_type == "markdown":
                    source = "".join(cell.get("source", []))
                    output_parts.append(f"### Markdown Cell (id: {cell_id})\n{source}")

                elif cell_type == "code":
                    source = "".join(cell.get("source", []))
                    output_parts.append(f"### Code Cell (id: {cell_id})\n```\n{source}\n```")

                    # Include outputs
                    for output in cell.get("outputs", []):
                        if output.get("output_type") == "stream":
                            text = "".join(output.get("text", []))
                            output_parts.append(f"Output:\n{text}")
                        elif output.get("output_type") == "execute_result":
                            data = output.get("data", {})
                            if "text/plain" in data:
                                output_parts.append(f"Result: {data['text/plain']}")

            return ToolResult(output="\n\n".join(output_parts))

        except Exception as e:
            return ToolResult(output=f"Error reading notebook: {e}", is_error=True)

    def _parse_page_range(self, pages: str, max_pages: int) -> list[int]:
        """Parse a page range string like '1-5' or '1,3,5'."""
        result = []
        parts = pages.split(",")

        for part in parts:
            if "-" in part:
                start, end = map(int, part.split("-"))
                result.extend(range(start - 1, end))
            else:
                result.append(int(part) - 1)

        return [p for p in result if 0 <= p < max_pages]
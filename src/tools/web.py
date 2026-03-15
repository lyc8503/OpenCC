"""
Web tools - Fetch and search web content.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
import aiohttp
import json


@registry.register
class WebFetchTool(Tool):
    """Fetch content from a URL and process it."""

    name = "WebFetch"
    description = """Fetches content from a specified URL and processes it using an AI model.

IMPORTANT: This tool will fail for authenticated or private URLs.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "url": {
                "description": "The URL to fetch",
                "type": "string",
                "format": "uri"
            },
            "prompt": {
                "description": "The prompt to run on the fetched content",
                "type": "string"
            }
        },
        "required": ["url", "prompt"],
        "additionalProperties": False
    }

    async def execute(self, url: str, prompt: str) -> ToolResult:
        """Fetch URL and process content."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        return ToolResult(
                            output=f"HTTP error {response.status}",
                            is_error=True
                        )

                    content_type = response.headers.get("Content-Type", "")

                    if "application/json" in content_type:
                        data = await response.json()
                        content = json.dumps(data, indent=2)
                    else:
                        content = await response.text()

            # For now, just return the content with the prompt
            # In a full implementation, this would use an LLM to process
            return ToolResult(
                output=f"Content fetched from {url}\n\nPrompt: {prompt}\n\nContent preview:\n{content[:5000]}...",
                metadata={"url": url, "content_length": len(content)}
            )

        except aiohttp.ClientError as e:
            return ToolResult(output=f"Error fetching URL: {e}", is_error=True)
        except Exception as e:
            return ToolResult(output=f"Error: {e}", is_error=True)


@registry.register
class WebSearchTool(Tool):
    """Search the web for information."""

    name = "WebSearch"
    description = """Allows Claude to search the web and use the results to inform responses.

Use this tool for:
- Accessing information beyond Claude's knowledge cutoff
- Getting up-to-date information for current events or recent data
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "query": {
                "description": "The search query (min 2 characters)",
                "type": "string",
                "minLength": 2
            },
            "allowed_domains": {
                "description": "Only include results from these domains",
                "type": "array",
                "items": {"type": "string"}
            },
            "blocked_domains": {
                "description": "Never include results from these domains",
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["query"],
        "additionalProperties": False
    }

    async def execute(
        self,
        query: str,
        allowed_domains: list[str] | None = None,
        blocked_domains: list[str] | None = None
    ) -> ToolResult:
        """Perform web search."""
        try:
            # Try using DuckDuckGo or similar
            try:
                from duckduckgo_search import DDGS

                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=5))

                if not results:
                    return ToolResult(output="No search results found.")

                # Format results
                lines = [f"# Search results for: {query}", ""]
                for r in results:
                    title = r.get("title", "No title")
                    href = r.get("href", "")
                    body = r.get("body", "")

                    # Filter by domains
                    if allowed_domains:
                        if not any(d in href for d in allowed_domains):
                            continue
                    if blocked_domains:
                        if any(d in href for d in blocked_domains):
                            continue

                    lines.append(f"## [{title}]({href})")
                    lines.append(body)
                    lines.append("")

                return ToolResult(
                    output="\n".join(lines),
                    metadata={"query": query, "results_count": len(results)}
                )

            except ImportError:
                # Fallback: return a message about installing the library
                return ToolResult(
                    output=f"Web search requires duckduckgo-search. Install with: pip install duckduckgo-search\n\nQuery was: {query}",
                    is_error=True
                )

        except Exception as e:
            return ToolResult(output=f"Search error: {e}", is_error=True)
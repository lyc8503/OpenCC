"""
CLI entry point for Open Agent.
"""

import asyncio
import argparse
import sys
import os
from pathlib import Path

# Setup path for imports when running directly
if __name__ == "__main__":
    src_dir = Path(__file__).parent
    sys.path.insert(0, str(src_dir))

# Imports - use try/except to handle both direct run and package import
try:
    from .core.agent import Agent
    from .core.types import AgentConfig
    from . import tools  # Import to register all tools
except ImportError:
    from core.agent import Agent
    from core.types import AgentConfig
    import tools  # Import to register all tools


def parse_args():
    parser = argparse.ArgumentParser(
        description="Open Agent - An open-source agent framework",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "prompt",
        nargs="?",
        help="The prompt to send to the agent"
    )

    parser.add_argument(
        "-p", "--print",
        action="store_true",
        help="Print response and exit (non-interactive mode)"
    )

    parser.add_argument(
        "-d", "--directory",
        default=".",
        help="Working directory (default: current directory)"
    )

    parser.add_argument(
        "-m", "--model",
        default="claude-sonnet-4-6",
        help="Model to use (default: claude-sonnet-4-6)"
    )

    parser.add_argument(
        "--provider",
        default="anthropic",
        choices=["anthropic", "openai"],
        help="LLM provider (default: anthropic)"
    )

    parser.add_argument(
        "--api-key",
        help="API key (or set ANTHROPIC_API_KEY / OPENAI_API_KEY env var)"
    )

    parser.add_argument(
        "--base-url",
        help="API base URL (for custom endpoints)"
    )

    parser.add_argument(
        "--permission-mode",
        default="default",
        choices=["default", "acceptEdits", "bypassPermissions", "plan", "auto"],
        help="Permission mode (default: default)"
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=50,
        help="Maximum agent iterations (default: 50)"
    )

    parser.add_argument(
        "--list-tools",
        action="store_true",
        help="List all available tools"
    )

    return parser.parse_args()


def list_tools():
    """Print all available tools."""
    try:
        from .core.tool import registry
    except ImportError:
        from core.tool import registry

    print("Available Tools:")
    print("-" * 50)

    for name in sorted(registry.list_tools()):
        tool = registry.get_tool(name)
        if tool:
            schema = tool.get_schema()
            desc = schema.description[:100] if len(schema.description) > 100 else schema.description
            print(f"\n{name}:")
            print(f"  {desc}...")


async def run_agent(config: AgentConfig, prompt: str):
    """Run the agent with given config and prompt."""
    agent = Agent(config=config)

    try:
        result = await agent.run(prompt)
        print(result)
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    args = parse_args()

    # List tools mode
    if args.list_tools:
        list_tools()
        return

    # Need a prompt
    if not args.prompt:
        print("Error: Please provide a prompt.", file=sys.stderr)
        print("Usage: python cli.py 'your prompt here'")
        sys.exit(1)

    # Create config
    config = AgentConfig(
        model=args.model,
        working_directory=str(Path(args.directory).resolve()),
        permission_mode=args.permission_mode,
        max_iterations=args.max_iterations,
        provider=args.provider,
        api_key=args.api_key,
        base_url=args.base_url
    )

    # Run agent
    asyncio.run(run_agent(config, args.prompt))


if __name__ == "__main__":
    main()
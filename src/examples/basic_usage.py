"""
Example usage of Open Agent.
"""

import asyncio
from src import Agent
from src.core.types import AgentConfig


async def main():
    # Create agent configuration
    config = AgentConfig(
        model="claude-sonnet-4-6",
        working_directory=".",
        permission_mode="auto",  # Auto-approve safe tools
        max_iterations=20
    )

    # Create agent
    agent = Agent(config=config)

    # Run a simple task
    print("Running agent...")
    result = await agent.run("List all Python files in the current directory and tell me what they do.")

    print("\n--- Result ---")
    print(result)


async def streaming_example():
    """Example with streaming output."""
    config = AgentConfig(
        model="claude-sonnet-4-6",
        working_directory=".",
        permission_mode="auto"
    )

    agent = Agent(config=config)

    print("Streaming response...")
    async for chunk in agent.run_stream("What is the capital of France?"):
        print(chunk, end="", flush=True)

    print()


async def task_tracking_example():
    """Example with task tracking."""
    config = AgentConfig(
        model="claude-sonnet-4-6",
        working_directory="."
    )

    agent = Agent(config=config)

    # Create some tasks
    task1 = agent.add_task(
        subject="Read configuration file",
        description="Read and analyze the config.yaml file"
    )

    task2 = agent.add_task(
        subject="Update dependencies",
        description="Update package dependencies",
        blocked_by=[task1.id]  # This task waits for task1
    )

    # List tasks
    for task in agent.list_tasks():
        print(f"[{task.id}] {task.subject} - {task.status}")


if __name__ == "__main__":
    # Run basic example
    asyncio.run(main())

    # Uncomment to run other examples:
    # asyncio.run(streaming_example())
    # asyncio.run(task_tracking_example())
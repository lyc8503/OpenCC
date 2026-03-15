"""
Agent tool - Launch specialized sub-agents.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult, AgentConfig
from ..core.agent import Agent
from typing import Literal
import asyncio
import uuid


@registry.register
class AgentTool(Tool):
    """Launch a new agent to handle complex, multi-step tasks autonomously."""

    name = "Agent"
    description = """Launch a new agent to handle complex, multi-step tasks autonomously.

The Agent tool launches specialized agents (subprocesses) that autonomously handle complex tasks.
Each agent type has specific capabilities and tools available to it.

Available agent types:
- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.
- Explore: Fast agent specialized for exploring codebases.
- Plan: Software architect agent for designing implementation plans.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "description": {
                "description": "A short (3-5 word) description of the task",
                "type": "string"
            },
            "prompt": {
                "description": "The task for the agent to perform",
                "type": "string"
            },
            "subagent_type": {
                "description": "The type of specialized agent to use",
                "type": "string",
                "enum": ["general-purpose", "Explore", "Plan", "statusline-setup"]
            },
            "model": {
                "description": "Optional model override for this agent",
                "type": "string",
                "enum": ["sonnet", "opus", "haiku"]
            },
            "resume": {
                "description": "Optional agent ID to resume from",
                "type": "string"
            },
            "run_in_background": {
                "description": "Set to true to run this agent in the background",
                "type": "boolean"
            },
            "isolation": {
                "description": "Isolation mode. 'worktree' creates a temporary git worktree",
                "type": "string",
                "enum": ["worktree"]
            }
        },
        "required": ["description", "prompt"],
        "additionalProperties": False
    }

    # Model mapping
    MODEL_MAP = {
        "sonnet": "claude-sonnet-4-6",
        "opus": "claude-opus-4-6",
        "haiku": "claude-haiku-4-5-20251001"
    }

    # Agent type configurations
    AGENT_CONFIGS = {
        "general-purpose": {
            "tools": None,  # All tools
            "system_prompt": None
        },
        "Explore": {
            "tools": ["Read", "Glob", "Grep", "Bash", "WebFetch", "WebSearch"],
            "system_prompt": "You are an exploration agent. Quickly find files and search code to help understand the codebase."
        },
        "Plan": {
            "tools": ["Read", "Glob", "Grep", "Bash"],
            "system_prompt": "You are a planning agent. Analyze the codebase and create detailed implementation plans."
        },
        "statusline-setup": {
            "tools": ["Read", "Edit"],
            "system_prompt": "You are a status line setup agent. Configure the user's status line settings."
        }
    }

    def __init__(self, working_directory: str = "."):
        super().__init__(working_directory)
        self._agents: dict[str, Agent] = {}
        self._agent_tasks: dict[str, asyncio.Task] = {}
        self._agent_results: dict[str, str] = {}

    async def execute(
        self,
        description: str,
        prompt: str,
        subagent_type: str = "general-purpose",
        model: str | None = None,
        resume: str | None = None,
        run_in_background: bool = False,
        isolation: str | None = None
    ) -> ToolResult:
        """Launch and run the sub-agent."""

        agent_id = resume or str(uuid.uuid4())[:8]

        # Get agent config
        agent_config = self.AGENT_CONFIGS.get(subagent_type, self.AGENT_CONFIGS["general-purpose"])

        # Build config
        config = AgentConfig(
            model=self.MODEL_MAP.get(model, "claude-sonnet-4-6") if model else "claude-sonnet-4-6",
            tools=agent_config["tools"],
            system_prompt=agent_config["system_prompt"],
            working_directory=self.working_directory
        )

        # Handle isolation (worktree)
        working_dir = self.working_directory
        if isolation == "worktree":
            # Create worktree - simplified version
            import subprocess
            branch_name = f"agent-{agent_id}"
            worktree_path = f"{self.working_directory}/.agent-worktrees/{branch_name}"
            try:
                subprocess.run(
                    ["git", "worktree", "add", worktree_path, "-b", branch_name],
                    capture_output=True,
                    cwd=self.working_directory
                )
                working_dir = worktree_path
            except Exception:
                pass  # Fall back to main directory

        # Create agent
        agent = Agent(config=config)
        self._agents[agent_id] = agent

        async def run_agent():
            try:
                result = await agent.run(prompt)
                self._agent_results[agent_id] = result
                return result
            except Exception as e:
                self._agent_results[agent_id] = f"Error: {e}"
                raise

        if run_in_background:
            task = asyncio.create_task(run_agent())
            self._agent_tasks[agent_id] = task
            return ToolResult(
                output=f"Agent {agent_id} started in background.\nDescription: {description}",
                metadata={"agent_id": agent_id, "status": "running"}
            )
        else:
            result = await run_agent()
            return ToolResult(
                output=result,
                metadata={"agent_id": agent_id, "status": "completed"}
            )

    async def get_agent_result(self, agent_id: str) -> str:
        """Get result from a running or completed agent."""
        if agent_id in self._agent_results:
            return self._agent_results[agent_id]

        if agent_id in self._agent_tasks:
            task = self._agent_tasks[agent_id]
            if task.done():
                return self._agent_results.get(agent_id, "Agent completed but no result found")
            else:
                return "Agent still running..."

        return f"Unknown agent: {agent_id}"
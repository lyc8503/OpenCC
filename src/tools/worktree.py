"""
Worktree tools - Git worktree management.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult
from pathlib import Path
import subprocess
import uuid


class WorktreeManager:
    """Global worktree manager."""
    _instance = None
    worktrees: dict[str, dict] = {}
    current_worktree: str | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance


@registry.register
class EnterWorktreeTool(Tool):
    """Create and enter a git worktree."""

    name = "EnterWorktree"
    description = """Use this tool ONLY when the user explicitly asks to work in a worktree.

This tool creates an isolated git worktree and switches the current session into it.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "name": {
                "description": "A name for the worktree",
                "type": "string"
            }
        },
        "required": [],
        "additionalProperties": False
    }

    async def execute(self, name: str | None = None) -> ToolResult:
        """Create and enter a worktree."""
        manager = WorktreeManager()

        # Check if in git repo
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                capture_output=True,
                text=True,
                cwd=self.working_directory
            )
            if result.returncode != 0:
                return ToolResult(
                    output="Error: Not in a git repository",
                    is_error=True
                )
        except Exception as e:
            return ToolResult(output=f"Error checking git repo: {e}", is_error=True)

        worktree_name = name or f"worktree-{uuid.uuid4().hex[:8]}"
        worktree_path = Path(self.working_directory) / ".agent-worktrees" / worktree_name
        branch_name = f"agent/{worktree_name}"

        try:
            # Create worktree
            result = subprocess.run(
                ["git", "worktree", "add", str(worktree_path), "-b", branch_name],
                capture_output=True,
                text=True,
                cwd=self.working_directory
            )

            if result.returncode != 0:
                return ToolResult(
                    output=f"Error creating worktree: {result.stderr}",
                    is_error=True
                )

            # Update manager
            manager.worktrees[worktree_name] = {
                "path": str(worktree_path),
                "branch": branch_name,
                "original_dir": self.working_directory
            }
            manager.current_worktree = worktree_name

            return ToolResult(
                output=f"Created and entered worktree at {worktree_path}\nBranch: {branch_name}",
                metadata={
                    "worktree_name": worktree_name,
                    "worktree_path": str(worktree_path),
                    "branch": branch_name
                }
            )

        except Exception as e:
            return ToolResult(output=f"Error: {e}", is_error=True)


@registry.register
class ExitWorktreeTool(Tool):
    """Exit a git worktree."""

    name = "ExitWorktree"
    description = """Exit a worktree session created by EnterWorktree.

This tool ONLY operates on worktrees created by EnterWorktree in this session.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "action": {
                "description": "'keep' leaves worktree intact; 'remove' deletes it",
                "type": "string",
                "enum": ["keep", "remove"]
            },
            "discard_changes": {
                "description": "Required when action is 'remove' and there are uncommitted changes",
                "type": "boolean"
            }
        },
        "required": ["action"],
        "additionalProperties": False
    }

    async def execute(
        self,
        action: str,
        discard_changes: bool = False
    ) -> ToolResult:
        """Exit the worktree."""
        manager = WorktreeManager()

        if not manager.current_worktree:
            return ToolResult(output="No active worktree to exit.")

        worktree_name = manager.current_worktree
        worktree_info = manager.worktrees.get(worktree_name)

        if not worktree_info:
            return ToolResult(output="Worktree info not found.", is_error=True)

        worktree_path = worktree_info["path"]
        original_dir = worktree_info["original_dir"]

        if action == "remove":
            # Check for uncommitted changes
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True,
                cwd=worktree_path
            )

            if result.stdout.strip() and not discard_changes:
                return ToolResult(
                    output=f"Worktree has uncommitted changes. Set discard_changes=true to remove.\n{result.stdout}",
                    is_error=True
                )

            try:
                # Remove worktree
                subprocess.run(
                    ["git", "worktree", "remove", "--force", worktree_path],
                    capture_output=True,
                    cwd=original_dir
                )

                # Delete branch
                subprocess.run(
                    ["git", "branch", "-D", worktree_info["branch"]],
                    capture_output=True,
                    cwd=original_dir
                )

                del manager.worktrees[worktree_name]
                manager.current_worktree = None

                return ToolResult(
                    output=f"Removed worktree {worktree_name}\nReturned to {original_dir}",
                    metadata={"original_dir": original_dir}
                )

            except Exception as e:
                return ToolResult(output=f"Error removing worktree: {e}", is_error=True)

        else:  # keep
            manager.current_worktree = None
            return ToolResult(
                output=f"Left worktree {worktree_name} intact.\nReturned to {original_dir}",
                metadata={"worktree_path": worktree_path, "original_dir": original_dir}
            )
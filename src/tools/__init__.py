"""
Core tools package.

All tools are registered with the global registry when this module is imported.
"""

from .bash import BashTool
from .read import ReadTool
from .write import WriteTool
from .edit import EditTool
from .glob import GlobTool
from .grep import GrepTool
from .agent import AgentTool
from .web import WebFetchTool, WebSearchTool
from .ask import AskUserQuestionTool
from .notebook import NotebookEditTool
from .worktree import EnterWorktreeTool, ExitWorktreeTool
from .plan import EnterPlanModeTool, ExitPlanModeTool
from .cron import CronCreateTool, CronDeleteTool, CronListTool
from .skill import SkillTool
from .todo import TodoWriteTool, TaskOutputTool, TaskStopTool

__all__ = [
    # Core file operations
    "BashTool",
    "ReadTool",
    "WriteTool",
    "EditTool",
    "GlobTool",
    "GrepTool",

    # Agent and sub-agents
    "AgentTool",

    # Todo tracking (matches Claude CLI)
    "TodoWriteTool",
    "TaskOutputTool",
    "TaskStopTool",

    # Web tools
    "WebFetchTool",
    "WebSearchTool",

    # User interaction
    "AskUserQuestionTool",

    # Notebook
    "NotebookEditTool",

    # Git worktree
    "EnterWorktreeTool",
    "ExitWorktreeTool",

    # Planning
    "EnterPlanModeTool",
    "ExitPlanModeTool",

    # Cron scheduling
    "CronCreateTool",
    "CronDeleteTool",
    "CronListTool",

    # Skills
    "SkillTool",
]
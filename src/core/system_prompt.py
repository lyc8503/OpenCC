"""
System prompt generator that matches Claude CLI.

Generates system prompts that are compatible with Claude CLI format.
"""

import subprocess
from pathlib import Path
from datetime import datetime
import platform
import os


def get_git_status(working_dir: str = ".") -> str:
    """Get git status for the working directory."""
    try:
        # Get current branch
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            cwd=working_dir
        )
        current_branch = result.stdout.strip() or "HEAD"

        # Get main branch
        result = subprocess.run(
            ["git", "remote", "show", "origin"],
            capture_output=True,
            text=True,
            cwd=working_dir
        )
        main_branch = "main"
        for line in result.stdout.split('\n'):
            if "HEAD branch:" in line:
                main_branch = line.split(":")[-1].strip()
                break

        # Get status
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=working_dir
        )

        status_lines = []
        for line in result.stdout.strip().split('\n'):
            if line:
                status_lines.append(line)

        status_text = '\n'.join(status_lines) if status_lines else ""

        return f"""gitStatus: This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.
Current branch: {current_branch}

Main branch (you will usually use this for PRs): {main_branch}

Status:
{status_text}

Recent commits:
"""

    except Exception:
        return "gitStatus: Not a git repository\n"


def get_environment_info(working_dir: str = ".") -> str:
    """Get environment information."""
    return f"""# Environment
You have been invoked in the following environment:
 - Primary working directory: {Path(working_dir).absolute()}
  - Is a git repository: {(Path(working_dir) / ".git").exists()}
 - Platform: {platform.system().lower()}
 - Shell: {os.environ.get("SHELL", "unknown").split("/")[-1]}
 - OS Version: {platform.platform()}
 - You are powered by the model named Sonnet 4.6. The exact model ID is claude-sonnet-4-6.

Assistant knowledge cutoff is August 2025.
"""


def get_memory_path(working_dir: str = ".") -> str:
    """Get memory system path."""
    home = Path.home()
    project_name = Path(working_dir).absolute().name
    return str(home / ".claude" / "projects" / f"-{home.name}-{project_name}" / "memory")


def build_system_prompt(working_dir: str = ".") -> str:
    """Build the complete system prompt matching Claude CLI format."""

    # Read the base template
    template_path = Path(__file__).parent / "system_prompt_template.txt"
    if template_path.exists():
        base_template = template_path.read_text()
    else:
        base_template = ""

    # Build dynamic parts
    memory_path = get_memory_path(working_dir)

    # Replace memory path placeholder
    base_template = base_template.replace(
        "/home/lyc/.claude/projects/-home-lyc-opencc/memory/",
        memory_path
    )

    # Add environment section
    env_info = get_environment_info(working_dir)

    # Add git status
    git_info = get_git_status(working_dir)

    # Combine
    return base_template + "\n" + env_info + "\n" + git_info
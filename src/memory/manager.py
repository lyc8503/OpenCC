"""
Memory management for persistent context.
"""

from pathlib import Path
from typing import Literal
import yaml
import os
from ..core.types import Memory


class MemoryManager:
    """
    Manages persistent memory storage.

    Memory types:
    - user: User preferences, role, knowledge
    - feedback: User corrections and guidance
    - project: Project-specific context and decisions
    - reference: Pointers to external resources
    """

    def __init__(self, working_directory: str = "."):
        self.working_directory = Path(working_directory)
        self.memory_dir = self.working_directory / ".agent" / "memory"
        self.memory_index_file = self.memory_dir / "MEMORY.md"

    def _ensure_dir(self):
        """Ensure memory directory exists."""
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    def save_memory(
        self,
        name: str,
        description: str,
        type: Literal["user", "feedback", "project", "reference"],
        content: str
    ) -> Memory:
        """Save a memory entry."""
        self._ensure_dir()

        # Create memory file
        memory_file = self.memory_dir / f"{type}_{name}.md"

        frontmatter = yaml.dump({
            "name": name,
            "description": description,
            "type": type
        })

        file_content = f"---\n{frontmatter}---\n\n{content}"
        memory_file.write_text(file_content)

        # Update index
        self._update_index()

        return Memory(name=name, description=description, type=type, content=content)

    def load_memory(self, name: str) -> Memory | None:
        """Load a memory entry by name."""
        for memory_file in self.memory_dir.glob("*.md"):
            if memory_file.name == "MEMORY.md":
                continue

            content = memory_file.read_text()
            if content.startswith("---"):
                _, frontmatter, body = content.split("---", 2)
                meta = yaml.safe_load(frontmatter)
                if meta.get("name") == name:
                    return Memory(
                        name=meta.get("name"),
                        description=meta.get("description", ""),
                        type=meta.get("type"),
                        content=body.strip()
                    )
        return None

    def list_memories(self, type: str | None = None) -> list[Memory]:
        """List all memories, optionally filtered by type."""
        memories = []

        if not self.memory_dir.exists():
            return memories

        for memory_file in self.memory_dir.glob("*.md"):
            if memory_file.name == "MEMORY.md":
                continue

            content = memory_file.read_text()
            if content.startswith("---"):
                try:
                    _, frontmatter, body = content.split("---", 2)
                    meta = yaml.safe_load(frontmatter)

                    if type and meta.get("type") != type:
                        continue

                    memories.append(Memory(
                        name=meta.get("name"),
                        description=meta.get("description", ""),
                        type=meta.get("type"),
                        content=body.strip()
                    ))
                except Exception:
                    pass

        return memories

    def delete_memory(self, name: str) -> bool:
        """Delete a memory entry."""
        for memory_file in self.memory_dir.glob("*.md"):
            if memory_file.name == "MEMORY.md":
                continue

            content = memory_file.read_text()
            if content.startswith("---"):
                _, frontmatter, _ = content.split("---", 2)
                meta = yaml.safe_load(frontmatter)
                if meta.get("name") == name:
                    memory_file.unlink()
                    self._update_index()
                    return True
        return False

    def get_memory_context(self, max_lines: int = 200) -> str:
        """
        Get memory context for injection into prompts.

        Returns the MEMORY.md index content, truncated to max_lines.
        """
        if not self.memory_index_file.exists():
            return ""

        content = self.memory_index_file.read_text()
        lines = content.split("\n")

        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines.append("\n... (truncated)")

        return "\n".join(lines)

    def _update_index(self):
        """Update the MEMORY.md index file."""
        self._ensure_dir()

        memories = self.list_memories()

        index_lines = ["# Memory Index\n"]
        for memory in memories:
            index_lines.append(f"- [{memory.name}]({memory.type}_{memory.name}.md) - {memory.description}")

        self.memory_index_file.write_text("\n".join(index_lines))

    def clear_all(self):
        """Clear all memories."""
        if self.memory_dir.exists():
            for f in self.memory_dir.glob("*.md"):
                f.unlink()
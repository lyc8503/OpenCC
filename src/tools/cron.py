"""
Cron tools - Schedule prompts for future execution.
"""

from ..core.tool import Tool, registry
from ..core.types import ToolResult, CronJob
from typing import Dict
import uuid
import time
import asyncio
from datetime import datetime
import re


class CronScheduler:
    """Global cron scheduler."""
    _instance: "CronScheduler | None" = None
    jobs: Dict[str, CronJob] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def schedule_job(self, job: CronJob, callback):
        """Schedule a job to run."""
        self.jobs[job.id] = job
        # In a real implementation, this would use a scheduler library
        # For now, we just store the job


@registry.register
class CronCreateTool(Tool):
    """Schedule a prompt to be enqueued at a future time."""

    name = "CronCreate"
    description = """Schedule a prompt to be enqueued at a future time.

Uses standard 5-field cron in the user's local timezone.

Recurring jobs auto-expire after 3 days.
"""

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "cron": {
                "description": "Standard 5-field cron expression (M H DoM Mon DoW)",
                "type": "string"
            },
            "prompt": {
                "description": "The prompt to enqueue at each fire time",
                "type": "string"
            },
            "recurring": {
                "description": "true = fire on every cron match; false = fire once then delete",
                "type": "boolean",
                "default": True
            }
        },
        "required": ["cron", "prompt"],
        "additionalProperties": False
    }

    async def execute(
        self,
        cron: str,
        prompt: str,
        recurring: bool = True
    ) -> ToolResult:
        """Create a scheduled job."""
        scheduler = CronScheduler()

        # Validate cron expression (simplified)
        parts = cron.split()
        if len(parts) != 5:
            return ToolResult(
                output="Error: Invalid cron expression. Must have 5 fields (M H DoM Mon DoW)",
                is_error=True
            )

        job_id = str(uuid.uuid4())[:8]

        job = CronJob(
            id=job_id,
            cron=cron,
            prompt=prompt,
            recurring=recurring
        )

        scheduler.jobs[job_id] = job

        schedule_type = "recurring" if recurring else "one-shot"
        return ToolResult(
            output=f"Created {schedule_type} job {job_id}\nCron: {cron}\nPrompt: {prompt[:100]}...",
            metadata={"job_id": job_id, "cron": cron, "recurring": recurring}
        )


@registry.register
class CronDeleteTool(Tool):
    """Cancel a scheduled cron job."""

    name = "CronDelete"
    description = "Cancel a cron job previously scheduled with CronCreate."

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "id": {
                "description": "Job ID returned by CronCreate",
                "type": "string"
            }
        },
        "required": ["id"],
        "additionalProperties": False
    }

    async def execute(self, id: str) -> ToolResult:
        """Delete a scheduled job."""
        scheduler = CronScheduler()

        if id not in scheduler.jobs:
            return ToolResult(
                output=f"Job {id} not found",
                is_error=True
            )

        del scheduler.jobs[id]

        return ToolResult(output=f"Deleted job {id}")


@registry.register
class CronListTool(Tool):
    """List all scheduled cron jobs."""

    name = "CronList"
    description = "List all cron jobs scheduled via CronCreate in this session."

    parameters = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {},
        "additionalProperties": False
    }

    async def execute(self) -> ToolResult:
        """List all scheduled jobs."""
        scheduler = CronScheduler()

        if not scheduler.jobs:
            return ToolResult(output="No scheduled jobs.")

        lines = ["# Scheduled Jobs", ""]
        for job in scheduler.jobs.values():
            job_type = "recurring" if job.recurring else "one-shot"
            lines.append(f"## Job {job.id}")
            lines.append(f"- Type: {job_type}")
            lines.append(f"- Cron: {job.cron}")
            lines.append(f"- Prompt: {job.prompt[:50]}...")
            lines.append("")

        return ToolResult(
            output="\n".join(lines),
            metadata={"jobs": {k: v.__dict__ for k, v in scheduler.jobs.items()}}
        )
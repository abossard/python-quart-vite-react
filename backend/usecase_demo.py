"""
Usecase Demo agent run orchestration.

Provides a small in-memory background runner so the UI can:
- Submit a prompt
- Poll run status
- Render structured results when available
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from agents import AgentRequest, agent_service

USECASE_DEMO_AGENT_TIMEOUT_SECONDS = float(
    os.getenv("USECASE_DEMO_AGENT_TIMEOUT_SECONDS", "300")
)


class UsecaseDemoRunStatus(str, Enum):
    """Execution status for a usecase demo agent run."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class UsecaseDemoRunCreate(BaseModel):
    """Input payload for creating a background run."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="Prompt to execute with the CSV ticket assistant",
    )

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Prompt cannot be empty")
        return cleaned


class UsecaseDemoRun(BaseModel):
    """State and result payload for a background run."""

    id: str = Field(..., description="Unique run identifier")
    prompt: str = Field(..., description="Prompt used for the run")
    status: UsecaseDemoRunStatus = Field(default=UsecaseDemoRunStatus.QUEUED)
    created_at: datetime = Field(default_factory=datetime.now)
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
    tools_used: list[str] = Field(default_factory=list)
    result_markdown: str | None = Field(default=None)
    result_rows: list[dict[str, Any]] = Field(default_factory=list)
    result_columns: list[str] = Field(default_factory=list)
    error: str | None = Field(default=None)


def _sanitize_cell_value(value: Any) -> Any:
    """Ensure table values are JSON-serializable scalar strings/numbers."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _coerce_rows(candidate: Any) -> list[dict[str, Any]]:
    """Normalize parsed JSON into a list of tabular rows."""
    rows: list[dict[str, Any]] = []

    if isinstance(candidate, list):
        for item in candidate:
            if isinstance(item, dict):
                rows.append({k: _sanitize_cell_value(v) for k, v in item.items()})
    elif isinstance(candidate, dict):
        # Common structures used by LLM output.
        if isinstance(candidate.get("rows"), list):
            rows = _coerce_rows(candidate["rows"])
        elif isinstance(candidate.get("results"), list):
            rows = _coerce_rows(candidate["results"])

    return rows


def extract_rows_from_markdown(markdown: str) -> list[dict[str, Any]]:
    """
    Extract the first useful JSON table from markdown output.

    Expected pattern:
    ```json
    [{...}, {...}]
    ```
    """
    json_blocks = re.findall(r"```json\s*(.*?)```", markdown, flags=re.IGNORECASE | re.DOTALL)
    for block in json_blocks:
        text = block.strip()
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue

        rows = _coerce_rows(parsed)
        if rows:
            return rows

    return []


def _extract_columns(rows: list[dict[str, Any]]) -> list[str]:
    """Build a stable column list from row keys in first-seen order."""
    columns: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in columns:
                columns.append(key)
    return columns


class UsecaseDemoRunService:
    """In-memory run orchestration with polling-friendly status updates."""

    def __init__(self) -> None:
        self._runs: dict[str, UsecaseDemoRun] = {}
        self._lock = asyncio.Lock()

    async def create_run(self, payload: UsecaseDemoRunCreate) -> UsecaseDemoRun:
        """Create a run and schedule asynchronous execution."""
        run = UsecaseDemoRun(id=str(uuid4()), prompt=payload.prompt)
        async with self._lock:
            self._runs[run.id] = run

        asyncio.create_task(self._execute_run(run.id))
        return run

    async def get_run(self, run_id: str) -> UsecaseDemoRun | None:
        """Fetch a run by ID."""
        async with self._lock:
            run = self._runs.get(run_id)
            return run.model_copy() if run else None

    async def list_runs(self, limit: int = 20) -> list[UsecaseDemoRun]:
        """List most recent runs first."""
        normalized_limit = min(max(limit, 1), 200)
        async with self._lock:
            runs = sorted(
                self._runs.values(),
                key=lambda item: item.created_at,
                reverse=True,
            )
            return [run.model_copy() for run in runs[:normalized_limit]]

    async def _update_run(self, run_id: str, **updates: Any) -> None:
        """Atomic update helper for run fields."""
        async with self._lock:
            run = self._runs.get(run_id)
            if not run:
                return
            self._runs[run_id] = run.model_copy(update=updates)

    async def _execute_run(self, run_id: str) -> None:
        """Run the agent and persist terminal status and parsed output."""
        run = await self.get_run(run_id)
        if run is None:
            return

        await self._update_run(
            run_id,
            status=UsecaseDemoRunStatus.RUNNING,
            started_at=datetime.now(),
            error=None,
        )

        # Enforce a predictable output block for table rendering.
        structured_prompt = (
            f"{run.prompt}\n\n"
            "Antwortformat:\n"
            "- Führe die Anfrage mit möglichst wenigen Tool-Aufrufen aus.\n"
            "- Nutze kompakte fields und sinnvolle limits.\n"
            "- Fordere notes/resolution nur bei explizitem Bedarf an.\n"
            "- Gib einen JSON-Codeblock mit {\"rows\": [...]} zurück.\n"
            "- Falls keine sinnvollen Zeilen existieren, gib {\"rows\": []} zurück.\n"
            "- Optional danach: kurze Zusammenfassung in 2-4 Stichpunkten."
        )

        try:
            response = await asyncio.wait_for(
                agent_service.run_agent(
                    AgentRequest(prompt=structured_prompt, agent_type="task_assistant")
                ),
                timeout=USECASE_DEMO_AGENT_TIMEOUT_SECONDS,
            )
            rows = extract_rows_from_markdown(response.result or "")
            columns = _extract_columns(rows)
            final_status = UsecaseDemoRunStatus.COMPLETED if not response.error else UsecaseDemoRunStatus.FAILED
            await self._update_run(
                run_id,
                status=final_status,
                completed_at=datetime.now(),
                tools_used=response.tools_used,
                result_markdown=response.result,
                result_rows=rows,
                result_columns=columns,
                error=response.error,
            )
        except asyncio.TimeoutError:
            await self._update_run(
                run_id,
                status=UsecaseDemoRunStatus.FAILED,
                completed_at=datetime.now(),
                error=(
                    f"Agent run timed out after "
                    f"{int(USECASE_DEMO_AGENT_TIMEOUT_SECONDS)}s"
                ),
            )
        except Exception as exc:
            await self._update_run(
                run_id,
                status=UsecaseDemoRunStatus.FAILED,
                completed_at=datetime.now(),
                error=str(exc),
            )


usecase_demo_run_service = UsecaseDemoRunService()


__all__ = [
    "UsecaseDemoRunStatus",
    "UsecaseDemoRunCreate",
    "UsecaseDemoRun",
    "UsecaseDemoRunService",
    "usecase_demo_run_service",
    "extract_rows_from_markdown",
]

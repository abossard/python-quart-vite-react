"""
Agent Builder — Run Models

Data definitions for agent execution runs.
Pure data — no behavior, no I/O.
"""

import json
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SField, SQLModel, String


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentRun(SQLModel, table=True):
    """One execution of an AgentDefinition against a user prompt."""
    __tablename__ = "workbench_agent_runs"

    id: str = SField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    agent_id: str = SField(foreign_key="workbench_agent_definitions.id", index=True)
    input_prompt: str
    status: str = SField(default=RunStatus.PENDING.value)
    output: Optional[str] = SField(default=None)
    agent_snapshot_json: str = SField(
        default="{}",
        sa_column=Column(String, name="agent_snapshot"),
    )
    tools_used_json: str = SField(
        default="[]",
        sa_column=Column(String, name="tools_used"),
    )
    error: Optional[str] = SField(default=None)
    created_at: datetime = SField(default_factory=datetime.now)
    completed_at: Optional[datetime] = SField(default=None)

    @property
    def agent_snapshot(self) -> dict[str, Any]:
        try:
            raw = json.loads(self.agent_snapshot_json)
            if isinstance(raw, dict):
                return raw
            return {}
        except (json.JSONDecodeError, TypeError):
            return {}

    @agent_snapshot.setter
    def agent_snapshot(self, value: dict[str, Any]) -> None:
        self.agent_snapshot_json = json.dumps(value)

    @property
    def tools_used(self) -> list[str]:
        try:
            return json.loads(self.tools_used_json)
        except (json.JSONDecodeError, TypeError):
            return []

    @tools_used.setter
    def tools_used(self, value: list[str]) -> None:
        self.tools_used_json = json.dumps(value)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "input_prompt": self.input_prompt,
            "status": self.status,
            "output": self.output,
            "agent_snapshot": self.agent_snapshot,
            "tools_used": self.tools_used,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class AgentRunCreate(BaseModel):
    input_prompt: str = Field(default="", max_length=10000)
    required_input_value: Optional[str] = Field(default=None, max_length=2000)

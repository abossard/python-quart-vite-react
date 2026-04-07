"""
Agent Builder — Run Models

Data definitions for agent execution runs.
Pure data — no behavior, no I/O.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TRUNCATED = "truncated"


class AgentRun(BaseModel):
    """One execution of an AgentDefinition against a user prompt."""

    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    input_prompt: str
    status: str = Field(default=RunStatus.PENDING.value)
    output: Optional[str] = Field(default=None)
    agent_snapshot: dict[str, Any] = Field(default_factory=dict)
    tools_used: list[str] = Field(default_factory=list)
    error: Optional[str] = Field(default=None)
    activity_log: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = Field(default=None)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "input_prompt": self.input_prompt,
            "status": self.status,
            "output": self.output,
            "agent_snapshot": self.agent_snapshot,
            "tools_used": list(self.tools_used),
            "activity_log": list(self.activity_log),
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class AgentRunCreate(BaseModel):
    input_prompt: str = Field(default="", max_length=10000)
    required_input_value: Optional[str] = Field(default=None, max_length=2000)

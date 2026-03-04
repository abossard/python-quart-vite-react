"""
Agent Builder — Agent Definition Models

Data definitions for agent blueprints (system prompt + tools + criteria).
Pure data — no behavior, no I/O.
"""

import json
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SField, SQLModel, String

from .evaluation import SuccessCriteria


class AgentDefinition(SQLModel, table=True):
    """Persisted agent blueprint: system prompt + tools + success criteria."""
    __tablename__ = "workbench_agent_definitions"

    id: str = SField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = SField(index=True, description="Human-readable agent name")
    description: str = SField(default="", description="Optional description")
    system_prompt: str = SField(description="System prompt sent to the LLM")
    requires_input: bool = SField(
        default=False,
        description="When true, runs must include required_input_value",
    )
    required_input_description: str = SField(
        default="",
        description="Description shown to operators for required runtime input",
    )
    tool_names_json: str = SField(
        default="[]",
        description="JSON-serialized list of tool names available to this agent",
        sa_column=Column(String, name="tool_names"),
    )
    success_criteria_json: str = SField(
        default="[]",
        description="JSON-serialized list of SuccessCriteria dicts",
        sa_column=Column(String, name="success_criteria"),
    )
    created_at: datetime = SField(default_factory=datetime.now)
    updated_at: datetime = SField(default_factory=datetime.now)

    @property
    def tool_names(self) -> list[str]:
        try:
            return json.loads(self.tool_names_json)
        except (json.JSONDecodeError, TypeError):
            return []

    @tool_names.setter
    def tool_names(self, value: list[str]) -> None:
        self.tool_names_json = json.dumps(value)

    @property
    def success_criteria(self) -> list[SuccessCriteria]:
        try:
            raw = json.loads(self.success_criteria_json)
            return [SuccessCriteria(**c) for c in raw]
        except (json.JSONDecodeError, TypeError, Exception):
            return []

    @success_criteria.setter
    def success_criteria(self, value: list[SuccessCriteria]) -> None:
        self.success_criteria_json = json.dumps([c.model_dump() for c in value])

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "requires_input": self.requires_input,
            "required_input_description": self.required_input_description,
            "tool_names": self.tool_names,
            "success_criteria": [c.model_dump() for c in self.success_criteria],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class AgentDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="")
    system_prompt: str = Field(..., min_length=1)
    requires_input: bool = Field(default=False)
    required_input_description: str = Field(default="")
    tool_names: list[str] = Field(default_factory=list)
    success_criteria: list[SuccessCriteria] = Field(default_factory=list)


class AgentDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    system_prompt: Optional[str] = Field(default=None)
    requires_input: Optional[bool] = Field(default=None)
    required_input_description: Optional[str] = Field(default=None)
    tool_names: Optional[list[str]] = Field(default=None)
    success_criteria: Optional[list[SuccessCriteria]] = Field(default=None)

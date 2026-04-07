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

from .evaluation import SuccessCriteria


class AgentDefinition(BaseModel):
    """Persisted agent blueprint: system prompt + tools + success criteria."""

    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(description="Human-readable agent name")
    description: str = Field(default="", description="Optional description")
    system_prompt: str = Field(description="System prompt sent to the LLM")
    requires_input: bool = Field(
        default=False,
        description="When true, runs must include required_input_value",
    )
    required_input_description: str = Field(
        default="",
        description="Description shown to operators for required runtime input",
    )
    model: str = Field(
        default="",
        description="LLM model name override (empty = service default)",
    )
    temperature: float = Field(
        default=0.0,
        description="LLM temperature (0.0 = deterministic, 1.0 = creative)",
    )
    recursion_limit: int = Field(
        default=3,
        description="Max ReAct loop iterations before stopping",
    )
    max_tokens: int = Field(
        default=4096,
        description="Max LLM response tokens",
    )
    reasoning_effort: str = Field(
        default="low",
        description="Reasoning effort: low (fast), medium, high (deep thinking), default (model default)",
    )
    output_instructions: str = Field(
        default="",
        description="Custom output format instructions (empty = default markdown)",
    )
    output_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="JSON Schema for structured output (empty dict = no constraint)",
    )
    show_in_menu: bool = Field(
        default=False,
        description="When true, agent appears as a tab in the main navigation",
    )
    tool_names: list[str] = Field(
        default_factory=list,
        description="List of tool names available to this agent",
    )
    success_criteria: list[SuccessCriteria] = Field(
        default_factory=list,
        description="List of SuccessCriteria for evaluating agent runs",
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @property
    def has_output_schema(self) -> bool:
        """True when a non-empty output schema is configured."""
        return bool(self.output_schema and self.output_schema.get("properties"))

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "requires_input": self.requires_input,
            "required_input_description": self.required_input_description,
            "model": self.model,
            "temperature": self.temperature,
            "recursion_limit": self.recursion_limit,
            "max_tokens": self.max_tokens,
            "reasoning_effort": self.reasoning_effort,
            "output_instructions": self.output_instructions,
            "output_schema": self.output_schema,
            "show_in_menu": self.show_in_menu,
            "tool_names": list(self.tool_names),
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
    model: str = Field(default="", description="LLM model override (empty = service default)")
    temperature: float = Field(default=0.0, ge=0.0, le=2.0, description="LLM temperature")
    recursion_limit: int = Field(default=3, ge=1, le=100, description="Max ReAct iterations")
    max_tokens: int = Field(default=4096, ge=0, description="Max response tokens")
    reasoning_effort: str = Field(default="low", description="Reasoning effort: low, medium, high, default")
    output_instructions: str = Field(default="", description="Custom output format instructions")
    output_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="JSON Schema for structured output (empty = no constraint)",
    )
    tool_names: list[str] = Field(default_factory=list)
    success_criteria: list[SuccessCriteria] = Field(default_factory=list)
    show_in_menu: bool = Field(default=False, description="Show agent as a tab in the main navigation")


class AgentDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    system_prompt: Optional[str] = Field(default=None)
    requires_input: Optional[bool] = Field(default=None)
    required_input_description: Optional[str] = Field(default=None)
    model: Optional[str] = Field(default=None)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    recursion_limit: Optional[int] = Field(default=None, ge=1, le=100)
    max_tokens: Optional[int] = Field(default=None, ge=0)
    reasoning_effort: Optional[str] = Field(default=None)
    output_instructions: Optional[str] = Field(default=None)
    output_schema: Optional[dict[str, Any]] = Field(default=None)
    tool_names: Optional[list[str]] = Field(default=None)
    success_criteria: Optional[list[SuccessCriteria]] = Field(default=None)
    show_in_menu: Optional[bool] = Field(default=None)

"""
Agent Builder — Evaluation Models

Data definitions for success criteria, criteria results, and agent evaluations.
Pure data — no behavior, no I/O.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CriteriaType(str, Enum):
    TOOL_CALLED = "tool_called"
    OUTPUT_CONTAINS = "output_contains"
    NO_ERROR = "no_error"
    LLM_JUDGE = "llm_judge"


class SuccessCriteria(BaseModel):
    """A single evaluatable success criterion for an agent run."""
    type: CriteriaType
    value: str = Field(description="Tool name / substring / judge prompt depending on type")
    description: str = Field(default="", description="Human-readable explanation")


class CriteriaResult(BaseModel):
    """Outcome of applying one SuccessCriteria to a completed run."""
    criteria: SuccessCriteria
    passed: bool
    detail: str = ""


class AgentEvaluation(BaseModel):
    """Evaluation result for a completed AgentRun."""

    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    criteria_results: list[CriteriaResult] = Field(default_factory=list)
    overall_passed: bool = Field(default=False)
    score: float = Field(default=0.0, description="Ratio of passed criteria (0.0–1.0)")
    evaluated_at: datetime = Field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "run_id": self.run_id,
            "criteria_results": [r.model_dump() for r in self.criteria_results],
            "overall_passed": self.overall_passed,
            "score": self.score,
            "evaluated_at": self.evaluated_at.isoformat(),
        }

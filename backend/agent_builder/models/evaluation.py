"""
Agent Builder — Evaluation Models

Data definitions for success criteria, criteria results, and agent evaluations.
Pure data — no behavior, no I/O.
"""

import json
import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SField, SQLModel, String


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


class AgentEvaluation(SQLModel, table=True):
    """Evaluation result for a completed AgentRun."""
    __tablename__ = "workbench_agent_evaluations"

    id: str = SField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    run_id: str = SField(foreign_key="workbench_agent_runs.id", unique=True, index=True)
    criteria_results_json: str = SField(
        default="[]",
        sa_column=Column(String, name="criteria_results"),
    )
    overall_passed: bool = SField(default=False)
    score: float = SField(default=0.0, description="Ratio of passed criteria (0.0–1.0)")
    evaluated_at: datetime = SField(default_factory=datetime.now)

    @property
    def criteria_results(self) -> list[CriteriaResult]:
        try:
            raw = json.loads(self.criteria_results_json)
            return [CriteriaResult(**r) for r in raw]
        except (json.JSONDecodeError, TypeError, Exception):
            return []

    @criteria_results.setter
    def criteria_results(self, value: list[CriteriaResult]) -> None:
        self.criteria_results_json = json.dumps([r.model_dump() for r in value])

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "run_id": self.run_id,
            "criteria_results": [r.model_dump() for r in self.criteria_results],
            "overall_passed": self.overall_passed,
            "score": self.score,
            "evaluated_at": self.evaluated_at.isoformat(),
        }

"""
Agent Workbench - Data Models

SQLModel definitions for AgentDefinition, AgentRun, and AgentEvaluation.
JSON columns store list / dict data as serialized strings in SQLite.
"""

import json
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SField, Session, SQLModel, String, create_engine, select, text


# ============================================================================
# ENUMS & EMBEDDED PYDANTIC TYPES
# ============================================================================

class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CriteriaType(str, Enum):
    TOOL_CALLED = "tool_called"       # agent called a specific tool during the run
    OUTPUT_CONTAINS = "output_contains"  # final output contains a substring
    NO_ERROR = "no_error"             # run completed without error
    LLM_JUDGE = "llm_judge"           # OpenAI grades the answer via a judge prompt


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


# ============================================================================
# HELPER - deterministic UUID string
# ============================================================================

def _new_id() -> str:
    return str(uuid.uuid4())


# ============================================================================
# TABLE MODELS
# ============================================================================

class AgentDefinition(SQLModel, table=True):
    """Persisted agent blueprint: system prompt + tools + success criteria."""
    __tablename__ = "workbench_agent_definitions"

    id: str = SField(default_factory=_new_id, primary_key=True)
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
    # Stored as JSON arrays in TEXT columns
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

    # ------------------------------------------------------------------
    # Convenience properties (not persisted; computed from JSON columns)
    # ------------------------------------------------------------------

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


class AgentRun(SQLModel, table=True):
    """One execution of an AgentDefinition against a user prompt."""
    __tablename__ = "workbench_agent_runs"

    id: str = SField(default_factory=_new_id, primary_key=True)
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


class AgentEvaluation(SQLModel, table=True):
    """Evaluation result for a completed AgentRun."""
    __tablename__ = "workbench_agent_evaluations"

    id: str = SField(default_factory=_new_id, primary_key=True)
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


# ============================================================================
# REQUEST / RESPONSE MODELS (REST layer)
# ============================================================================

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


class AgentRunCreate(BaseModel):
    input_prompt: str = Field(default="", max_length=10000)
    required_input_value: Optional[str] = Field(default=None, max_length=2000)


# ============================================================================
# DATABASE INITIALISATION
# ============================================================================

def build_engine(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    SQLModel.metadata.create_all(engine)
    _run_migrations(engine)
    return engine


def _run_migrations(engine) -> None:
    """Apply lightweight SQLite migrations for new columns."""
    _ensure_column(
        engine,
        "workbench_agent_definitions",
        "requires_input",
        "BOOLEAN NOT NULL DEFAULT 0",
    )
    _ensure_column(
        engine,
        "workbench_agent_definitions",
        "required_input_description",
        "TEXT NOT NULL DEFAULT ''",
    )
    _ensure_column(
        engine,
        "workbench_agent_runs",
        "agent_snapshot",
        "TEXT NOT NULL DEFAULT '{}'",
    )


def _ensure_column(engine, table_name: str, column_name: str, column_ddl: str) -> None:
    with Session(engine) as session:
        rows = list(session.exec(text(f"PRAGMA table_info({table_name})")).all())
        columns = {row[1] for row in rows if len(row) > 1}
        if column_name in columns:
            return
        session.exec(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_ddl}"))
        session.commit()

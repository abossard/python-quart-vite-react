"""
Agent Workbench — Backward-compatibility shim.

All functionality has moved to the `agent_builder` package.
This module re-exports everything so existing imports continue to work.

    from agent_workbench import WorkbenchService  # still works
"""

# Re-export everything from the new module
from agent_builder import (  # noqa: F401
    AgentDefinition,
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentEvaluation,
    AgentRun,
    AgentRunCreate,
    CriteriaResult,
    CriteriaType,
    RunStatus,
    SuccessCriteria,
    WorkbenchService,
    ToolRegistry,
    compute_score,
    evaluate_run,
)

__all__ = [
    "WorkbenchService",
    "ToolRegistry",
    "AgentDefinition",
    "AgentDefinitionCreate",
    "AgentDefinitionUpdate",
    "AgentEvaluation",
    "AgentRun",
    "AgentRunCreate",
    "CriteriaResult",
    "CriteriaType",
    "RunStatus",
    "SuccessCriteria",
    "compute_score",
    "evaluate_run",
]

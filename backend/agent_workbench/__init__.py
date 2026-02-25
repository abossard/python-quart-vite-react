"""
Agent Workbench - Public API

Import everything you need from this package:

    from agent_workbench import (
        WorkbenchService,
        ToolRegistry,
        AgentDefinitionCreate,
        AgentRunCreate,
        SuccessCriteria,
        CriteriaType,
    )
"""

from .evaluator import compute_score, evaluate_run
from .models import (
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
)
from .service import WorkbenchService
from .tool_registry import ToolRegistry

__all__ = [
    # Service
    "WorkbenchService",
    "ToolRegistry",
    # Models
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
    # Evaluator helpers (useful for tests)
    "compute_score",
    "evaluate_run",
]

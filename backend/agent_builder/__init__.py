"""
Agent Builder — Public API

Import everything you need from this package:

    from agent_builder import WorkbenchService, ChatService, ToolRegistry
"""

from .chat_service import ChatService
from .evaluator import compute_score, evaluate_run
from .models import (
    AgentDefinition,
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentEvaluation,
    AgentRequest,
    AgentResponse,
    AgentRun,
    AgentRunCreate,
    CriteriaResult,
    CriteriaType,
    RunStatus,
    SuccessCriteria,
)
from .service import WorkbenchService
from .tools import ToolRegistry

__all__ = [
    # Services
    "ChatService",
    "WorkbenchService",
    "ToolRegistry",
    # Models
    "AgentDefinition",
    "AgentDefinitionCreate",
    "AgentDefinitionUpdate",
    "AgentEvaluation",
    "AgentRequest",
    "AgentResponse",
    "AgentRun",
    "AgentRunCreate",
    "CriteriaResult",
    "CriteriaType",
    "RunStatus",
    "SuccessCriteria",
    # Evaluator helpers
    "compute_score",
    "evaluate_run",
]
"""
Workbench Integration

Wires the project's tools into the Agent Workbench and exposes a
singleton WorkbenchService ready to use in app.py.

Separation of concerns:
  agent_workbench/  - independent module, knows nothing about this project
  workbench_integration.py - knows about both; bridges the gap
"""

import os
from pathlib import Path

# Ensure operations are loaded so @operation decorators run
import operations  # noqa: F401

from agent_workbench import ToolRegistry, WorkbenchService
from api_decorators import get_langchain_tools

# ============================================================================
# BUILD TOOL REGISTRY
# ============================================================================

def _build_registry() -> ToolRegistry:
    """
    Populate a ToolRegistry with all tools available in this project.

    Sources:
      1. All @operation-decorated functions via api_decorators.get_langchain_tools()
         This includes: task management + csv_* ticket operations

    The registry is built once at startup and shared with WorkbenchService.
    """
    registry = ToolRegistry()
    try:
        all_tools = get_langchain_tools()
        user_tools = [
            tool for tool in all_tools
            if not getattr(tool, "name", "").startswith("workbench_")
        ]
        registry.register_all(user_tools)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not load langchain tools: %s", exc)
    return registry


# ============================================================================
# SINGLETON SERVICE
# ============================================================================

_tool_registry = _build_registry()

workbench_service = WorkbenchService(
    tool_registry=_tool_registry,
    db_path=Path(__file__).parent / "data" / "workbench.db",
    openai_api_key=os.getenv("OPENAI_API_KEY", ""),
    openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    openai_base_url=os.getenv("OPENAI_BASE_URL", ""),
)

__all__ = ["workbench_service", "_tool_registry"]

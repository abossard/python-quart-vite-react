"""
Workbench Integration

Wires the project's tools into the Agent Builder module and exposes
singleton services ready to use in app.py.

Separation of concerns:
  agent_builder/  - independent module, knows nothing about this project
  workbench_integration.py - knows about both; bridges the gap
"""

import os
from pathlib import Path
from typing import Any

# Ensure operations are loaded so @operation decorators run
import operations  # noqa: F401
from agent_builder import ChatService, ToolRegistry, WorkbenchService
from agent_builder.llm_protocol import LLMConfig
from api_decorators import get_langchain_tools

# ============================================================================
# LLM FACTORY (bridges agent_builder to this project's LLM providers)
# ============================================================================

def _build_llm_factory():
    """Build an LLM factory that uses Copilot by default, OpenAI when forced.

    This is the single place where LLM provider knowledge lives —
    the agent_builder module never imports any provider directly.

    Set AGENT_BACKEND=fake for deterministic E2E testing (no real LLM calls).
    """
    def llm_factory(config: LLMConfig) -> Any:
        backend = os.getenv("AGENT_BACKEND", "").strip().lower()
        api_key = config.api_key or os.getenv("OPENAI_API_KEY", "")

        if backend == "fake":
            from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
            from langchain_core.messages import AIMessage

            class _FakeWithTools(FakeMessagesListChatModel):
                def bind_tools(self, tools, **kwargs):
                    return self

            return _FakeWithTools(responses=[
                AIMessage(
                    content="",
                    tool_calls=[{"name": "csv_ticket_stats", "args": {}, "id": "fake-tc-1"}],
                ),
                AIMessage(content="**Fake LLM response.** Tool `csv_ticket_stats` was called successfully."),
            ])

        if backend == "openai" and api_key:
            from langchain_openai import ChatOpenAI
            kwargs: dict[str, Any] = {
                "model": config.model or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "api_key": api_key,
                "base_url": config.base_url or os.getenv("OPENAI_BASE_URL", "") or None,
                "temperature": config.temperature,
            }
            if config.max_tokens > 0:
                kwargs["max_tokens"] = config.max_tokens
            if config.reasoning_effort and config.reasoning_effort != "default":
                kwargs["reasoning_effort"] = config.reasoning_effort
            return ChatOpenAI(**kwargs)
        else:
            from copilot_llm import build_copilot_llm
            return build_copilot_llm(
                model=config.model or "",
                temperature=config.temperature,
                max_tokens=config.max_tokens,
                reasoning_effort=config.reasoning_effort,
            )

    return llm_factory


def _build_model_catalog_provider():
    """Build a model catalog provider wrapping llm_service."""
    def provider():
        from llm_service import get_llm_service
        return get_llm_service().get_model_catalog()
    return provider


def _default_model() -> str:
    """Resolve the default model name from environment."""
    if os.getenv("AGENT_BACKEND", "").strip().lower() == "openai":
        return os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return os.getenv("COPILOT_MODEL", "gpt-4o")


# ============================================================================
# CHAT SYSTEM PROMPT (domain-specific — lives in the host, not in the module)
# ============================================================================

def build_chat_system_prompt(*, efficiency_mode: bool = True) -> str:
    """Build the default system prompt for the chat agent.

    Domain-specific (German, CSV-ticket focused) — kept in the host
    so the agent_builder module stays generic.
    """
    efficiency_rules = (
        "- Plane möglichst einen einzelnen Tool-Aufruf und stoppe früh, sobald die Antwort klar ist.\n"
        "- Nutze kleine Payloads: setze sinnvolle limits und kompakte fields.\n"
        "- Fordere notes/resolution nur bei explizitem Bedarf an.\n"
    ) if efficiency_mode else ""
    return (
        "Du bist ein präziser CSV-Ticket-Assistent. Sprich Deutsch.\n\n"
        "Verhalten:\n"
        "- Verwende ausschließlich csv_* Tools für Ticketdaten.\n"
        f"{efficiency_rules}"
        "- Erfinde keine Daten; markiere fehlende Daten klar.\n"
        "- Gib eine kurze Antwort und bei strukturierten Ergebnissen einen JSON-Codeblock "
        'mit {"rows": [...]}.'
    )


# Domain context for schema suggestion prompts
TICKET_DOMAIN_CONTEXT = (
    "The agent works with IT support/helpdesk ticket data (BMC Remedy/ITSM export). "
    "Each ticket has fields: incident_id, summary, status, priority, assignee, "
    "assigned_group, requester_name, city, created_at, updated_at, notes, resolution, description."
)


# ============================================================================
# BUILD TOOL REGISTRY
# ============================================================================

def _build_registry() -> ToolRegistry:
    """
    Populate a ToolRegistry with all tools available in this project.

    Sources:
      1. All @operation-decorated functions via api_decorators.get_langchain_tools()
         Exposed to Agent Fabric: csv_* ticket operations only.

    The registry is built once at startup and shared with services.
    """
    registry = ToolRegistry()
    try:
        all_tools = get_langchain_tools()
        ticket_tools = [
            tool for tool in all_tools
            if getattr(tool, "name", "").startswith("csv_")
        ]
        registry.register_all(ticket_tools)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not load langchain tools: %s", exc)
    return registry


# ============================================================================
# SINGLETON SERVICES
# ============================================================================

_tool_registry = _build_registry()
_llm_factory = _build_llm_factory()

workbench_service = WorkbenchService(
    tool_registry=_tool_registry,
    llm_factory=_llm_factory,
    db_path=Path(__file__).parent / "data" / "workbench.db",
    default_model=_default_model(),
    domain_context=TICKET_DOMAIN_CONTEXT,
)

chat_service = ChatService(
    tool_registry=_tool_registry,
    llm_factory=_llm_factory,
    default_model=_default_model(),
    system_prompt_builder=build_chat_system_prompt,
)

model_catalog_provider = _build_model_catalog_provider()

__all__ = ["workbench_service", "chat_service", "model_catalog_provider", "_tool_registry"]

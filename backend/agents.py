"""
Agent Management Module with OpenAI and LangGraph

Provides LangGraph-based agents for CSV ticket analysis:
- Type-safe data models with Pydantic
- OpenAI integration via langchain-openai
- ReAct agent pattern with CSV ticket tools

Note: The configurable agent builder lives in agent_builder/.
This module provides the simple chat agent used by /api/agents/run.
"""

# Standard library
import os
from datetime import datetime
from time import perf_counter
from typing import Any, Literal, Optional

# Load environment variables before anything else
from dotenv import load_dotenv

load_dotenv()

import logging

from langchain_core.globals import set_verbose


def _env_flag(name: str, default: str = "false") -> bool:
    """Parse environment boolean flags with common truthy values."""
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    """Parse integer env var with fallback."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


LANGCHAIN_VERBOSE = _env_flag("LANGCHAIN_VERBOSE", "false")
set_verbose(LANGCHAIN_VERBOSE)

logging.basicConfig(level=logging.INFO)
logging.getLogger("langchain").setLevel(logging.INFO if LANGCHAIN_VERBOSE else logging.WARNING)
logger = logging.getLogger(__name__)

from uuid import UUID

# Ensure operations register before we request LangChain tools
import operations  # noqa: F401

# Local CSV service
from csv_data import get_csv_ticket_service

from langchain_core.tools import StructuredTool

# Third-party - LangChain and LangGraph
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

# Third-party - Pydantic for validation
from pydantic import BaseModel, Field, field_validator
from tickets import TicketStatus

# ============================================================================
# DATA MODELS - Pydantic for validation and schema generation
# ============================================================================

class AgentRequest(BaseModel):
    """
    Request to run an AI agent.
    
    The agent will have access to all operations registered via @operation
    decorator, including task management (create, update, delete, list).
    """
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User prompt for the agent to process"
    )
    agent_type: Literal["task_assistant"] = Field(
        default="task_assistant",
        description="Type of agent to run (currently only task_assistant supported)"
    )
    
    @field_validator('prompt')
    @classmethod
    def prompt_not_empty(cls, v: str) -> str:
        """Ensure prompt is not just whitespace."""
        if not v.strip():
            raise ValueError('Prompt cannot be empty or whitespace')
        return v.strip()
    
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "prompt": "Create a task to learn LangGraph and list all current tasks",
                "agent_type": "task_assistant"
            }]
        }
    }


class AgentResponse(BaseModel):
    """
    Response from agent execution.
    
    Contains the agent's output, metadata about execution, and any errors.
    """
    result: str = Field(
        ...,
        description="Agent's response or output"
    )
    agent_type: str = Field(
        ...,
        description="Type of agent that was executed"
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when the agent completed"
    )
    tools_used: list[str] = Field(
        default_factory=list,
        description="List of tools/operations the agent invoked"
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if execution failed"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "result": "I've created a task titled 'Learn LangGraph' and here are your current tasks...",
                "agent_type": "task_assistant",
                "created_at": "2025-12-03T10:30:00",
                "tools_used": ["create_task", "list_tasks"],
                "error": None
            }]
        }
    }


# ============================================================================
# CONFIGURATION - OpenAI settings
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")  # optional override
OPENAI_CALL_LOGGING_ENABLED = _env_flag("OPENAI_CALL_LOGGING_ENABLED", "true")
AGENT_EFFICIENCY_MODE = _env_flag("AGENT_EFFICIENCY_MODE", "true")
AGENT_TRACE_ENABLED = _env_flag("AGENT_TRACE_ENABLED", "false")
REACT_AGENT_RECURSION_LIMIT = max(3, _env_int("REACT_AGENT_RECURSION_LIMIT", 8))

# External MCP server URL for ticket management (hardcoded)
TICKET_MCP_SERVER_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/mcp/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"


# ============================================================================
# SERVICE LAYER - Business logic for agent operations
# ============================================================================

class AgentService:
    """
    Agent service handling all LLM agent operations.
    
    Consolidated operations:
    - Agent initialization with OpenAI
    - Tool discovery from @operation registry
    - External MCP server tool integration (persistent connection)
    - ReAct agent execution with task tools
    - Response formatting and error handling
    
    This is a "deep module" - simple interface (run_agent), complex
    implementation (LangGraph setup, tool wiring, execution).
    """
    
    def __init__(self):
        """
        Initialize the agent service with OpenAI.
        
        Validates that required environment variables are set and creates
        the LLM client for agent execution.
        
        Raises:
            ValueError: If OpenAI configuration is incomplete
        """
        # Validate configuration
        if not OPENAI_API_KEY:
            raise ValueError(
                "OpenAI API key not set. "
                "Please set OPENAI_API_KEY environment variable."
            )
        
        # Initialize ChatOpenAI with JSON output mode
        self.llm = ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL or None,
            temperature=0.0,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
        
        # CSV tools only
        self.tools = self._build_csv_tools()
        self._system_prompt = self._build_system_prompt()
        # Pre-bind tools with strict=True for JSON mode compatibility
        model_with_tools = self.llm.bind_tools(self.tools, strict=True) if self.tools else self.llm
        self._react_agent = create_react_agent(model_with_tools, self.tools)
    
    def _build_system_prompt(self) -> str:
        """Build a concise system prompt optimized for low-latency tool usage."""
        efficiency_rules = (
            "- Plane möglichst einen einzelnen Tool-Aufruf und stoppe früh, sobald die Antwort klar ist.\n"
            "- Nutze kleine Payloads: setze sinnvolle limits und kompakte fields.\n"
            "- Fordere notes/resolution nur bei explizitem Bedarf an.\n"
        ) if AGENT_EFFICIENCY_MODE else ""
        return (
            "Du bist ein präziser CSV-Ticket-Assistent. Sprich Deutsch.\n\n"
            "Verhalten:\n"
            "- Verwende ausschließlich csv_* Tools für Ticketdaten.\n"
            f"{efficiency_rules}"
            "- Erfinde keine Daten; markiere fehlende Daten klar.\n"
            "- Gib eine kurze Antwort und bei strukturierten Ergebnissen einen JSON-Codeblock "
            "mit {\"rows\": [...]}."
        )

    def _build_csv_tools(self) -> list[StructuredTool]:
        """Build LangChain tools backed by CSVTicketService."""
        import json
        service = get_csv_ticket_service()
        compact_default_fields = [
            "id",
            "summary",
            "status",
            "priority",
            "assignee",
            "assigned_group",
            "created_at",
            "updated_at",
        ]

        def _select_fields(fields: str | None) -> list[str] | None:
            if not fields:
                return compact_default_fields
            normalized = fields.strip()
            if normalized in {"*", "all"}:
                return None
            parsed = [f.strip() for f in normalized.split(",") if f.strip()]
            return parsed or compact_default_fields

        def _csv_list_tickets(
            status: str | None = None,
            assigned_group: str | None = None,
            has_assignee: bool | None = None,
            fields: str | None = None,
            limit: int = 50,
        ) -> str:
            try:
                status_enum = TicketStatus(status.lower()) if status else None
            except Exception:
                status_enum = None
            tickets = service.list_tickets(status=status_enum, assigned_group=assigned_group, has_assignee=has_assignee)
            bounded_limit = max(1, min(limit, 100))
            items = tickets[:bounded_limit]
            selected_fields = _select_fields(fields)
            if selected_fields is None:
                return json.dumps([t.model_dump() for t in items], default=str)
            return json.dumps([
                {k: v for k, v in t.model_dump().items() if k in selected_fields}
                for t in items
            ], default=str)

        def _csv_get_ticket(ticket_id: str, fields: str | None = None) -> str:
            try:
                tid = UUID(ticket_id)
            except Exception:
                return json.dumps({"error": "invalid ticket id"})
            ticket = service.get_ticket(tid)
            if not ticket:
                return json.dumps({"error": "not found"})
            dump = ticket.model_dump()
            selected_fields = _select_fields(fields)
            if selected_fields is None:
                return json.dumps(dump, default=str)
            return json.dumps({k: v for k, v in dump.items() if k in selected_fields}, default=str)

        def _csv_search_tickets(query: str, fields: str | None = None, limit: int = 25) -> str:
            q = query.lower()
            tickets = service.list_tickets()
            selected_fields = _select_fields(fields)
            matched = []
            bounded_limit = max(1, min(limit, 100))
            for t in tickets:
                text = " ".join([
                    t.summary or "",
                    t.description or "",
                    t.notes or "",
                    t.resolution or "",
                    t.requester_name or "",
                    t.assigned_group or "",
                    t.city or "",
                ]).lower()
                if q in text:
                    dump = t.model_dump()
                    if selected_fields is not None:
                        dump = {k: v for k, v in dump.items() if k in selected_fields}
                    matched.append(dump)
                    if len(matched) >= bounded_limit:
                        break
            return json.dumps(matched, default=str)

        def _csv_ticket_fields() -> str:
            # Use Ticket model fields as schema
            from tickets import Ticket
            return json.dumps(list(Ticket.model_fields.keys()))

        def _csv_sla_breach_tickets(unassigned_only: bool = True, include_ok: bool = False) -> str:
            """Return tickets at SLA breach risk with pre-computed age and breach status."""
            from tickets import get_sla_breach_report
            tickets = service.list_tickets(has_assignee=False if unassigned_only else None)
            report = get_sla_breach_report(tickets)
            return json.dumps(report.model_dump(mode="json"), default=str)

        def _csv_ticket_stats() -> str:
            """Get aggregated ticket statistics."""
            stats = service.get_ticket_stats()
            return json.dumps(stats, default=str)

        return [
            StructuredTool.from_function(
                func=_csv_list_tickets,
                name="csv_list_tickets",
                description=(
                    "List tickets from CSV with optional filters: status "
                    "(new, assigned, in_progress, pending, resolved, closed, cancelled), "
                    "assigned_group, has_assignee (true/false), limit (default 50, max 100), "
                    "and fields (comma-separated field names). "
                    "Default response is compact for speed. Returns JSON array."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_get_ticket,
                name="csv_get_ticket",
                description=(
                    "Get full ticket details by UUID (id). Supports optional fields. "
                    "Use for drill-down after list/search."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_search_tickets,
                name="csv_search_tickets",
                description=(
                    "Search tickets by text across summary, description, notes, requester, group, city. "
                    "Returns compact fields. Use csv_get_ticket for full details."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_ticket_fields,
                name="csv_ticket_fields",
                description="List available ticket fields (schema) as JSON array of field names.",
            ),
            StructuredTool.from_function(
                func=_csv_sla_breach_tickets,
                name="csv_sla_breach_tickets",
                description=(
                    "Return tickets at SLA breach risk. Pre-computed age_hours, sla_threshold_hours, "
                    "breach_status. SLA thresholds: critical=4h, high=24h, medium=72h, low=120h. "
                    "Default: unassigned_only=true, include_ok=false. Returns compact JSON."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_ticket_stats,
                name="csv_ticket_stats",
                description="Get aggregated statistics: total, by_status, by_priority, by_group, by_city.",
            ),
        ]

    async def run_agent(self, request: AgentRequest) -> AgentResponse:
        """
        Run a ReAct agent with the given request using LangGraph.
        
        The agent uses a ReAct (Reasoning + Acting) loop:
        1. Receive user prompt
        2. Reason about what to do
        3. Choose and execute tools (task operations)
        4. Observe results
        5. Repeat until task is complete
        
        All @operation decorated functions are automatically available as LangGraph tools.
        LangGraph calls the Python functions directly (not via MCP).
        External MCP tools are loaded from the configured MCP server.
        
        Args:
            request: AgentRequest with prompt and agent type
            
        Returns:
            AgentResponse with agent output and metadata
            
        Raises:
            ValueError: If agent execution fails
        """
        try:
            # Execute agent with user prompt
            if AGENT_TRACE_ENABLED:
                print(f"\n{'='*60}")
                print(f"🤖 AGENT EXECUTION START")
                print(f"{'='*60}")
                print(f"   Prompt: {request.prompt[:100]}{'...' if len(request.prompt) > 100 else ''}")
                print(f"   Agent type: {request.agent_type}")
                print(f"   Available tools ({len(self.tools)}):")
                for t in self.tools:
                    name = t.name if hasattr(t, 'name') else str(t)
                    print(f"      • {name}")
                print(f"{'='*60}\n")
            
            invoke_config: dict[str, Any] = {"recursion_limit": REACT_AGENT_RECURSION_LIMIT}
            if OPENAI_CALL_LOGGING_ENABLED:
                from agent_builder.engine.callbacks import make_llm_logging_callback
                invoke_config["callbacks"] = [make_llm_logging_callback(OPENAI_MODEL)]

            result = await self._react_agent.ainvoke(
                {"messages": [("system", self._system_prompt), ("user", request.prompt)]},
                config=invoke_config,
            )
            
            if AGENT_TRACE_ENABLED:
                print(f"\n{'='*60}")
                print(f"📋 AGENT EXECUTION COMPLETE")
                print(f"{'='*60}")
                print(f"   Total messages: {len(result['messages'])}")
                for i, msg in enumerate(result["messages"]):
                    msg_type = type(msg).__name__
                    has_tool_calls = hasattr(msg, 'tool_calls') and msg.tool_calls
                    content_preview = ""
                    if hasattr(msg, 'content') and msg.content:
                        content_preview = str(msg.content)[:80] + "..." if len(str(msg.content)) > 80 else str(msg.content)
                    print(f"   [{i}] {msg_type}: {content_preview}")
                    if has_tool_calls:
                        for tc in msg.tool_calls:
                            tc_name = tc.get('name', tc) if isinstance(tc, dict) else str(tc)
                            print(f"       🔧 Tool call: {tc_name}")
                print(f"{'='*60}\n")
            
            # Extract the agent's final response
            final_message = result["messages"][-1]
            agent_output = final_message.content if hasattr(final_message, 'content') else str(final_message)
            
            # Track which tools were used
            tools_used = []
            for msg in result["messages"]:
                # Check for tool_calls attribute
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    for tc in msg.tool_calls:
                        # Extract tool name from tool call
                        if isinstance(tc, dict):
                            tools_used.append(tc.get('name', ''))
                        else:
                            tools_used.append(tc['name'] if 'name' in tc else str(tc))
                # Also check for ToolMessage type (tool results)
                elif hasattr(msg, 'type') and msg.type == 'tool':
                    if hasattr(msg, 'name'):
                        tools_used.append(msg.name)
            
            return AgentResponse(
                result=agent_output,
                agent_type=request.agent_type,
                tools_used=list(set(tools_used)),
                created_at=datetime.now()
            )
            
        except Exception as e:
            return AgentResponse(
                result="Agent execution failed. See error field for details.",
                agent_type=request.agent_type,
                error=str(e),
                created_at=datetime.now()
            )
    

# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

# Singleton service instance
# Import this in app.py: from agents import agent_service
agent_service = AgentService()

__all__ = [
    'AgentRequest',
    'AgentResponse',
    'AgentService',
    'agent_service',
]

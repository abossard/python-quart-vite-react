"""
Agent Management Module with OpenAI and LangGraph

Provides LangGraph-based agents for task automation:
- Type-safe data models with Pydantic
- Self-documenting schemas for REST and MCP
- OpenAI integration via langchain-openai
- ReAct agent pattern with automatic tool discovery

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Simple interface, complex implementation
- Separation of calculations from I/O
- Clear separation: Data models, Service layer, Agent logic

Example usage:
    from agents import AgentService, AgentRequest
    
    service = AgentService()
    result = await service.run_agent(
        AgentRequest(
            prompt="Create a task to learn LangGraph",
            agent_type="task_assistant"
        )
    )
    print(result.result)

Advanced StateGraph example (for learning):
    See the docstring in AgentService._build_state_graph() for a custom
    LangGraph workflow with nodes, edges, and conditional routing.
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

# Local - Import operations registry for automatic tool discovery
from api_decorators import get_langchain_tools

# Local CSV service
from csv_data import get_csv_ticket_service

# Third-party - FastMCP client for external MCP servers
from fastmcp import Client as MCPClient
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.tools import StructuredTool

# Third-party - LangChain and LangGraph
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

# Third-party - Pydantic for validation
from pydantic import BaseModel, Field, create_model, field_validator
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
# MCP TOOL CONVERSION HELPERS
# ============================================================================

def _json_type_to_python(json_type: str) -> type:
    """Map JSON schema type to Python type."""
    mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    return mapping.get(json_type, str)


def _schema_to_pydantic(name: str, schema: dict) -> type[BaseModel]:
    """Convert JSON schema to Pydantic model for LangChain tool args."""
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))
    
    fields: dict[str, Any] = {}
    for field_name, field_schema in properties.items():
        field_type = _json_type_to_python(field_schema.get("type", "string"))
        field_desc = field_schema.get("description", f"{field_name} parameter")
        
        if field_name in required:
            fields[field_name] = (field_type, Field(description=field_desc))
        else:
            default = field_schema.get("default")
            fields[field_name] = (Optional[field_type], Field(default=default, description=field_desc))
    
    model_name = f"{name.title().replace('_', '').replace('-', '')}Args"
    return create_model(model_name, **fields)


def _extract_llm_call_metadata(response: Any) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Extract token usage, model name, and finish reason from LLMResult-like objects."""
    token_usage: dict[str, Any] | None = None
    model_name: str | None = None
    finish_reason: str | None = None

    llm_output = getattr(response, "llm_output", None)
    if isinstance(llm_output, dict):
        maybe_usage = llm_output.get("token_usage")
        if isinstance(maybe_usage, dict):
            token_usage = maybe_usage
        maybe_model = llm_output.get("model_name")
        if isinstance(maybe_model, str):
            model_name = maybe_model

    generations = getattr(response, "generations", None) or []
    if generations and generations[0]:
        first_generation = generations[0][0]
        generation_info = getattr(first_generation, "generation_info", None)
        if isinstance(generation_info, dict):
            maybe_finish = generation_info.get("finish_reason")
            if isinstance(maybe_finish, str):
                finish_reason = maybe_finish

        message = getattr(first_generation, "message", None)
        if message is not None:
            usage_metadata = getattr(message, "usage_metadata", None)
            if isinstance(usage_metadata, dict):
                token_usage = token_usage or usage_metadata

            response_metadata = getattr(message, "response_metadata", None)
            if isinstance(response_metadata, dict):
                maybe_usage = response_metadata.get("token_usage")
                if isinstance(maybe_usage, dict):
                    token_usage = token_usage or maybe_usage

                maybe_model = response_metadata.get("model_name")
                if isinstance(maybe_model, str):
                    model_name = model_name or maybe_model

                maybe_finish = response_metadata.get("finish_reason")
                if isinstance(maybe_finish, str):
                    finish_reason = finish_reason or maybe_finish

    return token_usage, model_name, finish_reason


class OpenAICallLoggingCallback(BaseCallbackHandler):
    """Log each OpenAI/LangChain LLM call with latency and token usage at INFO level."""

    def __init__(self) -> None:
        self._start_times: dict[UUID, float] = {}

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        self._start_times[run_id] = perf_counter()
        model_name = None
        if isinstance(serialized, dict):
            model_name = (
                serialized.get("kwargs", {}).get("model")
                if isinstance(serialized.get("kwargs"), dict)
                else None
            )
        prompt_chars = sum(len(prompt or "") for prompt in prompts)
        logger.info(
            "OpenAI call start run_id=%s model=%s prompts=%d chars=%d",
            run_id,
            model_name or OPENAI_MODEL,
            len(prompts),
            prompt_chars,
        )

    def on_llm_end(
        self,
        response: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        started_at = self._start_times.pop(run_id, None)
        duration_ms = int((perf_counter() - started_at) * 1000) if started_at is not None else None
        token_usage, model_name, finish_reason = _extract_llm_call_metadata(response)
        logger.info(
            "OpenAI call end run_id=%s model=%s duration_ms=%s finish_reason=%s token_usage=%s",
            run_id,
            model_name or OPENAI_MODEL,
            duration_ms if duration_ms is not None else "n/a",
            finish_reason or "n/a",
            token_usage or {},
        )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        started_at = self._start_times.pop(run_id, None)
        duration_ms = int((perf_counter() - started_at) * 1000) if started_at is not None else None
        logger.error(
            "OpenAI call error run_id=%s duration_ms=%s error=%s",
            run_id,
            duration_ms if duration_ms is not None else "n/a",
            error,
        )


def _mcp_tool_to_langchain(mcp_client: MCPClient, tool: Any) -> StructuredTool:
    """
    Convert MCP tool to LangChain StructuredTool.
    
    Creates a wrapper that calls the external MCP server via the persistent client.
    """
    tool_name = tool.name
    tool_desc = tool.description or f"MCP tool: {tool_name}"
    input_schema = tool.inputSchema if hasattr(tool, 'inputSchema') else {}
    
    # Create async wrapper that calls MCP server
    async def call_mcp_tool(**kwargs) -> str:
        import json as _json
        print(f"\n{'='*60}")
        print(f"🔧 MCP TOOL CALL: {tool_name}")
        print(f"{'='*60}")
        print(f"📤 REQUEST:")
        print(f"   Tool: {tool_name}")
        print(f"   Args: {_json.dumps(kwargs, indent=6, default=str)}")
        
        result = await mcp_client.call_tool(tool_name, kwargs)
        
        print(f"\n📥 RESPONSE:")
        # Extract text from MCP response
        if hasattr(result, 'content') and result.content:
            texts = [c.text for c in result.content if hasattr(c, 'text')]
            response_text = "\n".join(texts) if texts else str(result)
            # Truncate for display if too long
            display_text = response_text[:500] + "..." if len(response_text) > 500 else response_text
            print(f"   Content items: {len(result.content)}")
            print(f"   Text preview: {display_text}")
        else:
            response_text = str(result)
            print(f"   Raw: {response_text[:500]}")
        
        print(f"{'='*60}\n")
        return response_text
    
    # Build Pydantic model from input schema
    args_model = _schema_to_pydantic(tool_name, input_schema)
    
    return StructuredTool(
        name=tool_name,
        description=tool_desc,
        coroutine=call_mcp_tool,
        args_schema=args_model,
    )


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
        
        # Initialize ChatOpenAI
        self.llm = ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL or None,
            temperature=0.0,
        )
        
        # CSV tools only (do not expose operations or external MCP)
        self.tools = self._build_csv_tools()
        self._system_prompt = self._build_system_prompt()
        self._react_agent = create_react_agent(self.llm, self.tools)

        # Ticket MCP client state (unused)
        self._ticket_mcp_client: Optional[MCPClient] = None
        self._ticket_mcp_tools_loaded = False
    
    async def _ensure_ticket_mcp_connection(self):
        """No-op: external MCP tools not exposed."""
        return
    
    async def close(self):
        """Close the ticket MCP client connection."""
        if self._ticket_mcp_client:
            try:
                await self._ticket_mcp_client.__aexit__(None, None, None)
            except Exception:
                pass
            self._ticket_mcp_client = None

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

        return [
            StructuredTool.from_function(
                func=_csv_list_tickets,
                name="csv_list_tickets",
                description=(
                    "List tickets from CSV with optional filters: status "
                    "(new, assigned, in_progress, pending, resolved, closed, cancelled), "
                    "assigned_group, has_assignee (true/false), limit (default 50, max 100), "
                    "and fields (comma-separated field names). "
                    "Default response is compact for speed: "
                    "'id,summary,status,priority,assignee,assigned_group,created_at,updated_at'. "
                    "For deterministic analytics, prefer status/priority/date fields and avoid wide payloads. "
                    "Notes/resolution are excluded by default unless requested via fields. "
                    "Use fields='*' only when full payload is absolutely needed. Returns JSON array."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_get_ticket,
                name="csv_get_ticket",
                description=(
                    "Get ticket by UUID (id). Supports optional fields (comma-separated). "
                    "Default response is compact fields without notes/resolution for speed. "
                    "Prefer requesting only required fields for drill-down. "
                    "Request notes/resolution explicitly via fields, or use fields='*' for full payload."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_search_tickets,
                name="csv_search_tickets",
                description=(
                    "Search tickets by text across summary, description, notes, resolution, requester, group, city. "
                    "Supports fields (comma-separated field names). "
                    "Notes/resolution are excluded by default unless requested via fields. "
                    "Prefer low limits and compact fields for latency-sensitive runs. "
                    "Default response is compact fields for speed; use fields='*' only when needed. "
                    "Returns JSON array."
                ),
            ),
            StructuredTool.from_function(
                func=_csv_ticket_fields,
                name="csv_ticket_fields",
                description="List available ticket fields (schema) as JSON array of field names.",
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
                invoke_config["callbacks"] = [OpenAICallLoggingCallback()]

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
    
    def _build_state_graph(self):
        """
        Example: Build a custom StateGraph for advanced workflows.
        
        This is a learning example showing how to build a custom LangGraph
        workflow instead of using the prebuilt create_react_agent.
        
        A StateGraph allows you to:
        - Define custom nodes (functions that process state)
        - Add conditional edges (routing logic)
        - Create multi-step workflows with loops
        - Handle complex agent architectures
        
        Example usage (not used in current implementation):
        
            from langgraph.graph import StateGraph, END
            from typing import TypedDict
            
            class AgentState(TypedDict):
                messages: list
                next_action: str
            
            # Define nodes
            def plan_node(state: AgentState):
                # Agent plans what to do
                return {"next_action": "execute"}
            
            def execute_node(state: AgentState):
                # Agent executes tools
                return {"next_action": "review"}
            
            def review_node(state: AgentState):
                # Agent reviews results
                return {"next_action": END}
            
            # Build graph
            workflow = StateGraph(AgentState)
            workflow.add_node("plan", plan_node)
            workflow.add_node("execute", execute_node)
            workflow.add_node("review", review_node)
            
            # Add edges
            workflow.set_entry_point("plan")
            workflow.add_edge("plan", "execute")
            workflow.add_edge("execute", "review")
            workflow.add_edge("review", END)
            
            # Compile
            agent = workflow.compile()
        
        For this playground, we use create_react_agent for simplicity.
        Implement StateGraph when you need custom multi-step workflows.
        """
        pass


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

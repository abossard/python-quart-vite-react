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
from typing import Any, Literal, Optional

# Load environment variables before anything else
from dotenv import load_dotenv

load_dotenv()

from uuid import UUID

# Ensure operations register before we request LangChain tools
import operations  # noqa: F401

# Local - Import operations registry for automatic tool discovery
from api_decorators import get_langchain_tools

# Local CSV service
from csv_data import get_csv_ticket_service

# Third-party - FastMCP client for external MCP servers
from fastmcp import Client as MCPClient
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
        max_length=2000,
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

    def _build_csv_tools(self) -> list[StructuredTool]:
        """Build LangChain tools backed by CSVTicketService."""
        import json
        service = get_csv_ticket_service()

        def _csv_list_tickets(status: str | None = None, assigned_group: str | None = None, has_assignee: bool | None = None) -> str:
            try:
                status_enum = TicketStatus(status.lower()) if status else None
            except Exception:
                status_enum = None
            tickets = service.list_tickets(status=status_enum, assigned_group=assigned_group, has_assignee=has_assignee)
            return json.dumps([t.model_dump() for t in tickets[:200]], default=str)

        def _csv_get_ticket(ticket_id: str) -> str:
            try:
                tid = UUID(ticket_id)
            except Exception:
                return json.dumps({"error": "invalid ticket id"})
            ticket = service.get_ticket(tid)
            if not ticket:
                return json.dumps({"error": "not found"})
            return json.dumps(ticket.model_dump(), default=str)

        def _csv_search_tickets(query: str, limit: int = 50) -> str:
            q = query.lower()
            tickets = service.list_tickets()
            matched = []
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
                    matched.append(t.model_dump())
                    if len(matched) >= limit:
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
                description="List tickets from CSV with optional filters: status (new, assigned, in_progress, pending, resolved, closed, cancelled), assigned_group, has_assignee (true/false). Returns JSON array.",
            ),
            StructuredTool.from_function(
                func=_csv_get_ticket,
                name="csv_get_ticket",
                description="Get a ticket by UUID (id). Returns JSON object including notes/resolution.",
            ),
            StructuredTool.from_function(
                func=_csv_search_tickets,
                name="csv_search_tickets",
                description="Search tickets by text across summary, description, notes, resolution, requester, group, city. Returns JSON array.",
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
            # Create ReAct agent with LangGraph tools
            # The tools are the actual Python functions with @tool decorator
            agent = create_react_agent(self.llm, self.tools)
            
            # System message to guide the agent's behavior
            system_msg = (
                "You are a support ticket management assistant. "
                "Use the CSV tools: csv_list_tickets, csv_search_tickets, csv_get_ticket, csv_ticket_fields. "
                "You MUST use the available tools to perform all actions - NEVER simulate or invent data. "
                "\n\n"
                "TICKET CAPABILITIES:\n"
                "- List tickets with filters (status, assigned_group, has_assignee)\n"
                "- Search tickets across summary/description/notes/resolution/requester/group/city\n"
                "- Get a ticket by id (UUID) including notes and resolution\n"
                "- Inspect available ticket fields (schema)\n"
                "\n"
                "When users ask about tickets, call the csv_* tools and summarize results. "
                "If a field is not present, state that explicitly. "
                "Always confirm actions based on actual tool results."
            )
            
            # Execute agent with user prompt
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
            
            result = await agent.ainvoke(
                {"messages": [("system", system_msg), ("user", request.prompt)]}
            )
            
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

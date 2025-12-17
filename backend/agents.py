"""
Agent Management Module with Azure OpenAI and LangGraph

Provides LangGraph-based agents for task automation:
- Type-safe data models with Pydantic
- Self-documenting schemas for REST and MCP
- Azure OpenAI integration via langchain-openai
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

# Local - Import operations registry for automatic tool discovery
from api_decorators import get_langchain_tools
# Third-party - FastMCP client for external MCP servers
from fastmcp import Client as MCPClient
from langchain_core.tools import StructuredTool
# Third-party - LangChain and LangGraph
from langchain_openai import AzureChatOpenAI
from langgraph.prebuilt import create_react_agent
# Third-party - Pydantic for validation
from pydantic import BaseModel, Field, create_model, field_validator

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
# CONFIGURATION - Azure OpenAI settings (hardcoded except API key)
# ============================================================================

# Azure OpenAI configuration - only API key from environment
AZURE_OPENAI_ENDPOINT = "https://can-i-haz-houze-resource.cognitiveservices.azure.com"
AZURE_OPENAI_API_KEY = os.getenv("AZURE_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = "gpt-5-mini"
AZURE_OPENAI_API_VERSION = "2025-04-01-preview"

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
        result = await mcp_client.call_tool(tool_name, kwargs)
        # Extract text from MCP response
        if hasattr(result, 'content') and result.content:
            texts = [c.text for c in result.content if hasattr(c, 'text')]
            return "\n".join(texts) if texts else str(result)
        return str(result)
    
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
    - Agent initialization with Azure OpenAI
    - Tool discovery from @operation registry
    - External MCP server tool integration (persistent connection)
    - ReAct agent execution with task tools
    - Response formatting and error handling
    
    This is a "deep module" - simple interface (run_agent), complex
    implementation (LangGraph setup, tool wiring, execution).
    """
    
    def __init__(self):
        """
        Initialize the agent service with Azure OpenAI.
        
        Validates that required environment variables are set and creates
        the LLM client for agent execution.
        
        Raises:
            ValueError: If Azure OpenAI configuration is incomplete
        """
        # Validate configuration
        if not AZURE_OPENAI_API_KEY:
            raise ValueError(
                "Azure OpenAI API key not set. "
                "Please set AZURE_API_KEY environment variable."
            )
        
        # Initialize AzureChatOpenAI with hardcoded endpoint
        self.llm = AzureChatOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,  # type: ignore
            azure_deployment=AZURE_OPENAI_DEPLOYMENT,
            api_version=AZURE_OPENAI_API_VERSION,
        )
        
        # Load LangGraph tools from operation registry
        # These are the actual Python functions decorated with @tool
        self.tools = get_langchain_tools()
        
        # Ticket MCP client state (lazy initialization)
        self._ticket_mcp_client: Optional[MCPClient] = None
        self._ticket_mcp_tools_loaded = False
    
    async def _ensure_ticket_mcp_connection(self):
        """
        Ensure ticket MCP client is connected and tools are loaded.
        
        Opens a persistent connection to the external ticket MCP server and
        converts its tools to LangChain format. Called lazily on first
        agent run.
        """
        if self._ticket_mcp_tools_loaded:
            return
        
        try:
            # Create and connect ticket MCP client (keep connection open)
            client = MCPClient(TICKET_MCP_SERVER_URL)
            await client.__aenter__()
            self._ticket_mcp_client = client
            
            # Fetch and convert ticket MCP tools
            mcp_tools = await client.list_tools()
            for tool in mcp_tools:
                lc_tool = _mcp_tool_to_langchain(client, tool)
                self.tools.append(lc_tool)
            
            print(f"DEBUG: Loaded {len(mcp_tools)} ticket tools from MCP server {TICKET_MCP_SERVER_URL}")
            self._ticket_mcp_tools_loaded = True
            
        except Exception as e:
            print(f"WARNING: Failed to load ticket MCP tools from {TICKET_MCP_SERVER_URL}: {e}")
            # Continue without ticket MCP tools - local tools still work
    
    async def close(self):
        """Close the ticket MCP client connection."""
        if self._ticket_mcp_client:
            try:
                await self._ticket_mcp_client.__aexit__(None, None, None)
            except Exception:
                pass
            self._ticket_mcp_client = None
    
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
        # Ensure ticket MCP tools are loaded (lazy initialization)
        await self._ensure_ticket_mcp_connection()
        
        try:
            # Create ReAct agent with LangGraph tools
            # The tools are the actual Python functions with @tool decorator
            agent = create_react_agent(self.llm, self.tools)
            
            # System message to guide the agent's behavior
            system_msg = (
                "You are a helpful task management assistant. "
                "You MUST use the available tools to perform all actions. "
                "NEVER pretend or simulate creating, updating, or listing tasks - you MUST call the actual tools. "
                "Available tools: create_task, update_task, delete_task, list_tasks, get_task, get_task_stats. "
                "When asked to create tasks, call create_task for each one. "
                "When asked to list tasks, call list_tasks. "
                "Always use tools and confirm what you've done based on the tool results."
            )
            
            # Execute agent with user prompt
            print(f"DEBUG: Running agent with {len(self.tools)} tools")
            print(f"DEBUG: Tools: {[t.name if hasattr(t, 'name') else str(t) for t in self.tools]}")
            
            result = await agent.ainvoke(
                {"messages": [("system", system_msg), ("user", request.prompt)]}
            )
            
            print(f"DEBUG: Agent result messages: {len(result['messages'])}")
            for i, msg in enumerate(result["messages"]):
                print(f"DEBUG: Message {i}: type={type(msg).__name__}, has_tool_calls={hasattr(msg, 'tool_calls')}")
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    print(f"DEBUG:   Tool calls: {msg.tool_calls}")
            
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

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
import re
from datetime import datetime
from typing import Any, Literal, Optional

# Load environment variables before anything else
from dotenv import load_dotenv

load_dotenv()

# Ensure operations register before we request LangChain tools
import operations  # noqa: F401

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
# TICKET ANALYSIS HELPERS - Pure calculations for ticket splitting logic
# ============================================================================

def _detect_multiple_issues(description: str) -> tuple[bool, list[str]]:
    """
    Detect if a ticket description contains multiple unrelated issues.
    
    Returns:
        (should_split, list_of_identified_issues)
    
    Detection patterns:
    - Multiple numbered or bulleted points
    - Conjunction words separating distinct issues (and, also, und, auch)
    - Multiple product/service mentions
    - Different technical domains (VPN, printer, software, phone)
    """
    if not description or len(description.strip()) < 20:
        return (False, [])
    
    issues = []
    
    # Pattern 1: Explicit separators like "und", "and", "auch", "also"
    separator_pattern = r'(?:und|and|auch|also|außerdem|zusätzlich)\s+'
    parts = re.split(separator_pattern, description, flags=re.IGNORECASE)
    
    # Pattern 2: Multiple technical keywords indicate different issues
    technical_keywords = {
        'vpn': ['vpn', 'verbindung', 'connection', 'netzwerk', 'network'],
        'printer': ['drucker', 'printer', 'toner', 'drucken', 'print'],
        'software': ['software', 'app', 'programm', 'center', 'installation'],
        'phone': ['natel', 'phone', 'handy', 'mobile', 'akku', 'battery'],
        'email': ['outlook', 'email', 'mail', 'postfach', 'mailbox'],
        'password': ['passwort', 'password', 'kennwort', 'zugang', 'access'],
        'hardware': ['maus', 'mouse', 'tastatur', 'keyboard', 'bildschirm', 'monitor', 'screen']
    }
    
    found_categories = []
    desc_lower = description.lower()
    for category, keywords in technical_keywords.items():
        if any(kw in desc_lower for kw in keywords):
            found_categories.append(category)
    
    # If 2+ distinct technical categories found, likely multiple issues
    if len(found_categories) >= 2:
        # Try to extract individual issues
        # Split on common separators and newlines
        potential_issues = re.split(r'[.!?]\s+|\n+', description)
        potential_issues = [iss.strip() for iss in potential_issues if len(iss.strip()) > 15]
        
        # Group by technical category
        categorized_issues = {}
        for issue in potential_issues:
            issue_lower = issue.lower()
            for category, keywords in technical_keywords.items():
                if any(kw in issue_lower for kw in keywords):
                    if category not in categorized_issues:
                        categorized_issues[category] = []
                    categorized_issues[category].append(issue)
                    break
        
        # If we have multiple categories with distinct issues, recommend split
        if len(categorized_issues) >= 2:
            issues = ['. '.join(cat_issues) for cat_issues in categorized_issues.values()]
            return (True, issues)
    
    # Pattern 3: Numbered/bulleted lists
    numbered_pattern = r'^\s*\d+[\.)]\s+'
    bullet_pattern = r'^\s*[-•*]\s+'
    lines = description.split('\n')
    numbered_items = [line for line in lines if re.match(numbered_pattern, line)]
    bullet_items = [line for line in lines if re.match(bullet_pattern, line)]
    
    if len(numbered_items) >= 2 or len(bullet_items) >= 2:
        items = numbered_items if numbered_items else bullet_items
        issues = [re.sub(r'^\s*[\d\.)•*-]+\s*', '', item).strip() for item in items]
        return (True, issues)
    
    return (False, [])


def _generate_split_summary(original_summary: str, issues: list[str]) -> list[str]:
    """
    Generate individual ticket summaries from detected issues.
    
    Args:
        original_summary: Original ticket summary
        issues: List of detected issue descriptions
    
    Returns:
        List of new ticket summaries
    """
    summaries = []
    
    # Extract key terms from each issue
    for issue in issues:
        # Try to identify the main subject
        issue_lower = issue.lower()
        
        # Check for known technical terms
        if any(term in issue_lower for term in ['vpn', 'verbindung', 'connection']):
            summaries.append("VPN Connection Issue")
        elif any(term in issue_lower for term in ['drucker', 'printer', 'toner']):
            summaries.append("Printer Issue")
        elif any(term in issue_lower for term in ['software', 'center', 'app', 'installation']):
            summaries.append("Software Installation Issue")
        elif any(term in issue_lower for term in ['natel', 'phone', 'handy', 'akku', 'battery']):
            summaries.append("Mobile Device Issue")
        elif any(term in issue_lower for term in ['outlook', 'email', 'mail']):
            summaries.append("Email Issue")
        elif any(term in issue_lower for term in ['passwort', 'password', 'zugang']):
            summaries.append("Password/Access Issue")
        else:
            # Use first significant words from issue
            words = issue.split()[:5]
            summaries.append(' '.join(words))
    
    return summaries


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
            print(f"\n{'='*60}")
            print(f"🎫 TICKET MCP SERVER CONNECTED")
            print(f"{'='*60}")
            print(f"   URL: {TICKET_MCP_SERVER_URL}")
            print(f"   Tools available: {len(mcp_tools)}")
            for tool in mcp_tools:
                lc_tool = _mcp_tool_to_langchain(client, tool)
                self.tools.append(lc_tool)
                print(f"   ✓ {tool.name}: {(tool.description or '')[:60]}...")
            print(f"{'='*60}\n")
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
    
    async def analyze_and_split_ticket(self, ticket_id: str, ticket_data: dict) -> dict:
        """
        Analyze a ticket and split it into multiple tickets if needed.
        
        This method:
        1. Analyzes the ticket description for multiple issues
        2. If multiple issues detected, creates separate tickets
        3. Adds a modification request to the original ticket
        4. Returns summary of actions taken
        
        Args:
            ticket_id: The ID of the ticket to analyze
            ticket_data: Full ticket data including description, requester, etc.
        
        Returns:
            Dictionary with analysis results and actions taken
        """
        description = ticket_data.get('description', '')
        summary = ticket_data.get('summary', '')
        
        # Detect multiple issues
        should_split, issues = _detect_multiple_issues(description)
        
        if not should_split or len(issues) < 2:
            return {
                'should_split': False,
                'reason': 'Single issue detected',
                'original_ticket_id': ticket_id
            }
        
        # Generate summaries for new tickets
        new_summaries = _generate_split_summary(summary, issues)
        
        # Ensure ticket MCP connection
        await self._ensure_ticket_mcp_connection()
        
        if not self._ticket_mcp_client:
            return {
                'should_split': True,
                'error': 'Ticket MCP client not available',
                'detected_issues': issues
            }
        
        # Create new tickets for each issue
        created_tickets = []
        for i, (issue_desc, issue_summary) in enumerate(zip(issues, new_summaries), 1):
            try:
                # Extract requester info from original ticket
                new_ticket_data = {
                    'summary': issue_summary,
                    'description': issue_desc,
                    'city': ticket_data.get('city'),
                    'requester_name': ticket_data.get('requester_name'),
                    'requester_email': ticket_data.get('requester_email'),
                    'requester_department': ticket_data.get('requester_department'),
                    'priority': ticket_data.get('priority', 'medium'),
                    'status': 'new',
                }
                
                # Determine service based on issue content
                issue_lower = issue_desc.lower()
                if any(term in issue_lower for term in ['vpn', 'network', 'verbindung']):
                    new_ticket_data['service'] = 'Network Services'
                elif any(term in issue_lower for term in ['drucker', 'printer']):
                    new_ticket_data['service'] = 'Infrastructure'
                elif any(term in issue_lower for term in ['software', 'app', 'center']):
                    new_ticket_data['service'] = 'Workplace'
                elif any(term in issue_lower for term in ['natel', 'phone', 'handy']):
                    new_ticket_data['service'] = 'Communication'
                else:
                    new_ticket_data['service'] = ticket_data.get('service', 'Workplace')
                
                # Call MCP tool to create ticket
                result = await self._ticket_mcp_client.call_tool('create_ticket', new_ticket_data)
                
                # Extract ticket ID from result
                if hasattr(result, 'content') and result.content:
                    import json
                    content_text = result.content[0].text if result.content else '{}'
                    result_data = json.loads(content_text)
                    new_ticket_id = result_data.get('ticket', {}).get('id', f'ticket_{i}')
                    created_tickets.append({
                        'id': new_ticket_id,
                        'summary': issue_summary,
                        'description': issue_desc[:100]
                    })
            except Exception as e:
                print(f"Error creating ticket {i}: {e}")
                created_tickets.append({
                    'error': str(e),
                    'summary': issue_summary
                })
        
        # Add modification request to original ticket
        try:
            modification_notes = f"This ticket contained {len(issues)} separate issues that have been split:\n\n"
            for i, ticket in enumerate(created_tickets, 1):
                if 'id' in ticket:
                    modification_notes += f"{i}. {ticket['summary']} (Ticket ID: {ticket['id']})\n"
                else:
                    modification_notes += f"{i}. {ticket['summary']} (Failed to create)\n"
            
            modification_notes += "\nOriginal ticket can be closed or used for coordination."
            
            await self._ticket_mcp_client.call_tool('add_modification', {
                'ticket_id': ticket_id,
                'field_name': 'notes',
                'proposed_value': modification_notes,
                'reason': f'Ticket split into {len(issues)} separate issues for proper tracking',
                'requested_by': 'Automated Ticket Analyzer'
            })
        except Exception as e:
            print(f"Error adding modification: {e}")
        
        return {
            'should_split': True,
            'original_ticket_id': ticket_id,
            'detected_issues_count': len(issues),
            'created_tickets': created_tickets,
            'modification_added': True
        }
    
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
                "You are a support ticket management assistant. "
                "Your primary role is to help users manage, search, and evaluate support tickets. "
                "You MUST use the available tools to perform all actions - NEVER simulate or pretend. "
                "\n\n"
                "TICKET CAPABILITIES:\n"
                "- Search and list tickets by status, priority, city, service\n"
                "- Get detailed ticket information and work logs\n"
                "- Analyze ticket statistics and trends\n"
                "- Request modifications to tickets (status, priority, assignee, etc.)\n"
                "- Review and approve/reject modification requests\n"
                "- **IMPORTANT**: Detect tickets with multiple unrelated issues and split them\n"
                "\n"
                "TICKET SPLITTING WORKFLOW:\n"
                "When you encounter a ticket with multiple distinct issues (VPN + Printer, Software + Phone, etc.):\n"
                "1. Identify each separate issue in the description\n"
                "2. Use create_ticket to create individual tickets for each issue\n"
                "3. Use add_modification to note the split on the original ticket\n"
                "4. Inform the user about the split tickets created\n"
                "\n"
                "TASK CAPABILITIES:\n"
                "- Create, update, delete, and list tasks\n"
                "- Get task statistics\n"
                "\n"
                "When users ask about tickets, use the ticket tools (list_tickets, get_ticket, search_tickets, etc.). "
                "When users ask about tasks, use task tools (create_task, list_tasks, etc.). "
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
    '_detect_multiple_issues',
    '_generate_split_summary',
]

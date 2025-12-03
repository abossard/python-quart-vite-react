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

import json

# Standard library
import os
from datetime import datetime
from typing import Literal, Optional

# Local - Import operations registry for automatic tool discovery
from api_decorators import get_operations

# Third-party - OpenAI SDK
from openai import OpenAI

# Third-party - Pydantic for validation
from pydantic import BaseModel, Field, field_validator

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
# CONFIGURATION - Azure OpenAI settings from environment
# ============================================================================

# Azure OpenAI configuration
# These should be set in .env file (see .env.example)
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")


# ============================================================================
# SERVICE LAYER - Business logic for agent operations
# ============================================================================

class AgentService:
    """
    Agent service handling all LLM agent operations.
    
    Consolidated operations:
    - Agent initialization with Azure OpenAI
    - Tool discovery from @operation registry
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
        if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY:
            raise ValueError(
                "Azure OpenAI configuration is incomplete. "
                "Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY "
                "environment variables. See .env.example for template."
            )
        
        # Initialize OpenAI client with Azure endpoint
        self.client = OpenAI(
            base_url=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
        )
        self.model = AZURE_OPENAI_DEPLOYMENT
        
        # Load tools from operation registry
        # These are automatically generated from @operation decorated functions
        self.tools = self._get_tools_for_openai()
    
    def _get_tools_for_openai(self) -> list[dict]:
        """Convert operations to OpenAI function calling format."""
        operations = get_operations()
        tools = []
        
        for op_name, op in operations.items():
            # Get the input schema from the operation
            input_schema = op.get_mcp_input_schema()
            
            # Convert operation to OpenAI tool schema
            tool_def = {
                "type": "function",
                "function": {
                    "name": op.name,
                    "description": op.description or "",
                    "parameters": input_schema
                }
            }
            
            tools.append(tool_def)
        
        return tools
    
    async def run_agent(self, request: AgentRequest) -> AgentResponse:
        """
        Run a ReAct agent with the given request using native OpenAI SDK.
        
        The agent uses a ReAct (Reasoning + Acting) loop:
        1. Receive user prompt
        2. Reason about what to do
        3. Choose and execute tools (task operations)
        4. Observe results
        5. Repeat until task is complete
        
        All @operation decorated functions are automatically available as tools.
        
        Args:
            request: AgentRequest with prompt and agent type
            
        Returns:
            AgentResponse with agent output and metadata
            
        Raises:
            ValueError: If agent execution fails
        """
        try:
            # System message to guide the agent's behavior
            system_msg = (
                "You are a helpful task management assistant. "
                "You can create, update, delete, and list tasks. "
                "When asked to create tasks, use descriptive titles. "
                "Always confirm what you've done and show the results."
            )
            
            messages: list = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": request.prompt}
            ]
            
            tools_used = []
            max_iterations = 10
            
            # ReAct loop
            for _ in range(max_iterations):
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,  # type: ignore
                    tools=self.tools,  # type: ignore
                    tool_choice="auto"
                )
                
                message = response.choices[0].message
                
                # Convert message to dict for appending
                message_dict: dict = {"role": "assistant", "content": message.content or ""}
                if message.tool_calls:
                    message_dict["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": tc.type,
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}  # type: ignore
                        } for tc in message.tool_calls
                    ]
                messages.append(message_dict)
                
                # If no tool calls, we're done
                if not message.tool_calls:
                    break
                
                # Execute tool calls
                for tool_call in message.tool_calls:
                    function_name = tool_call.function.name  # type: ignore
                    tools_used.append(function_name)
                    
                    try:
                        # Parse arguments
                        arguments = json.loads(tool_call.function.arguments)  # type: ignore
                        
                        # Find and execute the operation
                        operations = get_operations()
                        operation = operations.get(function_name)
                        
                        if operation:
                            result = await operation.handler(**arguments)
                            result_str = json.dumps(result.model_dump() if hasattr(result, 'model_dump') else result)
                        else:
                            result_str = json.dumps({"error": f"Unknown tool: {function_name}"})
                    
                    except Exception as e:
                        result_str = json.dumps({"error": str(e)})
                    
                    # Add tool result to messages
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str
                    })
            
            # Get final response
            last_msg = messages[-1]
            final_content = last_msg.get("content", "") if isinstance(last_msg, dict) else str(last_msg)
            
            return AgentResponse(
                result=final_content,
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

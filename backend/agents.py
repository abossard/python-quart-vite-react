"""
Agent Framework Module

Modular AI agent system for task analysis and insights:
- Type-safe agent requests/responses with Pydantic
- Registry pattern for extensible agent types
- Self-documenting schemas for REST and MCP
- Deep module: Simple interface, complex orchestration

Following "A Philosophy of Software Design":
- BaseAgent provides clear abstraction for implementations
- AgentService consolidates registration, validation, execution
- Each agent type lives in its own file for clarity

Architecture:
- agents.py: Framework (this file)
- task_overview_agent.py: Specific agent implementation
- app.py: REST/MCP exposure via @operation decorator
"""

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================================
# DATA MODELS - Pydantic for validation and schema generation
# ============================================================================

class AgentType(str, Enum):
    """
    Available agent types.
    
    Each agent type maps to a specific implementation.
    Easily extensible - just add new enum values and register implementations.
    """
    TASK_OVERVIEW = "task_overview"
    # Future agents can be added here:
    # TASK_INSIGHTS = "task_insights"
    # TASK_DESCRIPTION_GENERATOR = "task_description_generator"
    # COMPLETION_PREDICTOR = "completion_predictor"


class AgentRequest(BaseModel):
    """
    Request to execute an AI agent.
    
    Provides agent type, optional context data, and configuration options.
    """
    agent_type: AgentType = Field(
        ...,
        description="Type of agent to execute"
    )
    context_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional context data for the agent (agent-specific format)"
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional configuration (model, temperature, max_tokens, etc.)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "agent_type": "task_overview",
                "context_data": {},
                "options": {
                    "model": "llama3.2:1b",
                    "temperature": 0.4
                }
            }]
        }
    }


class AgentMetadata(BaseModel):
    """Metadata about agent execution."""
    agent_type: str = Field(..., description="Type of agent executed")
    model: Optional[str] = Field(None, description="LLM model used (if applicable)")
    duration_ms: Optional[int] = Field(None, description="Execution duration in milliseconds")
    tokens_used: Optional[int] = Field(None, description="Number of tokens generated")
    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="Execution timestamp"
    )


class AgentResponse(BaseModel):
    """
    Response from agent execution.
    
    Contains the generated result and execution metadata.
    """
    result: str = Field(..., description="Agent execution result (formatted text)")
    metadata: AgentMetadata = Field(..., description="Execution metadata")
    success: bool = Field(default=True, description="Whether execution succeeded")
    error: Optional[str] = Field(None, description="Error message if execution failed")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "result": "You have 3 tasks total: 1 completed, 2 pending. Recent focus on learning activities.",
                "metadata": {
                    "agent_type": "task_overview",
                    "model": "llama3.2:1b",
                    "duration_ms": 1250,
                    "timestamp": "2025-11-26T12:00:00"
                },
                "success": True
            }]
        }
    }


# ============================================================================
# AGENT INTERFACE
# ============================================================================

class BaseAgent(ABC):
    """
    Abstract base class for all agents.
    
    Each agent implementation must:
    - Implement execute() method
    - Return formatted string result
    - Handle its own error cases
    
    This provides a clean interface while allowing diverse implementations.
    """

    @abstractmethod
    async def execute(self, context: dict[str, Any], options: dict[str, Any]) -> str:
        """
        Execute the agent with given context and options.
        
        Args:
            context: Agent-specific context data
            options: Configuration options (model, temperature, etc.)
            
        Returns:
            Formatted result string
            
        Raises:
            ValueError: For validation errors or missing dependencies
            Exception: For other execution errors
        """
        pass

    def get_default_options(self) -> dict[str, Any]:
        """
        Get default options for this agent.
        
        Can be overridden by subclasses to provide agent-specific defaults.
        """
        return {
            "model": "llama3.2:1b",
            "temperature": 0.4
        }


# ============================================================================
# AGENT SERVICE - Registry and execution
# ============================================================================

class AgentService:
    """
    Agent service with registry pattern.
    
    Deep module consolidating:
    - Agent registration and lookup
    - Request validation
    - Execution orchestration
    - Error handling and metadata tracking
    
    Single interface for all agent operations - no need for multiple helper functions.
    """

    # Class-level registry mapping agent types to implementations
    _agents: dict[AgentType, BaseAgent] = {}

    @classmethod
    def register(cls, agent_type: AgentType, agent: BaseAgent) -> None:
        """
        Register an agent implementation.
        
        Called during app initialization to map agent types to implementations.
        
        Args:
            agent_type: The agent type enum value
            agent: Agent implementation instance
        """
        cls._agents[agent_type] = agent

    @classmethod
    def get_agent(cls, agent_type: AgentType) -> Optional[BaseAgent]:
        """Get registered agent by type. Returns None if not found."""
        return cls._agents.get(agent_type)

    @classmethod
    def list_available_agents(cls) -> list[str]:
        """List all registered agent types."""
        return [agent_type.value for agent_type in cls._agents.keys()]

    @classmethod
    async def execute_agent(cls, request: AgentRequest) -> AgentResponse:
        """
        Execute an agent request with full orchestration.
        
        Consolidated operation:
        - Validates agent type is registered
        - Retrieves agent implementation
        - Merges default and provided options
        - Executes agent with timing
        - Builds response with metadata
        - Handles errors gracefully
        
        Args:
            request: Validated AgentRequest
            
        Returns:
            AgentResponse with result and metadata
        """
        start_time = datetime.now()

        try:
            # Lookup agent
            agent = cls.get_agent(request.agent_type)
            if not agent:
                return AgentResponse(
                    result="",
                    metadata=AgentMetadata(
                        agent_type=request.agent_type.value,
                        timestamp=start_time
                    ),
                    success=False,
                    error=f"Agent type '{request.agent_type.value}' not registered. Available: {cls.list_available_agents()}"
                )

            # Merge options with defaults
            options = {**agent.get_default_options(), **request.options}

            # Execute agent
            result = await agent.execute(request.context_data, options)

            # Calculate duration
            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            # Build metadata
            metadata = AgentMetadata(
                agent_type=request.agent_type.value,
                model=options.get("model"),
                duration_ms=duration_ms,
                tokens_used=None,  # Can be populated by agent if available
                timestamp=start_time
            )

            return AgentResponse(
                result=result,
                metadata=metadata,
                success=True
            )

        except ValueError as e:
            # Validation or dependency errors
            return AgentResponse(
                result="",
                metadata=AgentMetadata(
                    agent_type=request.agent_type.value,
                    timestamp=start_time
                ),
                success=False,
                error=str(e)
            )

        except Exception as e:
            # Unexpected errors
            return AgentResponse(
                result="",
                metadata=AgentMetadata(
                    agent_type=request.agent_type.value,
                    timestamp=start_time
                ),
                success=False,
                error=f"Agent execution failed: {str(e)}"
            )


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

__all__ = [
    'AgentType',
    'AgentRequest',
    'AgentResponse',
    'AgentMetadata',
    'BaseAgent',
    'AgentService'
]

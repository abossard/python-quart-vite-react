"""
Agent Builder — Chat Models

Data definitions for the simple agent chat interface.
Pure data — no behavior, no I/O.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AgentRequest(BaseModel):
    """Request to run an AI agent."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User prompt for the agent to process",
    )
    agent_type: Literal["task_assistant"] = Field(
        default="task_assistant",
        description="Type of agent to run",
    )

    @field_validator("prompt")
    @classmethod
    def prompt_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Prompt cannot be empty or whitespace")
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prompt": "Create a task to learn LangGraph and list all current tasks",
                    "agent_type": "task_assistant",
                }
            ]
        }
    }


class AgentResponse(BaseModel):
    """Response from agent execution."""
    result: str = Field(..., description="Agent's response or output")
    agent_type: str = Field(..., description="Type of agent that was executed")
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when the agent completed",
    )
    tools_used: list[str] = Field(
        default_factory=list,
        description="List of tools/operations the agent invoked",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if execution failed",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "result": "I've created a task titled 'Learn LangGraph'...",
                    "agent_type": "task_assistant",
                    "created_at": "2025-12-03T10:30:00",
                    "tools_used": ["create_task", "list_tasks"],
                    "error": None,
                }
            ]
        }
    }

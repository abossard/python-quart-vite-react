"""
Agent Builder — Thread Models

Data definitions for multi-turn conversation threads.
Pure data — no behavior, no I/O.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ThreadStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


class ConversationThread(BaseModel):
    """A multi-turn conversation with an agent."""

    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    title: str = Field(default="")
    status: str = Field(default=ThreadStatus.ACTIVE.value)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "title": self.title,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ThreadMessage(BaseModel):
    """One message in a conversation thread."""

    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    thread_id: str
    role: str = Field(default=MessageRole.USER.value)
    content: str = Field(default="")
    tool_call_id: Optional[str] = Field(default=None)
    tool_name: Optional[str] = Field(default=None)
    message_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "thread_id": self.thread_id,
            "role": self.role,
            "content": self.content,
            "tool_call_id": self.tool_call_id,
            "tool_name": self.tool_name,
            "metadata": self.message_metadata,
            "created_at": self.created_at.isoformat(),
        }


# --- Request models ---

class ThreadCreate(BaseModel):
    agent_id: str
    title: str = ""


class ThreadMessageCreate(BaseModel):
    message: str = Field(max_length=10000)

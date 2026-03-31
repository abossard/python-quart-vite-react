"""
Agent Builder — Thread Models

Data definitions for multi-turn conversation threads.
Pure data — no behavior, no I/O.
"""

import json
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SField, SQLModel, String


class ThreadStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


class ConversationThread(SQLModel, table=True):
    """A multi-turn conversation with an agent."""
    __tablename__ = "workbench_threads"

    id: str = SField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    agent_id: str = SField(foreign_key="workbench_agent_definitions.id", index=True)
    title: str = SField(default="")
    status: str = SField(default=ThreadStatus.ACTIVE.value)
    created_at: datetime = SField(default_factory=datetime.now)
    updated_at: datetime = SField(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "title": self.title,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ThreadMessage(SQLModel, table=True):
    """One message in a conversation thread."""
    __tablename__ = "workbench_thread_messages"

    id: str = SField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    thread_id: str = SField(foreign_key="workbench_threads.id", index=True)
    role: str = SField(default=MessageRole.USER.value)
    content: str = SField(default="")
    tool_call_id: Optional[str] = SField(default=None)
    tool_name: Optional[str] = SField(default=None)
    metadata_json: str = SField(
        default="{}",
        sa_column=Column(String, name="message_metadata"),
    )
    created_at: datetime = SField(default_factory=datetime.now)

    @property
    def message_metadata(self) -> dict[str, Any]:
        try:
            raw = json.loads(self.metadata_json)
            return raw if isinstance(raw, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    @message_metadata.setter
    def message_metadata(self, value: dict[str, Any]) -> None:
        self.metadata_json = json.dumps(value)

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

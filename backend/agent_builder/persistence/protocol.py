"""
Agent Builder — Repository Protocol

Abstract interface for agent builder storage. Implement this protocol
for any database backend (SQLite, PostgreSQL, etc.).
"""

from typing import Optional, Protocol, runtime_checkable

from ..models import (
    AgentDefinition,
    AgentEvaluation,
    AgentRun,
    ConversationThread,
    ThreadMessage,
)


@runtime_checkable
class RepositoryProtocol(Protocol):
    """Abstract repository interface for agent builder persistence."""

    # ----- Agent Definitions -----

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition: ...

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]: ...

    def list_agents(self) -> list[AgentDefinition]: ...

    def update_agent(self, agent: AgentDefinition) -> AgentDefinition: ...

    def delete_agent(self, agent_id: str) -> bool: ...

    # ----- Runs -----

    def create_run(self, run: AgentRun) -> AgentRun: ...

    def get_run(self, run_id: str) -> Optional[AgentRun]: ...

    def list_runs(self, agent_id: Optional[str] = None, limit: int = 50) -> list[AgentRun]: ...

    def update_run(self, run_id: str, **fields) -> Optional[AgentRun]: ...

    def delete_all_runs(self) -> int: ...

    # ----- Evaluations -----

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]: ...

    def upsert_evaluation(self, run_id: str, **fields) -> AgentEvaluation: ...

    # ----- Threads -----

    def create_thread(self, thread: ConversationThread) -> ConversationThread: ...

    def get_thread(self, thread_id: str) -> Optional[ConversationThread]: ...

    def list_threads(self, agent_id: Optional[str] = None, limit: int = 50) -> list[ConversationThread]: ...

    def update_thread(self, thread_id: str, **fields) -> Optional[ConversationThread]: ...

    def delete_thread(self, thread_id: str) -> bool: ...

    # ----- Thread Messages -----

    def add_message(self, message: ThreadMessage) -> ThreadMessage: ...

    def get_messages(self, thread_id: str, limit: int = 200) -> list[ThreadMessage]: ...

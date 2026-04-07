"""
Agent Builder — Persistence

Repository protocol and implementations for agent builder storage.
"""

from .protocol import RepositoryProtocol
from .sqlite import SqliteRepository

# Backward-compatible alias
AgentRepository = SqliteRepository

__all__ = ["AgentRepository", "RepositoryProtocol", "SqliteRepository"]
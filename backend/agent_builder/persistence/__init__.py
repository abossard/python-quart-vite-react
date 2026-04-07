"""
Agent Builder — Persistence

Repository protocol for agent builder storage.
Import concrete implementations directly:
    from agent_builder.persistence.sqlite import SqliteRepository
    from agent_builder.persistence.postgres import PostgresRepository
"""

from .protocol import RepositoryProtocol

__all__ = ["RepositoryProtocol"]
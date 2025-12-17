"""
Reminder Outbox - SQLite persistence for sent reminders

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Simple interface hiding SQLite complexity
- Separation: Pydantic models (data), DB functions (actions), pure helpers (calculations)

Schema stored in: backend/data/reminder_outbox.db
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class OutboxEntry(BaseModel):
    """A sent reminder stored in the outbox."""

    id: UUID = Field(..., description="Unique outbox entry ID")
    ticket_id: UUID = Field(..., description="The ticket this reminder was for")
    recipient: str = Field(..., description="Email recipient (group lead)")
    markdown_content: str = Field(..., description="The reminder message content")
    sent_at: datetime = Field(..., description="When the reminder was sent")

    model_config = {"from_attributes": True}


class OutboxCreate(BaseModel):
    """Data required to create an outbox entry."""

    ticket_id: UUID = Field(..., description="The ticket this reminder is for")
    recipient: str = Field(..., max_length=500, description="Email recipient")
    markdown_content: str = Field(..., description="The reminder message content")


# ============================================================================
# DATABASE PATH
# ============================================================================

_DB_PATH: Path = Path(__file__).parent / "data" / "reminder_outbox.db"


def get_db_path() -> Path:
    """Get the database file path."""
    return _DB_PATH


def set_db_path(path: Path) -> None:
    """Set the database file path (useful for testing)."""
    global _DB_PATH
    _DB_PATH = path


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================


def init_outbox_db() -> None:
    """
    Initialize the outbox database, creating table and indexes if not exists.
    
    Should be called at application startup.
    """
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reminder_outbox (
                id TEXT PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                recipient TEXT NOT NULL,
                markdown_content TEXT NOT NULL,
                sent_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_outbox_ticket 
            ON reminder_outbox(ticket_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_outbox_sent_at 
            ON reminder_outbox(sent_at DESC)
        """)
        conn.commit()


# ============================================================================
# DATABASE OPERATIONS (Actions)
# ============================================================================


def save_sent_reminder(
    ticket_id: UUID,
    recipient: str,
    markdown_content: str,
    sent_at: Optional[datetime] = None,
) -> OutboxEntry:
    """
    Save a sent reminder to the outbox.
    
    Args:
        ticket_id: The ticket the reminder was for
        recipient: Email address of the recipient
        markdown_content: The reminder message
        sent_at: When it was sent (defaults to now)
        
    Returns:
        The created OutboxEntry with generated ID
    """
    entry_id = uuid4()
    if sent_at is None:
        sent_at = datetime.now(tz=timezone.utc)

    with sqlite3.connect(get_db_path()) as conn:
        conn.execute(
            """
            INSERT INTO reminder_outbox (id, ticket_id, recipient, markdown_content, sent_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(entry_id),
                str(ticket_id),
                recipient,
                markdown_content,
                sent_at.isoformat(),
            ),
        )
        conn.commit()

    return OutboxEntry(
        id=entry_id,
        ticket_id=ticket_id,
        recipient=recipient,
        markdown_content=markdown_content,
        sent_at=sent_at,
    )


def get_outbox_entries(limit: int = 50) -> list[OutboxEntry]:
    """
    Get recent outbox entries, ordered by sent_at descending.
    
    Args:
        limit: Maximum number of entries to return
        
    Returns:
        List of OutboxEntry objects
    """
    with sqlite3.connect(get_db_path()) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            """
            SELECT id, ticket_id, recipient, markdown_content, sent_at
            FROM reminder_outbox
            ORDER BY sent_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()

    return [_row_to_entry(row) for row in rows]


def get_entries_for_ticket(ticket_id: UUID) -> list[OutboxEntry]:
    """
    Get all outbox entries for a specific ticket.
    
    Args:
        ticket_id: The ticket to get entries for
        
    Returns:
        List of OutboxEntry objects for the ticket
    """
    with sqlite3.connect(get_db_path()) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            """
            SELECT id, ticket_id, recipient, markdown_content, sent_at
            FROM reminder_outbox
            WHERE ticket_id = ?
            ORDER BY sent_at DESC
            """,
            (str(ticket_id),),
        )
        rows = cursor.fetchall()

    return [_row_to_entry(row) for row in rows]


# ============================================================================
# PURE HELPERS (Calculations)
# ============================================================================


def _row_to_entry(row: sqlite3.Row) -> OutboxEntry:
    """Pure function: Convert SQLite row to OutboxEntry."""
    sent_at = datetime.fromisoformat(row["sent_at"])
    # Ensure timezone-aware
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)

    return OutboxEntry(
        id=UUID(row["id"]),
        ticket_id=UUID(row["ticket_id"]),
        recipient=row["recipient"],
        markdown_content=row["markdown_content"],
        sent_at=sent_at,
    )


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Models
    "OutboxEntry",
    "OutboxCreate",
    # DB functions
    "init_outbox_db",
    "save_sent_reminder",
    "get_outbox_entries",
    "get_entries_for_ticket",
    # Helpers
    "get_db_path",
    "set_db_path",
]

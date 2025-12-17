"""
Ticket Reminder Logic

Models and pure calculations for the "Assigned without Assignee" reminder feature.
Extracted from tickets.py for separation of concerns.

Following "Grokking Simplicity":
- Data: Pydantic models
- Calculations: Pure functions (no I/O)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field
from tickets import Ticket, TicketPriority, TicketStatus, WorkLog, WorkLogType

# ============================================================================
# PRIORITY SLA DEADLINES (in minutes)
# ============================================================================

PRIORITY_SLA_MINUTES: dict[TicketPriority, int] = {
    TicketPriority.CRITICAL: 30,
    TicketPriority.HIGH: 120,
    TicketPriority.MEDIUM: 240,
    TicketPriority.LOW: 480,
}


# ============================================================================
# REMINDER MODELS
# ============================================================================

class ReminderCandidate(BaseModel):
    """Ticket that may need a reminder."""
    ticket: Ticket = Field(..., description="The ticket")
    minutes_since_creation: int = Field(..., description="Age in minutes")
    sla_deadline_minutes: int = Field(..., description="SLA deadline")
    is_overdue: bool = Field(..., description="Past SLA deadline")
    was_reminded_before: bool = Field(..., description="Already reminded once")
    reminder_count: int = Field(default=0, ge=0, description="Times reminded")


class ReminderRequest(BaseModel):
    """Request to send reminders for selected tickets."""
    ticket_ids: list[UUID] = Field(..., min_length=1, description="Tickets to remind")
    reminded_by: str = Field(..., description="Who is sending reminders")
    message: Optional[str] = Field(None, max_length=2000, description="Custom message")


class ReminderResult(BaseModel):
    """Result of sending reminders."""
    successful: list[UUID] = Field(default_factory=list, description="Successfully reminded")
    failed: list[UUID] = Field(default_factory=list, description="Failed to remind")
    errors: dict[str, str] = Field(default_factory=dict, description="Error messages by ticket ID")


# ============================================================================
# CALCULATIONS - Pure functions for reminder logic
# ============================================================================

def get_sla_deadline_minutes(priority: TicketPriority) -> int:
    """Get SLA deadline in minutes for a priority level."""
    return PRIORITY_SLA_MINUTES.get(priority, 480)


def calculate_minutes_elapsed(created_at: datetime, now: Optional[datetime] = None) -> int:
    """Calculate minutes elapsed since ticket creation."""
    if now is None:
        now = datetime.now(created_at.tzinfo)
    delta = now - created_at
    return int(delta.total_seconds() / 60)


def is_ticket_overdue(ticket: Ticket, now: Optional[datetime] = None) -> bool:
    """Check if ticket is past its SLA deadline."""
    elapsed = calculate_minutes_elapsed(ticket.created_at, now)
    deadline = get_sla_deadline_minutes(ticket.priority)
    return elapsed > deadline


def is_assigned_without_assignee(ticket: Ticket) -> bool:
    """Check if ticket is assigned to group but has no individual assignee."""
    return (
        ticket.assigned_group is not None
        and ticket.assignee is None
        and ticket.status in (TicketStatus.NEW, TicketStatus.ASSIGNED)
    )


def count_reminders_in_worklogs(work_logs: list[WorkLog]) -> int:
    """Count how many reminder entries exist in worklogs."""
    return sum(1 for log in work_logs if log.log_type == WorkLogType.REMINDER.value)


def build_reminder_candidate(
    ticket: Ticket,
    work_logs: list[WorkLog],
    now: Optional[datetime] = None
) -> ReminderCandidate:
    """Build a ReminderCandidate from ticket and its worklogs."""
    elapsed = calculate_minutes_elapsed(ticket.created_at, now)
    deadline = get_sla_deadline_minutes(ticket.priority)
    reminder_count = count_reminders_in_worklogs(work_logs)
    
    return ReminderCandidate(
        ticket=ticket,
        minutes_since_creation=elapsed,
        sla_deadline_minutes=deadline,
        is_overdue=elapsed > deadline,
        was_reminded_before=reminder_count > 0,
        reminder_count=reminder_count,
    )


def filter_reminder_candidates(
    candidates: list[ReminderCandidate],
    only_overdue: bool = True,
) -> list[ReminderCandidate]:
    """Filter candidates, optionally only overdue ones."""
    if only_overdue:
        return [c for c in candidates if c.is_overdue]
    return candidates


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Constants
    "PRIORITY_SLA_MINUTES",
    # Models
    "ReminderCandidate",
    "ReminderRequest",
    "ReminderResult",
    # Calculations
    "get_sla_deadline_minutes",
    "calculate_minutes_elapsed",
    "is_ticket_overdue",
    "is_assigned_without_assignee",
    "count_reminders_in_worklogs",
    "build_reminder_candidate",
    "filter_reminder_candidates",
]

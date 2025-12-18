"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

from datetime import datetime, timezone

from api_decorators import operation
from reminder import (
    ReminderCandidate,
    ReminderRequest,
    ReminderResult,
    build_reminder_candidate,
)
from reminder_outbox import (
    OutboxEntry,
    get_entries_for_ticket,
    get_outbox_entries,
    save_sent_reminder,
)
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate
from ticket_service import add_work_log as svc_add_work_log
from ticket_service import get_ticket, list_tickets
from tickets import Ticket

# Service instances shared across interfaces
_task_service = TaskService()


@operation(
    name="list_tasks",
    description="List all tasks with optional filtering by completion status",
    http_method="GET",
    http_path="/api/tasks",
)
async def op_list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
    """List tasks with optional filtering."""
    return _task_service.list_tasks(filter)


@operation(
    name="create_task",
    description="Create a new task with validation",
    http_method="POST",
    http_path="/api/tasks",
)
async def op_create_task(data: TaskCreate) -> Task:
    """Create a new task with validation."""
    return _task_service.create_task(data)


@operation(
    name="get_task",
    description="Retrieve a specific task by its unique identifier",
    http_method="GET",
    http_path="/api/tasks/{task_id}",
)
async def op_get_task(task_id: str) -> Task | None:
    """Get a task by ID."""
    return _task_service.get_task(task_id)


@operation(
    name="update_task",
    description="Update an existing task's properties",
    http_method="PUT",
    http_path="/api/tasks/{task_id}",
)
async def op_update_task(task_id: str, data: TaskUpdate) -> Task | None:
    """Update a task by ID."""
    return _task_service.update_task(task_id, data)


@operation(
    name="delete_task",
    description="Delete a task permanently by its identifier",
    http_method="DELETE",
    http_path="/api/tasks/{task_id}",
)
async def op_delete_task(task_id: str) -> bool:
    """Delete a task by ID."""
    return _task_service.delete_task(task_id)


@operation(
    name="get_task_stats",
    description="Get summary statistics for all tasks",
    http_method="GET",
    http_path="/api/tasks/stats",
)
async def op_get_task_stats() -> TaskStats:
    """Get task statistics."""
    return _task_service.get_stats()


# ============================================================================
# REMINDER OPERATIONS
# ============================================================================


@operation(
    name="get_reminder_candidates",
    description="Get tickets that need reminders (assigned to group but no individual assignee, optionally filtered by SLA overdue status)",
    http_method="GET",
    http_path="/api/reminder/candidates",
)
async def op_get_reminder_candidates(include_all: bool = False) -> list[ReminderCandidate]:
    """
    Get tickets that are candidates for SLA reminders.
    
    Args:
        include_all: If True, include non-overdue tickets. Default: only overdue.
    
    Returns:
        List of ReminderCandidate objects sorted by most overdue first.
    """
    mcp_tickets = await list_tickets(page_size=10000)
    
    candidates = []
    now = datetime.now(tz=timezone.utc)
    
    for mcp_ticket in mcp_tickets:
        if not Ticket.is_unassigned_dict(mcp_ticket):
            continue
        
        try:
            ticket = Ticket.from_mcp_dict(mcp_ticket)
        except Exception:
            continue
        
        candidate = build_reminder_candidate(ticket, work_logs=[], now=now)
        
        if include_all or candidate.is_overdue:
            candidates.append(candidate)
    
    candidates.sort(key=lambda c: c.minutes_since_creation - c.sla_deadline_minutes, reverse=True)
    return candidates


@operation(
    name="send_reminders",
    description="Send SLA reminders for selected tickets and record in outbox",
    http_method="POST",
    http_path="/api/reminder/send",
)
async def op_send_reminders(data: ReminderRequest) -> ReminderResult:
    """
    Send reminders for selected tickets.
    
    For each ticket:
    1. Saves reminder to local outbox (audit trail)
    2. Adds worklog entry to external ticket system
    
    Args:
        data: ReminderRequest with ticket_ids, reminded_by, optional message
    
    Returns:
        ReminderResult with successful, failed, and error details.
    """
    successful = []
    failed = []
    errors = {}
    
    for ticket_id in data.ticket_ids:
        try:
            # Get ticket details
            ticket_data = await get_ticket(str(ticket_id))
            
            if not ticket_data:
                failed.append(ticket_id)
                errors[str(ticket_id)] = "Ticket not found"
                continue
            
            assigned_group = ticket_data.get("assigned_group", "Unknown Group")
            
            # Build message
            reminder_message = data.message or f"Reminder: Ticket still unassigned in group '{assigned_group}'"
            
            # Save to outbox first
            recipient = f"{assigned_group}@company.com"
            save_sent_reminder(
                ticket_id=ticket_id,
                recipient=recipient,
                markdown_content=reminder_message,
            )
            
            # Add worklog (non-blocking)
            try:
                await op_add_work_log(
                    ticket_id=str(ticket_id),
                    log_type="reminder",
                    summary=f"SLA reminder sent: {reminder_message}",
                    details=f"Ticket unassigned in group '{assigned_group}'. Reminder sent by {data.reminded_by}.",
                    author=data.reminded_by,
                )
            except Exception:
                pass
            
            successful.append(ticket_id)
            
        except Exception as e:
            failed.append(ticket_id)
            errors[str(ticket_id)] = str(e)
    
    return ReminderResult(successful=successful, failed=failed, errors=errors)


# ============================================================================
# WORKLOG OPERATIONS
# ============================================================================


@operation(
    name="add_work_log",
    description="Add a worklog entry to a ticket for tracking work, notes, or reminders",
    http_method="POST",
    http_path="/api/tickets/{ticket_id}/worklogs",
)
async def op_add_work_log(
    ticket_id: str,
    log_type: str,
    summary: str,
    author: str,
    details: str | None = None,
    time_spent_minutes: int = 0,
) -> dict:
    """
    Add a worklog entry to a ticket.
    
    Args:
        ticket_id: The ticket UUID
        log_type: Type of log (creation, update, reminder, note, resolution)
        summary: Brief summary of the work done
        author: Who is creating the log
        details: Optional detailed description
        time_spent_minutes: Time spent (default 0)
    
    Returns:
        The created worklog entry from the ticket system.
    """
    return await svc_add_work_log(
        ticket_id=ticket_id,
        log_type=log_type,
        summary=summary,
        author=author,
        details=details,
        time_spent_minutes=time_spent_minutes,
    )


# ============================================================================
# REMINDER OUTBOX OPERATIONS
# ============================================================================


@operation(
    name="get_outbox_entries",
    description="Get recent sent reminders from the outbox (audit trail)",
    http_method="GET",
    http_path="/api/reminder/outbox",
)
async def op_get_outbox_entries(limit: int = 50) -> list[OutboxEntry]:
    """
    Get recent outbox entries ordered by sent_at descending.
    
    Args:
        limit: Maximum entries to return (default 50)
    
    Returns:
        List of OutboxEntry objects with id, ticket_id, recipient, markdown_content, sent_at
    """
    return get_outbox_entries(limit=limit)


@operation(
    name="get_outbox_for_ticket",
    description="Get all sent reminders for a specific ticket",
    http_method="GET",
    http_path="/api/reminder/outbox/{ticket_id}",
)
async def op_get_outbox_for_ticket(ticket_id: str) -> list[OutboxEntry]:
    """
    Get all outbox entries for a specific ticket.
    
    Args:
        ticket_id: The ticket UUID to get reminders for
    
    Returns:
        List of OutboxEntry objects for this ticket
    """
    from uuid import UUID
    return get_entries_for_ticket(UUID(ticket_id))


# Export shared services for callers (REST app, CLI tools, etc.)
task_service = _task_service

__all__ = [
    "task_service",
    "op_list_tasks",
    "op_create_task",
    "op_get_task",
    "op_update_task",
    "op_delete_task",
    "op_get_task_stats",
    # Reminder operations
    "op_get_reminder_candidates",
    "op_send_reminders",
    # Outbox operations
    "op_get_outbox_entries",
    "op_get_outbox_for_ticket",
    # Worklog operations
    "op_add_work_log",
]

"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

from collections import Counter
from pathlib import Path
from typing import Any
from uuid import UUID

from api_decorators import operation
from csv_data import get_csv_ticket_service
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate
from tickets import (
    SlaBreachReport,
    Ticket,
    TicketSlaInfo,
    TicketStatus,
    get_sla_breach_report,
)

# Service instances shared across interfaces
_task_service = TaskService()
_csv_service = get_csv_ticket_service()
_csv_loaded = False


CSV_TICKET_FIELDS = [
    {"name": "incident_id", "label": "Incident ID", "type": "string"},
    {"name": "id", "label": "ID", "type": "uuid"},
    {"name": "summary", "label": "Summary", "type": "string"},
    {"name": "status", "label": "Status", "type": "enum"},
    {"name": "priority", "label": "Priority", "type": "enum"},
    {"name": "assignee", "label": "Assignee", "type": "string"},
    {"name": "assigned_group", "label": "Assigned Group", "type": "string"},
    {"name": "requester_name", "label": "Requester", "type": "string"},
    {"name": "requester_email", "label": "Email", "type": "string"},
    {"name": "city", "label": "City", "type": "string"},
    {"name": "country", "label": "Country", "type": "string"},
    {"name": "service", "label": "Service", "type": "string"},
    {"name": "incident_type", "label": "Incident Type", "type": "string"},
    {"name": "product_name", "label": "Product", "type": "string"},
    {"name": "manufacturer", "label": "Manufacturer", "type": "string"},
    {"name": "created_at", "label": "Created", "type": "datetime"},
    {"name": "updated_at", "label": "Updated", "type": "datetime"},
    {"name": "urgency", "label": "Urgency", "type": "string"},
    {"name": "impact", "label": "Impact", "type": "string"},
    {"name": "resolution", "label": "Resolution", "type": "string"},
    {"name": "notes", "label": "Notes", "type": "string"},
]


def _ensure_csv_loaded() -> None:
    """Load the default CSV file once so MCP tools are immediately usable."""
    global _csv_loaded
    if _csv_loaded:
        return

    default_csv_path = Path(__file__).resolve().parents[1] / "csv" / "data.csv"
    if default_csv_path.exists():
        try:
            _csv_service.load_csv(default_csv_path)
        except Exception:
            pass
    _csv_loaded = True


def _parse_status(status: str | None) -> TicketStatus | None:
    """Convert status string to enum, returning None for unknown values."""
    if not status:
        return None
    try:
        return TicketStatus(status.lower())
    except ValueError:
        return None


def _sorted_tickets(tickets: list[Ticket], sort: str, sort_dir: str) -> list[Ticket]:
    """Sort tickets while handling nullable and enum fields."""
    reverse = sort_dir.lower() == "desc"

    def sort_key(ticket: Ticket):
        value = getattr(ticket, sort, None)
        if value is None:
            return ""
        if hasattr(value, "value"):
            return value.value
        return value

    try:
        return sorted(tickets, key=sort_key, reverse=reverse)
    except TypeError:
        return tickets


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


@operation(
    name="csv_list_tickets",
    description="List tickets loaded from CSV with optional filters and pagination",
    http_method="GET",
)
async def op_csv_list_tickets(
    status: str | None = None,
    assigned_group: str | None = None,
    has_assignee: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "created_at",
    sort_dir: str = "desc",
) -> list[Ticket]:
    """List CSV tickets for MCP/agent consumers."""
    _ensure_csv_loaded()
    parsed_status = _parse_status(status)
    tickets = _csv_service.list_tickets(
        status=parsed_status,
        assigned_group=assigned_group,
        has_assignee=has_assignee,
    )
    tickets = _sorted_tickets(tickets, sort, sort_dir)

    normalized_offset = max(offset, 0)
    normalized_limit = min(max(limit, 1), 500)
    return tickets[normalized_offset: normalized_offset + normalized_limit]


@operation(
    name="csv_get_ticket",
    description="Get a single CSV ticket by UUID",
    http_method="GET",
)
async def op_csv_get_ticket(ticket_id: str) -> Ticket | None:
    """Get one CSV ticket."""
    _ensure_csv_loaded()
    try:
        parsed_id = UUID(ticket_id)
    except ValueError:
        return None
    return _csv_service.get_ticket(parsed_id)


@operation(
    name="csv_search_tickets",
    description="Search CSV tickets by text across summary, description, notes, requester and location fields",
    http_method="GET",
)
async def op_csv_search_tickets(query: str, limit: int = 50) -> list[Ticket]:
    """Search CSV tickets with a simple case-insensitive contains check."""
    _ensure_csv_loaded()
    q = query.strip().lower()
    if not q:
        return []

    normalized_limit = min(max(limit, 1), 500)
    matches: list[Ticket] = []
    for ticket in _csv_service.list_tickets():
        haystack = " ".join(
            [
                ticket.summary or "",
                ticket.description or "",
                ticket.notes or "",
                ticket.resolution or "",
                ticket.requester_name or "",
                ticket.requester_email or "",
                ticket.assigned_group or "",
                ticket.city or "",
                ticket.service or "",
            ]
        ).lower()

        if q in haystack:
            matches.append(ticket)
            if len(matches) >= normalized_limit:
                break

    return matches


@operation(
    name="csv_ticket_stats",
    description="Get aggregated statistics for tickets loaded from CSV",
    http_method="GET",
)
async def op_csv_ticket_stats() -> dict[str, Any]:
    """Return counts by status, priority, group, and city."""
    _ensure_csv_loaded()
    tickets = _csv_service.list_tickets()

    by_status = Counter(t.status.value for t in tickets)
    by_priority = Counter(t.priority.value for t in tickets)
    by_group = Counter(t.assigned_group for t in tickets if t.assigned_group)
    by_city = Counter(t.city for t in tickets if t.city)
    unassigned = sum(1 for t in tickets if t.assignee is None and t.assigned_group is not None)

    return {
        "total": len(tickets),
        "unassigned": unassigned,
        "by_status": dict(by_status),
        "by_priority": dict(by_priority),
        "by_group": dict(by_group.most_common(10)),
        "by_city": dict(by_city.most_common(10)),
    }


@operation(
    name="csv_ticket_fields",
    description="List the curated CSV ticket fields exposed to UI and agent tools",
    http_method="GET",
)
async def op_csv_ticket_fields() -> list[dict[str, str]]:
    """Return field metadata for CSV ticket projections."""
    _ensure_csv_loaded()
    return CSV_TICKET_FIELDS


@operation(
    name="csv_sla_breach_tickets",
    description=(
        "Return tickets at SLA breach risk from the CSV dataset. "
        "By default only unassigned tickets (assigned to a group but no individual) are included. "
        "Results contain pre-computed age_hours, sla_threshold_hours, and breach_status. "
        "Grouped: 'breached' first, then 'at_risk'. Within each group sorted by age_hours descending. "
        "The reference timestamp is the maximum created_at date found in the selected tickets "
        "(not the current system time), making results deterministic for historical datasets. "
        "SLA thresholds: critical=4h, high=24h, medium=72h, low=120h."
    ),
    http_method="GET",
)
async def op_csv_sla_breach_tickets(
    unassigned_only: bool = True,
    include_ok: bool = False,
) -> SlaBreachReport:
    """
    Pre-compute SLA breach status for CSV tickets.

    Args:
        unassigned_only: When True (default), only return tickets that are assigned
            to a group but have no individual assignee — the primary use case for
            proactive SLA monitoring.
        include_ok: When True, also include tickets that are within their SLA window.
            Default False keeps the result focused on actionable items.

    Returns:
        SlaBreachReport with reference_timestamp, counts, and a sorted list of
        TicketSlaInfo objects ready for display or further AI commentary.
    """
    _ensure_csv_loaded()
    tickets = _csv_service.list_tickets(
        has_assignee=False if unassigned_only else None,
    )
    return get_sla_breach_report(tickets, reference_time=None, include_ok=include_ok)


# Export shared services for callers (REST app, CLI tools, etc.)
task_service = _task_service
csv_ticket_service = _csv_service

__all__ = [
    "task_service",
    "csv_ticket_service",
    "op_list_tasks",
    "op_create_task",
    "op_get_task",
    "op_update_task",
    "op_delete_task",
    "op_get_task_stats",
    "op_csv_list_tickets",
    "op_csv_get_ticket",
    "op_csv_search_tickets",
    "op_csv_ticket_stats",
    "op_csv_ticket_fields",
    "op_csv_sla_breach_tickets",
    "CSV_TICKET_FIELDS",
]

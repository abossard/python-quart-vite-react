"""
Test build_reminder_candidate with real support ticket data.

Validates the Pydantic models and calculation functions
against sample data from the support-tickets MCP service.

Run from backend directory:
    python -m pytest tests/test_tickets.py
"""

from datetime import datetime, timezone

from tickets import (
    PRIORITY_SLA_MINUTES,
    Ticket,
    WorkLog,
    build_reminder_candidate,
    is_assigned_without_assignee,
)

# Sample ticket data from MCP service (10 tickets with varying priorities/statuses)
SAMPLE_TICKETS = [
    {
        "id": "f4b5d39f-51cb-46af-b551-6b2054b82e84",
        "summary": "Teams: Anrufe gehen nicht",
        "description": "Teams calls not working",
        "status": "in_progress",
        "priority": "high",
        "assignee": "Agent Quinn",
        "assigned_group": "SDE - Service Desk",
        "requester_name": "Taylor Anderson",
        "requester_email": "taylor.anderson@demo.org",
        "city": "Lausanne",
        "service": "Communication",
        "created_at": "2025-12-17T10:14:03.160125+00:00",
        "updated_at": "2025-12-17T10:14:03.160125+00:00",
        "work_logs": [
            {
                "id": "00231b87-f522-4679-9229-4f8dd09fb8af",
                "ticket_id": "f4b5d39f-51cb-46af-b551-6b2054b82e84",
                "created_at": "2025-12-17T10:14:03.232136+00:00",
                "log_type": "creation",
                "summary": "Ticket created",
                "author": "System",
                "time_spent_minutes": 0,
            }
        ],
    },
    {
        "id": "1b144d12-2ea2-4be5-ace1-169a36b3bba9",
        "summary": "Adobe Acrobat Pro installation request",
        "description": "Need Adobe Acrobat Pro on new workstation",
        "status": "in_progress",
        "priority": "high",
        "assignee": "Agent Finley",
        "assigned_group": "SEC - Security Operations",
        "requester_name": "Drew Williams",
        "requester_email": "drew.williams@test.net",
        "city": "Geneva",
        "service": "Business Applications",
        "created_at": "2025-12-17T05:15:58.864873+00:00",
        "updated_at": "2025-12-17T05:15:58.864873+00:00",
        "work_logs": [
            {
                "id": "19874b93-9142-43d8-a026-b85c505095aa",
                "ticket_id": "1b144d12-2ea2-4be5-ace1-169a36b3bba9",
                "created_at": "2025-12-17T05:15:58.929231+00:00",
                "log_type": "creation",
                "summary": "Ticket created",
                "author": "System",
                "time_spent_minutes": 0,
            }
        ],
    },
    # Critical priority - no assignee (should trigger reminder)
    {
        "id": "aaaaaaaa-1111-1111-1111-111111111111",
        "summary": "CRITICAL: Production database down",
        "description": "Database server unreachable",
        "status": "assigned",
        "priority": "critical",
        "assignee": None,
        "assigned_group": "DBA Team",
        "requester_name": "System Admin",
        "requester_email": "admin@company.org",
        "city": "Zürich",
        "service": "Infrastructure",
        "created_at": "2025-12-17T11:00:00+00:00",
        "updated_at": "2025-12-17T11:00:00+00:00",
        "work_logs": [],
    },
    # Medium priority - with reminder already sent
    {
        "id": "bbbbbbbb-2222-2222-2222-222222222222",
        "summary": "VPN connection issues",
        "description": "Cannot connect to VPN from home",
        "status": "assigned",
        "priority": "medium",
        "assignee": None,
        "assigned_group": "Network Team",
        "requester_name": "Remote Worker",
        "requester_email": "remote@company.org",
        "city": "Bern",
        "service": "Network Services",
        "created_at": "2025-12-17T06:00:00+00:00",
        "updated_at": "2025-12-17T08:00:00+00:00",
        "work_logs": [
            {
                "id": "cc111111-1111-1111-1111-111111111111",
                "ticket_id": "bbbbbbbb-2222-2222-2222-222222222222",
                "created_at": "2025-12-17T08:00:00+00:00",
                "log_type": "reminder",
                "summary": "Reminder sent to SGL",
                "author": "Incident Manager",
                "time_spent_minutes": 0,
            }
        ],
    },
    # Low priority - new, within SLA
    {
        "id": "cccccccc-3333-3333-3333-333333333333",
        "summary": "Request for second monitor",
        "description": "Would like additional monitor for productivity",
        "status": "new",
        "priority": "low",
        "assignee": None,
        "assigned_group": "Workplace Services",
        "requester_name": "Office Worker",
        "requester_email": "worker@company.org",
        "city": "Basel",
        "service": "Workplace",
        "created_at": "2025-12-17T11:30:00+00:00",
        "updated_at": "2025-12-17T11:30:00+00:00",
        "work_logs": [],
    },
    # High priority - overdue, multiple reminders
    {
        "id": "dddddddd-4444-4444-4444-444444444444",
        "summary": "Email not syncing on mobile",
        "description": "Outlook mobile app stuck syncing",
        "status": "assigned",
        "priority": "high",
        "assignee": None,
        "assigned_group": "SDE - Service Desk",
        "requester_name": "Mobile User",
        "requester_email": "mobile@company.org",
        "city": "Luzern",
        "service": "Communication",
        "created_at": "2025-12-17T04:00:00+00:00",
        "updated_at": "2025-12-17T10:00:00+00:00",
        "work_logs": [
            {
                "id": "dd111111-1111-1111-1111-111111111111",
                "ticket_id": "dddddddd-4444-4444-4444-444444444444",
                "created_at": "2025-12-17T06:00:00+00:00",
                "log_type": "reminder",
                "summary": "First reminder sent",
                "author": "Incident Manager",
                "time_spent_minutes": 0,
            },
            {
                "id": "dd222222-2222-2222-2222-222222222222",
                "ticket_id": "dddddddd-4444-4444-4444-444444444444",
                "created_at": "2025-12-17T09:00:00+00:00",
                "log_type": "reminder",
                "summary": "Second reminder sent",
                "author": "Incident Manager",
                "time_spent_minutes": 0,
            },
        ],
    },
    # Resolved ticket - should not need reminder
    {
        "id": "eeeeeeee-5555-5555-5555-555555555555",
        "summary": "Password reset request",
        "description": "User forgot password",
        "status": "resolved",
        "priority": "medium",
        "assignee": "Agent Smith",
        "assigned_group": "SDE - Service Desk",
        "requester_name": "Forgetful User",
        "requester_email": "forgot@company.org",
        "city": "Winterthur",
        "service": "Security",
        "created_at": "2025-12-17T07:00:00+00:00",
        "updated_at": "2025-12-17T07:30:00+00:00",
        "work_logs": [
            {
                "id": "ee111111-1111-1111-1111-111111111111",
                "ticket_id": "eeeeeeee-5555-5555-5555-555555555555",
                "created_at": "2025-12-17T07:30:00+00:00",
                "log_type": "resolution",
                "summary": "Password reset completed",
                "author": "Agent Smith",
                "time_spent_minutes": 15,
            }
        ],
    },
    # Critical with assignee - no reminder needed
    {
        "id": "ffffffff-6666-6666-6666-666666666666",
        "summary": "CRITICAL: Network switch failure",
        "description": "Core switch in DC1 unresponsive",
        "status": "in_progress",
        "priority": "critical",
        "assignee": "Network Admin",
        "assigned_group": "Network Team",
        "requester_name": "NOC",
        "requester_email": "noc@company.org",
        "city": "Zürich",
        "service": "Infrastructure",
        "created_at": "2025-12-17T11:45:00+00:00",
        "updated_at": "2025-12-17T11:50:00+00:00",
        "work_logs": [],
    },
    # Pending ticket - waiting on user
    {
        "id": "11111111-7777-7777-7777-777777777777",
        "summary": "Software license clarification",
        "description": "Need to verify license type",
        "status": "pending",
        "priority": "low",
        "assignee": "Agent Brown",
        "assigned_group": "Licensing Team",
        "requester_name": "License Requester",
        "requester_email": "license@company.org",
        "city": "St. Gallen",
        "service": "Business Applications",
        "created_at": "2025-12-16T14:00:00+00:00",
        "updated_at": "2025-12-17T09:00:00+00:00",
        "work_logs": [],
    },
    # New ticket, no group assigned yet
    {
        "id": "22222222-8888-8888-8888-888888888888",
        "summary": "General inquiry about training",
        "description": "When is the next Excel training?",
        "status": "new",
        "priority": "low",
        "assignee": None,
        "assigned_group": None,
        "requester_name": "Curious Employee",
        "requester_email": "curious@company.org",
        "city": "Emmen",
        "service": "Workplace",
        "created_at": "2025-12-17T11:55:00+00:00",
        "updated_at": "2025-12-17T11:55:00+00:00",
        "work_logs": [],
    },
]

TEST_NOW = datetime(2025, 12, 17, 12, 0, 0, tzinfo=timezone.utc)


def _parse_ticket(data: dict) -> tuple[Ticket, list[WorkLog]]:
    """Parse raw ticket data into Ticket and WorkLog models."""
    raw = {**data}
    work_logs_data = raw.pop("work_logs", [])
    ticket = Ticket.model_validate(raw)
    work_logs = [WorkLog.model_validate(wl) for wl in work_logs_data]
    return ticket, work_logs


def test_all_tickets_parse():
    """All sample tickets parse into valid Pydantic models."""
    for raw in SAMPLE_TICKETS:
        ticket, work_logs = _parse_ticket(raw)
        assert ticket.id
        assert ticket.priority


def test_critical_unassigned_overdue():
    """Critical ticket with no assignee that is overdue needs a reminder."""
    raw = SAMPLE_TICKETS[2]  # "CRITICAL: Production database down"
    ticket, work_logs = _parse_ticket(raw)
    candidate = build_reminder_candidate(ticket, work_logs, now=TEST_NOW)
    assert candidate.is_overdue
    assert is_assigned_without_assignee(ticket)


def test_resolved_ticket_no_reminder():
    """Resolved ticket should not trigger a reminder."""
    raw = SAMPLE_TICKETS[6]  # "Password reset request"
    ticket, work_logs = _parse_ticket(raw)
    assert not is_assigned_without_assignee(ticket)


def test_critical_with_assignee_no_reminder():
    """Critical ticket with an assignee does not need a reminder."""
    raw = SAMPLE_TICKETS[7]  # "CRITICAL: Network switch failure"
    ticket, work_logs = _parse_ticket(raw)
    assert not is_assigned_without_assignee(ticket)


def test_high_overdue_reminder_count():
    """High-priority overdue ticket counts existing reminders."""
    raw = SAMPLE_TICKETS[5]  # "Email not syncing on mobile"
    ticket, work_logs = _parse_ticket(raw)
    candidate = build_reminder_candidate(ticket, work_logs, now=TEST_NOW)
    assert candidate.is_overdue
    assert candidate.reminder_count == 2


def test_low_new_within_sla():
    """Low-priority new ticket within SLA is not overdue."""
    raw = SAMPLE_TICKETS[4]  # "Request for second monitor"
    ticket, work_logs = _parse_ticket(raw)
    candidate = build_reminder_candidate(ticket, work_logs, now=TEST_NOW)
    assert not candidate.is_overdue

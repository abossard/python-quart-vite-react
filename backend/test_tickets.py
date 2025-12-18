"""
Test build_reminder_candidate with real support ticket data.

This script validates the Pydantic models and calculation functions
against sample data from the support-tickets MCP service.
"""

from datetime import datetime, timezone

from reminder import (
    PRIORITY_SLA_MINUTES,
    build_reminder_candidate,
    is_assigned_without_assignee,
)
from tickets import Ticket, WorkLog

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
        "created_at": "2025-12-17T11:00:00+00:00",  # 30+ mins ago → overdue
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
        "created_at": "2025-12-17T11:30:00+00:00",  # Recent → within SLA
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
        "created_at": "2025-12-17T04:00:00+00:00",  # 8+ hours ago
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


def parse_ticket_with_worklogs(data: dict) -> tuple[Ticket, list[WorkLog]]:
    """Parse raw ticket data into Ticket and WorkLog models."""
    work_logs_data = data.pop("work_logs", [])
    ticket = Ticket.model_validate(data)
    work_logs = [WorkLog.model_validate(wl) for wl in work_logs_data]
    return ticket, work_logs


def main():
    print("=" * 70)
    print("Testing build_reminder_candidate with 10 support tickets")
    print("=" * 70)
    print()
    
    # Use a fixed "now" for consistent testing
    test_now = datetime(2025, 12, 17, 12, 0, 0, tzinfo=timezone.utc)
    print(f"Test time (now): {test_now.isoformat()}")
    print()
    
    # Show SLA deadlines
    print("SLA Deadlines by Priority:")
    for priority, minutes in PRIORITY_SLA_MINUTES.items():
        print(f"  {priority.value:10s}: {minutes:4d} min ({minutes // 60}h {minutes % 60}m)")
    print()
    
    # Process each ticket
    print("-" * 70)
    print(f"{'#':>2} {'Priority':10s} {'Status':12s} {'Elapsed':>8s} {'SLA':>6s} {'Overdue':>8s} {'Reminded':>9s} {'NeedsReminder':>13s}")
    print("-" * 70)
    
    candidates_needing_reminder = []
    
    for i, raw_data in enumerate(SAMPLE_TICKETS, 1):
        # Make a copy to avoid mutating original
        data = {**raw_data, "work_logs": raw_data.get("work_logs", [])}
        work_logs_data = data.pop("work_logs")
        
        ticket = Ticket.model_validate(data)
        work_logs = [WorkLog.model_validate(wl) for wl in work_logs_data]
        
        # Build reminder candidate
        candidate = build_reminder_candidate(ticket, work_logs, now=test_now)
        
        # Check if needs reminder (assigned without assignee + overdue)
        needs_reminder = is_assigned_without_assignee(ticket) and candidate.is_overdue
        
        elapsed_str = f"{candidate.minutes_since_creation}m"
        sla_str = f"{candidate.sla_deadline_minutes}m"
        
        print(
            f"{i:2d} "
            f"{ticket.priority.value:10s} "
            f"{ticket.status.value:12s} "
            f"{elapsed_str:>8s} "
            f"{sla_str:>6s} "
            f"{'YES' if candidate.is_overdue else 'no':>8s} "
            f"{candidate.reminder_count:>9d} "
            f"{'>>> YES <<<' if needs_reminder else 'no':>13s}"
        )
        
        if needs_reminder:
            candidates_needing_reminder.append((i, ticket, candidate))
    
    print("-" * 70)
    print()
    
    # Summary
    print("=" * 70)
    print("TICKETS NEEDING REMINDER:")
    print("=" * 70)
    
    if not candidates_needing_reminder:
        print("  None")
    else:
        for idx, ticket, candidate in candidates_needing_reminder:
            reminded_msg = f" (reminded {candidate.reminder_count}x)" if candidate.was_reminded_before else ""
            print(f"  #{idx}: {ticket.summary}")
            print(f"       ID: {ticket.id}")
            print(f"       Priority: {ticket.priority.value} | Group: {ticket.assigned_group}")
            print(f"       Overdue by: {candidate.minutes_since_creation - candidate.sla_deadline_minutes} minutes{reminded_msg}")
            print()
    
    print("=" * 70)
    print("TEST PASSED: All tickets parsed and analyzed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    main()


# ============================================================================
# PYTEST TESTS
# ============================================================================

import pytest


class TestIsUnassignedDict:
    """Tests for Ticket.is_unassigned_dict static method."""
    
    def test_lowercase_assigned_status_matches(self):
        """Lowercase 'assigned' status should be detected as unassigned ticket."""
        ticket = {
            "assigned_group": "DBA Team",
            "assignee": None,
            "status": "assigned",
        }
        assert Ticket.is_unassigned_dict(ticket) is True
    
    def test_capitalized_assigned_status_should_match(self):
        """BUG TEST: Capitalized 'Assigned' status should also match (case insensitive)."""
        ticket = {
            "assigned_group": "DBA Team",
            "assignee": None,
            "status": "Assigned",  # MCP may return capitalized
        }
        # This currently FAILS due to case-sensitivity bug
        assert Ticket.is_unassigned_dict(ticket) is True, \
            "is_unassigned_dict should be case-insensitive for status"
    
    def test_uppercase_new_status_should_match(self):
        """BUG TEST: Uppercase 'NEW' status should also match."""
        ticket = {
            "assigned_group": "Service Desk",
            "assignee": None,
            "status": "NEW",
        }
        assert Ticket.is_unassigned_dict(ticket) is True, \
            "is_unassigned_dict should be case-insensitive for status"
    
    def test_with_assignee_returns_false(self):
        """Ticket with assignee should NOT match."""
        ticket = {
            "assigned_group": "DBA Team",
            "assignee": "Agent Smith",
            "status": "assigned",
        }
        assert Ticket.is_unassigned_dict(ticket) is False
    
    def test_without_group_returns_false(self):
        """Ticket without assigned_group should NOT match."""
        ticket = {
            "assigned_group": None,
            "assignee": None,
            "status": "new",
        }
        assert Ticket.is_unassigned_dict(ticket) is False
    
    def test_resolved_status_returns_false(self):
        """Resolved ticket should NOT match even if no assignee."""
        ticket = {
            "assigned_group": "DBA Team",
            "assignee": None,
            "status": "resolved",
        }
        assert Ticket.is_unassigned_dict(ticket) is False

"""
Ticket search service for querying external Supabase ticket API.
Follows the unified REST/MCP architecture pattern.
"""

from typing import Optional
from pydantic import BaseModel, Field
import httpx

# External API base URL
TICKET_API_BASE_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/api/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"


# Pydantic Models
class Ticket(BaseModel):
    """Ticket model representing a support ticket."""
    id: str = Field(..., description="Ticket identifier")
    assignee: Optional[str] = Field(default=None, description="Assigned person")
    summary: str = Field(..., description="Brief summary")
    description: str = Field(..., description="Detailed description")
    resolution: Optional[str] = Field(default=None, description="Resolution text")
    status: str = Field(..., description="Ticket status")
    priority: Optional[str] = Field(default=None, description="Priority level")
    service: Optional[str] = Field(default=None, description="Service type")
    city: Optional[str] = Field(default=None, description="City")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Update timestamp")


class KBAArticle(BaseModel):
    """Knowledge Base Article generated from a ticket."""
    title: str = Field(..., description="KBA article title")
    question: str = Field(..., description="The problem/question being addressed")
    answer: str = Field(..., description="The solution/answer to the problem")
    ticket_id: str = Field(..., description="Source ticket ID")


class TicketService:
    """Service for searching tickets via external Supabase API."""
    
    def __init__(self):
        self.base_url = TICKET_API_BASE_URL
        self.timeout = 10.0  # 10 second timeout
    
    async def search_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """
        Search for a ticket by ticket ID or partial ID.
        
        Args:
            ticket_id: The ticket ID to search for (full UUID or partial string)
            
        Returns:
            Ticket object if found, None otherwise
            
        Raises:
            httpx.HTTPError: If the API request fails
        """
        if not ticket_id or not ticket_id.strip():
            return None
        
        search_term = ticket_id.strip()
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Try direct ID lookup first (if it looks like a full UUID)
                if len(search_term) == 36 and search_term.count('-') == 4:
                    response = await client.get(
                        f"{self.base_url}/tickets/{search_term}"
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data:
                            return Ticket(**data)
                
                # Fall back to full-text search for partial IDs or non-UUID strings
                response = await client.get(
                    f"{self.base_url}/tickets",
                    params={"full_text": search_term, "page": 1, "page_size": 1}
                )
                response.raise_for_status()
                
                data = response.json()
                
                # API returns {"data": [...], "total": N}
                if data and isinstance(data, dict) and "data" in data:
                    tickets = data["data"]
                    if tickets and len(tickets) > 0:
                        return Ticket(**tickets[0])
                
                return None
                
            except httpx.HTTPStatusError as e:
                # Log error but return None for 404s (not found is valid state)
                if e.response.status_code == 404:
                    return None
                raise Exception(f"Ticket API error: {e.response.status_code}")
            except httpx.RequestError as e:
                raise Exception(f"Failed to connect to ticket API: {str(e)}")
            except Exception as e:
                raise Exception(f"Error searching tickets: {str(e)}")

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# ENUMS - Status and Priority types
# ============================================================================

class TicketStatus(str, Enum):
    """Ticket lifecycle status."""
    NEW = "new"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class TicketPriority(str, Enum):
    """Ticket priority with associated SLA deadlines."""
    CRITICAL = "critical"  # 30 minutes
    HIGH = "high"          # 2 hours
    MEDIUM = "medium"      # 4 hours
    LOW = "low"            # 8 hours


class ModificationStatus(str, Enum):
    """Status of a modification request."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class WorkLogType(str, Enum):
    """Type of worklog entry."""
    CREATION = "creation"
    UPDATE = "update"
    REMINDER = "reminder"
    NOTE = "note"
    RESOLUTION = "resolution"


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
# WORKLOG MODEL
# ============================================================================

class WorkLog(BaseModel):
    """Worklog entry for a ticket."""
    id: UUID = Field(..., description="Unique worklog identifier")
    ticket_id: UUID = Field(..., description="Parent ticket ID")
    created_at: datetime = Field(..., description="When the log was created")
    log_type: str = Field(..., description="Type of log entry")
    summary: str = Field(..., description="Log summary")
    details: Optional[str] = Field(None, description="Detailed log content")
    author: str = Field(..., description="Who created the log")
    time_spent_minutes: int = Field(default=0, ge=0, description="Time spent in minutes")

    class Config:
        from_attributes = True


class WorkLogCreate(BaseModel):
    """Data to create a new worklog entry."""
    log_type: str = Field(..., description="Type of log entry")
    summary: str = Field(..., max_length=500, description="Log summary")
    details: Optional[str] = Field(None, max_length=5000, description="Detailed content")
    author: str = Field(..., max_length=200, description="Author name")
    time_spent_minutes: int = Field(default=0, ge=0, description="Time spent")


# ============================================================================
# MODIFICATION REQUEST MODEL
# ============================================================================

class Modification(BaseModel):
    """Modification request for a ticket field."""
    id: UUID = Field(..., description="Unique modification identifier")
    ticket_id: UUID = Field(..., description="Target ticket ID")
    created_at: datetime = Field(..., description="Request timestamp")
    requested_by: str = Field(..., description="Who requested the change")
    field_name: str = Field(..., description="Field to modify")
    proposed_value: str = Field(..., description="New value proposed")
    reason: Optional[str] = Field(None, description="Justification for change")
    status: ModificationStatus = Field(default=ModificationStatus.PENDING)
    reviewed_by: Optional[str] = Field(None, description="Reviewer name")
    reviewed_at: Optional[datetime] = Field(None, description="Review timestamp")
    review_notes: Optional[str] = Field(None, description="Reviewer notes")

    class Config:
        from_attributes = True


class ModificationCreate(BaseModel):
    """Data to request a modification."""
    field_name: str = Field(..., description="Field to modify")
    proposed_value: str = Field(..., description="New value")
    requested_by: str = Field(..., description="Requester name")
    reason: Optional[str] = Field(None, max_length=1000, description="Reason for change")


class ModificationReview(BaseModel):
    """Data to review a modification request."""
    status: ModificationStatus = Field(..., description="Approval decision")
    reviewed_by: str = Field(..., description="Reviewer name")
    review_notes: Optional[str] = Field(None, max_length=1000, description="Review notes")


# ============================================================================
# OVERLAY METADATA - Tracks pending/approved modifications
# ============================================================================

class OverlayMetadata(BaseModel):
    """Metadata about ticket modifications."""
    has_pending: bool = Field(default=False, description="Has pending modifications")
    has_overlays: bool = Field(default=False, description="Has approved overlays")
    pending_count: int = Field(default=0, ge=0, description="Number of pending mods")
    approved_count: int = Field(default=0, ge=0, description="Number of approved mods")
    overlaid_fields: dict[str, str] = Field(default_factory=dict, description="Field -> approved value")


# ============================================================================
# TICKET MODELS
# ============================================================================

class Ticket(BaseModel):
    """
    Complete support ticket representation.
    
    Matches the schema from the support-tickets MCP service.
    """
    # Core identifiers
    id: UUID = Field(..., description="Unique ticket identifier")
    
    # Summary and description
    summary: str = Field(..., max_length=500, description="Short issue summary")
    description: str = Field(..., description="Detailed issue description")
    
    # Status and priority
    status: TicketStatus = Field(..., description="Current ticket status")
    priority: TicketPriority = Field(..., description="Ticket priority")
    impact: Optional[str] = Field(None, description="Business impact level")
    urgency: Optional[str] = Field(None, description="Urgency level")
    
    # Assignment
    assignee: Optional[str] = Field(None, description="Assigned agent name")
    assigned_group: Optional[str] = Field(None, description="Support group name")
    support_organization: Optional[str] = Field(None, description="Support org")
    
    # Requester info
    requester_name: str = Field(..., description="Name of person reporting")
    requester_email: str = Field(..., description="Email of person reporting")
    requester_phone: Optional[str] = Field(None, description="Phone number")
    requester_company: Optional[str] = Field(None, description="Company name")
    requester_department: Optional[str] = Field(None, description="Department")
    
    # Location
    city: Optional[str] = Field(None, description="City/location")
    country: Optional[str] = Field(None, description="Country")
    site: Optional[str] = Field(None, description="Site name")
    desk_location: Optional[str] = Field(None, description="Desk location")
    
    # Service and product info
    service: Optional[str] = Field(None, description="Affected service")
    incident_type: Optional[str] = Field(None, description="Type of incident")
    reported_source: Optional[str] = Field(None, description="How ticket was reported")
    
    # Product details
    product_name: Optional[str] = Field(None, description="Product name")
    manufacturer: Optional[str] = Field(None, description="Manufacturer")
    model_version: Optional[str] = Field(None, description="Model/version")
    ci_name: Optional[str] = Field(None, description="Configuration item name")
    
    # Categories (tiered)
    operational_category_tier1: Optional[str] = Field(None, description="Op category tier 1")
    operational_category_tier2: Optional[str] = Field(None, description="Op category tier 2")
    operational_category_tier3: Optional[str] = Field(None, description="Op category tier 3")
    product_category_tier1: Optional[str] = Field(None, description="Product category tier 1")
    product_category_tier2: Optional[str] = Field(None, description="Product category tier 2")
    product_category_tier3: Optional[str] = Field(None, description="Product category tier 3")
    
    # Resolution
    resolution: Optional[str] = Field(None, description="Resolution details")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    # Correlation
    event_id: Optional[str] = Field(None, description="Related event ID")
    correlation_key: Optional[str] = Field(None, description="Correlation key")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class TicketWithDetails(Ticket):
    """Ticket with work logs and modifications included."""
    work_logs: list[WorkLog] = Field(default_factory=list, description="Worklog entries")
    modifications: list[Modification] = Field(default_factory=list, description="Modification requests")
    overlay_metadata: Optional[OverlayMetadata] = Field(None, description="Modification metadata")


class TicketCreate(BaseModel):
    """Data required to create a new ticket."""
    summary: str = Field(..., min_length=1, max_length=500, description="Short issue summary")
    description: str = Field(..., min_length=1, description="Detailed description")
    requester_name: str = Field(..., min_length=1, max_length=200, description="Reporter name")
    requester_email: str = Field(..., description="Reporter email")
    
    # Optional fields
    priority: TicketPriority = Field(default=TicketPriority.MEDIUM, description="Priority level")
    status: TicketStatus = Field(default=TicketStatus.NEW, description="Initial status")
    service: Optional[str] = Field(None, max_length=200, description="Affected service")
    city: Optional[str] = Field(None, max_length=100, description="Location")
    requester_department: Optional[str] = Field(None, max_length=200, description="Department")


class TicketUpdate(BaseModel):
    """Data for updating a ticket. All fields optional."""
    summary: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, min_length=1)
    status: Optional[TicketStatus] = Field(None)
    priority: Optional[TicketPriority] = Field(None)
    assignee: Optional[str] = Field(None, max_length=200)
    assigned_group: Optional[str] = Field(None, max_length=200)
    service: Optional[str] = Field(None, max_length=200)
    resolution: Optional[str] = Field(None)
    notes: Optional[str] = Field(None)


class TicketFilter(str, Enum):
    """Filter options for listing tickets."""
    ALL = "all"
    COMPLETED = "completed"
    PENDING = "pending"


# ============================================================================
# STATISTICS MODELS
# ============================================================================

class TicketStats(BaseModel):
    """Aggregated ticket statistics."""
    total_tickets: int = Field(..., ge=0, description="Total ticket count")
    tickets_today: int = Field(..., ge=0, description="Tickets created today")
    tickets_this_week: int = Field(..., ge=0, description="Tickets this week")
    by_status: dict[str, int] = Field(default_factory=dict, description="Count by status")
    by_priority: dict[str, int] = Field(default_factory=dict, description="Count by priority")
    by_city: dict[str, int] = Field(default_factory=dict, description="Count by city")
    by_service: dict[str, int] = Field(default_factory=dict, description="Count by service")
    active_events: int = Field(default=0, ge=0, description="Active mass events")


# ============================================================================
# REMINDER MODELS - For the "Assigned without Assignee" feature
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
# ERROR MODEL
# ============================================================================

class TicketError(BaseModel):
    """Error response."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional details")


# ============================================================================
# CALCULATIONS - Pure functions for ticket logic
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


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Enums
    "TicketStatus",
    "TicketPriority",
    "ModificationStatus",
    "WorkLogType",
    # Constants
    "PRIORITY_SLA_MINUTES",
    # Models
    "Ticket",
    "TicketWithDetails",
    "TicketCreate",
    "TicketUpdate",
    "TicketFilter",
    "TicketStats",
    "TicketError",
    "WorkLog",
    "WorkLogCreate",
    "Modification",
    "ModificationCreate",
    "ModificationReview",
    "OverlayMetadata",
    # Reminder models
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
]

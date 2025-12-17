"""
Support Ticket Models

Strictly typed Pydantic models for the support-tickets MCP service.
These models match the schema from the external MCP tools and provide
type safety, validation, and documentation.

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Clear types hide complexity
- Separation: Data models (pure), Calculations (pure), Actions (I/O)
"""

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
# ERROR MODEL
# ============================================================================

class TicketError(BaseModel):
    """Error response."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional details")

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Enums
    "TicketStatus",
    "TicketPriority",
    "ModificationStatus",
    "WorkLogType",
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
]

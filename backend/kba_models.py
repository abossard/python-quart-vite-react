"""
KBA Drafter Data Models

Pydantic models for KBA draft lifecycle management.
Uses SQLModel for persistence (Pydantic + SQLAlchemy).

Following "Pydantic Architecture" principles:
- Base model: Complete entity with all fields
- Create model: Only fields user provides (no ID, timestamps)
- Update model: All optional for partial updates
- Clear separation: Data, Create, Update, Response DTOs

Model lifecycle:
    KBADraftCreate → KBADraft (generated) → KBADraftUpdate (edited) 
    → KBADraft (reviewed) → KBAPublishRequest → KBAPublishResult
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SQLField, JSON, SQLModel


# ============================================================================
# ENUMS
# ============================================================================

class KBADraftStatus(str, Enum):
    """Lifecycle status of KBA draft"""
    DRAFT = "draft"           # Initial generation
    REVIEWED = "reviewed"     # User reviewed/edited
    PUBLISHED = "published"   # Successfully published to KB
    FAILED = "failed"         # Publish failed


class KBAAuditEventType(str, Enum):
    """Types of audit events for logging"""
    DRAFT_GENERATED = "draft_generated"
    DRAFT_VIEWED = "draft_viewed"
    DRAFT_EDITED = "draft_edited"
    DRAFT_PUBLISHED = "draft_published"
    DRAFT_DELETED = "draft_deleted"
    PUBLISH_FAILED = "publish_failed"
    PARSING_FAILED = "parsing_failed"


# ============================================================================
# CORE MODELS
# ============================================================================

class KBADraft(BaseModel):
    """Complete KBA draft entity (READ operations)"""
    id: UUID = Field(default_factory=uuid4)
    ticket_id: Union[UUID, str]  # Support UUID or Incident-ID format
    incident_id: Optional[str] = None  # From ticket (e.g., INC0001234)
    
    # KBA Content
    title: str = Field(..., min_length=10, max_length=200, description="SEO-optimized title")
    
    # Problem Analysis (NEW: structured breakdown)
    symptoms: list[str] = Field(
        default_factory=list,
        description="Observable symptoms, error messages, failure modes"
    )
    cause: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Root cause analysis if determinable"
    )
    
    # Solution (RENAMED: solution_steps → resolution_steps)
    resolution_steps: list[str] = Field(
        ...,
        min_length=1,
        description="Step-by-step resolution procedure"
    )
    validation_checks: list[str] = Field(
        default_factory=list,
        description="Steps to verify the solution worked"
    )
    
    # Additional Information
    warnings: list[str] = Field(
        default_factory=list,
        description="Important warnings, precautions, side effects"
    )
    confidence_notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="LLM confidence in solution, uncertainties, caveats"
    )
    
    # Legacy/Supplemental
    problem_description: Optional[str] = Field(
        default="",
        max_length=2000,
        description="[DEPRECATED] Use symptoms/cause instead"
    )
    additional_notes: Optional[str] = Field(
        default="",
        max_length=1000,
        description="Optional additional context"
    )
    tags: list[str] = Field(default_factory=list, description="Search tags (lowercase)")
    related_tickets: list[str] = Field(default_factory=list, description="Related incident IDs")
    
    # Guidelines used during generation
    guidelines_used: list[str] = Field(default_factory=list, description="Guideline categories used")
    
    # Metadata
    status: KBADraftStatus = Field(default=KBADraftStatus.DRAFT)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: str  # User ID or email
    reviewed_by: Optional[str] = None  # Set when status changes to reviewed
    
    # Publishing metadata (populated after publish)
    published_at: Optional[datetime] = None
    published_url: Optional[str] = None
    published_id: Optional[str] = None  # ID in target KB system
    
    # LLM metadata
    llm_model: str = "llama3.2:1b"
    llm_generation_time_ms: Optional[int] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
                "incident_id": "INC0001234",
                "title": "VPN-Verbindungsprobleme unter Windows 11 beheben",
                "problem_description": "Benutzer können sich nicht mit dem Unternehmens-VPN verbinden...",
                "solution_steps": [
                    "1. VPN-Client neu starten",
                    "2. Netzwerkadapter zurücksetzen",
                    "3. VPN-Profil neu importieren"
                ],
                "additional_notes": "",
                "tags": ["vpn", "windows", "network"],
                "related_tickets": [],
                "guidelines_used": ["GENERAL", "VPN"],
                "status": "draft",
                "created_by": "user@example.com",
                "llm_model": "llama3.2:1b"
            }
        }


class KBADraftCreate(BaseModel):
    """DTO for creating new KBA draft (POST /api/kba/drafts)"""
    ticket_id: Union[UUID, str] = Field(..., description="UUID or Incident-ID (e.g., INC000016349815) of the ticket")
    include_related_tickets: bool = Field(default=False, description="Include related tickets in analysis")
    custom_guidelines: Optional[list[str]] = Field(None, description="Override auto-detected guidelines")
    user_id: str = Field(..., description="User ID for audit trail")
    force_create: bool = Field(default=False, description="Force creation even if drafts already exist for this ticket")
    
    class Config:
        json_schema_extra = {
            "example": {
                "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
                "include_related_tickets": False,
                "custom_guidelines": ["VPN", "GENERAL"],
                "user_id": "user@example.com"
            }
        }


class KBADraftUpdate(BaseModel):
    """DTO for updating draft (PATCH /api/kba/drafts/:id)"""
    # Legacy fields
    title: Optional[str] = Field(None, min_length=10, max_length=200)
    problem_description: Optional[str] = Field(None, max_length=2000)
    additional_notes: Optional[str] = Field(None, max_length=1000)
    
    # New structured fields
    symptoms: Optional[list[str]] = None
    cause: Optional[str] = Field(None, max_length=1000)
    resolution_steps: Optional[list[str]] = None
    validation_checks: Optional[list[str]] = None
    warnings: Optional[list[str]] = None
    confidence_notes: Optional[str] = Field(None, max_length=500)
    
    # Metadata
    tags: Optional[list[str]] = None
    related_tickets: Optional[list[str]] = None
    status: Optional[KBADraftStatus] = None
    reviewed_by: Optional[str] = None  # Set when status → reviewed


class KBAPublishRequest(BaseModel):
    """DTO for publishing draft (POST /api/kba/drafts/:id/publish)"""
    target_system: str = Field(..., pattern="^(sharepoint|file|itsm|confluence)$", description="Target KB system")
    category: Optional[str] = Field(None, description="KB category/folder")
    visibility: str = Field(default="internal", pattern="^(internal|public|restricted)$")
    user_id: str = Field(..., description="User ID for audit trail")
    
    class Config:
        json_schema_extra = {
            "example": {
                "target_system": "sharepoint",
                "category": "VPN",
                "visibility": "internal",
                "user_id": "user@example.com"
            }
        }


class KBAPublishResult(BaseModel):
    """Response from publish operation"""
    success: bool
    published_url: Optional[str] = None
    published_id: Optional[str] = None
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "published_url": "https://sharepoint.example.com/kb/12345",
                "published_id": "KB-12345",
                "message": "KBA successfully published to SharePoint"
            }
        }


# ============================================================================
# PERSISTENCE MODELS (SQLModel for database)
# ============================================================================

class KBADraftTable(SQLModel, table=True):
    """SQLModel table for persisting KBA drafts"""
    __tablename__ = "kba_drafts"
    
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    ticket_id: UUID = SQLField(index=True)
    incident_id: Optional[str] = SQLField(default=None, index=True)
    
    # Content (JSON columns for complex types)
    title: str
    
    # Problem Analysis (NEW fields)
    symptoms: list[str] = SQLField(sa_column=Column(JSON))
    cause: Optional[str] = None
    
    # Solution
    resolution_steps: list[str] = SQLField(sa_column=Column(JSON))
    validation_checks: list[str] = SQLField(sa_column=Column(JSON))
    
    # Additional
    warnings: list[str] = SQLField(sa_column=Column(JSON))
    confidence_notes: Optional[str] = None
    
    # Legacy fields (for backward compatibility)
    problem_description: str = ""
    additional_notes: str = ""
    tags: list[str] = SQLField(sa_column=Column(JSON))
    related_tickets: list[str] = SQLField(sa_column=Column(JSON))
    guidelines_used: list[str] = SQLField(sa_column=Column(JSON))
    
    # Metadata
    status: str = KBADraftStatus.DRAFT.value
    created_at: datetime = SQLField(default_factory=datetime.now, index=True)
    updated_at: datetime = SQLField(default_factory=datetime.now)
    created_by: str = SQLField(index=True)
    reviewed_by: Optional[str] = None
    
    # Publishing
    published_at: Optional[datetime] = None
    published_url: Optional[str] = None
    published_id: Optional[str] = SQLField(default=None, index= True)
    
    # LLM
    llm_model: str = "llama3.2:1b"
    llm_generation_time_ms: Optional[int] = None


# ============================================================================
# AUDIT MODELS
# ============================================================================

class KBAAuditEvent(BaseModel):
    """Single audit log entry"""
    id: UUID = Field(default_factory=uuid4)
    draft_id: UUID
    event_type: KBAAuditEventType
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    details: dict = Field(default_factory=dict, description="JSON metadata about the event")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
                "draft_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "event_type": "draft_generated",
                "user_id": "user@example.com",
                "timestamp": "2026-03-03T14:35:22Z",
                "details": {
                    "model": "llama3.2:1b",
                    "generation_time_ms": 3542,
                    "guidelines_used": ["GENERAL", "VPN"]
                }
            }
        }


class KBAAuditLog(SQLModel, table=True):
    """SQLModel table for audit trail"""
    __tablename__ = "kba_audit_log"
    
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    draft_id: UUID = SQLField(index=True)
    event_type: str = SQLField(index=True)  # KBAAuditEventType value
    user_id: str = SQLField(index=True)
    timestamp: datetime = SQLField(default_factory=datetime.now, index=True)
    details: dict = SQLField(sa_column=Column(JSON))


# ============================================================================
# FILTER/QUERY MODELS
# ============================================================================

class KBADraftFilter(BaseModel):
    """Filter options for listing KBA drafts"""
    status: Optional[KBADraftStatus] = None
    created_by: Optional[str] = None
    ticket_id: Optional[UUID] = None
    incident_id: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "draft",
                "created_by": "user@example.com",
                "limit": 20,
                "offset": 0
            }
        }


class KBADraftListResponse(BaseModel):
    """Response for list endpoint"""
    items: list[KBADraft]
    total: int
    limit: int
    offset: int

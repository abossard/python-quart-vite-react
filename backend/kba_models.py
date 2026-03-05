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
    SIMILARITY_DECISION = "similarity_decision"  # User decision after similarity check


class SimilarityDecisionType(str, Enum):
    """Types of user decisions after similarity check"""
    KEEP_EXISTING = "keep_existing"  # User chose to use existing KBA
    CREATE_NEW = "create_new"  # User chose to create new KBA (without comparison)
    CREATE_NEW_AFTER_COMPARE = "create_new_after_compare"  # User compared and decided to create new
    CANCELLED = "cancelled"  # User cancelled the workflow


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
    
    # Search Questions
    search_questions: list[str] = Field(
        default_factory=list,
        description="User search queries - how users might search for this KBA"
    )
    
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
    
    # Auto-generation flag
    is_auto_generated: bool = False
    
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
    search_questions: Optional[list[str]] = None
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
    search_questions: list[str] = SQLField(sa_column=Column(JSON))
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
    
    # Auto-generation flag
    is_auto_generated: bool = SQLField(default=False, index=True)


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


class SimilarityDecisionLog(SQLModel, table=True):
    """Detailed audit log for similarity check decisions
    
    Records user decisions when similarity matches are found,
    enabling full traceability of whether users chose to reuse
    existing KBAs or create new ones.
    """
    __tablename__ = "kba_similarity_decisions"
    
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    
    # Core identifiers
    ticket_id: str = SQLField(index=True)  # Original ticket (UUID or INC format)
    user_id: str = SQLField(index=True)  # User who made decision
    
    # Similarity check context
    similarity_check_performed: bool = SQLField(default=True)  # Was check executed?
    match_count: int = SQLField(default=0)  # Total matches found
    threshold_used: float = SQLField(default=0.5)  # Minimum threshold (e.g., 0.50)
    strong_match_found: bool = SQLField(default=False)  # Any matches >= 0.70?
    highest_similarity_score: Optional[float] = SQLField(default=None)  # Best match score
    
    # User decision
    decision: str = SQLField(index=True)  # SimilarityDecisionType value
    selected_existing_kba_id: Optional[UUID] = SQLField(default=None, index=True)  # If keep_existing chosen
    created_new_draft_id: Optional[UUID] = SQLField(default=None, index=True)  # If create_new
    
    # User notes
    user_note: Optional[str] = SQLField(default=None)  # Optional reasoning/comment
    
    # Timestamps
    decision_timestamp: datetime = SQLField(default_factory=datetime.now, index=True)
    
    # Additional context (JSON)
    context_data: dict = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
        description="Additional context like match details, comparison results, etc."
    )


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


# ============================================================================
# SIMILARITY/DUPLICATE CHECK MODELS
# ============================================================================

class KBASimilarityMatch(BaseModel):
    """Single similarity match result"""
    draft: KBADraft = Field(..., description="The matching KBA draft")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Similarity score (0.0-1.0)")
    match_reasons: list[str] = Field(
        default_factory=list,
        description="Reasons for match (e.g., 'similar symptoms', 'same tags')"
    )
    is_strong_match: bool = Field(
        default=False,
        description="True if score >= 0.7 (probable duplicate)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "draft": {"id": "...", "title": "VPN-Verbindungsprobleme beheben"},
                "similarity_score": 0.85,
                "match_reasons": ["Ähnliche Symptome", "VPN-Tag übereinstimmend", "Windows-Plattform"],
                "is_strong_match": True
            }
        }


class KBASimilarityResult(BaseModel):
    """Response for similarity check"""
    query_text: str = Field(..., description="Original query (ticket summary)")
    primary_matches: list[KBASimilarityMatch] = Field(
        default_factory=list,
        description="Matches from published/reviewed KBAs"
    )
    draft_matches: list[KBASimilarityMatch] = Field(
        default_factory=list,
        description="Matches from draft-status KBAs (shown separately)"
    )
    total_primary_matches: int = Field(default=0, description="Count of primary matches")
    total_draft_matches: int = Field(default=0, description="Count of draft matches")
    used_fallback: bool = Field(
        default=False,
        description="True if keyword fallback was used (OpenAI unavailable)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "query_text": "VPN funktioniert nicht auf Windows 11",
                "primary_matches": [],
                "draft_matches": [],
                "total_primary_matches": 3,
                "total_draft_matches": 1,
                "used_fallback": False
            }
        }


class KBACompareRequest(BaseModel):
    """Request for comparing ticket with existing KBA"""
    draft_id: UUID = Field(..., description="ID of existing KBA to compare against")
    ticket_id: Union[UUID, str] = Field(..., description="Ticket ID to compare")
    
    class Config:
        json_schema_extra = {
            "example": {
                "draft_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "ticket_id": "INC000016349815"
            }
        }


class KBACompareResult(BaseModel):
    """
    Result of LLM-based comparison between ticket problem and existing KBA
    
    Provides structured assessment using multiple criteria:
    - Problem/symptom alignment
    - Cause alignment  
    - Solution coverage
    - Completeness, clarity, and currency
    - Redundancy risk assessment
    
    Includes actionable recommendation (keep_existing | create_new | merge_candidate)
    """
    draft_id: UUID
    ticket_id: str
    
    # Core assessment fields (NEW)
    duplicate_likelihood: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Likelihood that existing KBA covers the problem (0.0-1.0)"
    )
    match_summary: str = Field(
        ...,
        min_length=50,
        max_length=1000,
        description="Summary of similarities and differences"
    )
    strengths_existing_kba: list[str] = Field(
        ...,
        min_length=0,
        max_length=10,
        description="Strengths of existing KBA (e.g., 'Complete solution steps', 'Clear symptom description')"
    )
    gaps_existing_kba: list[str] = Field(
        ...,
        min_length=0,
        max_length=10,
        description="Gaps or weaknesses in existing KBA (e.g., 'Missing cause', 'Incomplete solution')"
    )
    recommendation: str = Field(
        ...,
        pattern="^(keep_existing|create_new|merge_candidate)$",
        description="Action recommendation: keep_existing, create_new, or merge_candidate"
    )
    recommendation_reason: str = Field(
        ...,
        min_length=100,
        max_length=1500,
        description="Detailed justification for the recommendation"
    )
    confidence_notes: Optional[str] = Field(
        None,
        max_length=800,
        description="Notes on confidence, uncertainties, or limitations"
    )
    
    # Legacy fields for backwards compatibility (DEPRECATED)
    is_duplicate: bool = Field(
        default=False,
        description="DEPRECATED: Use duplicate_likelihood >= 0.7 instead"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="DEPRECATED: Use duplicate_likelihood instead"
    )
    analysis: str = Field(
        default="",
        description="DEPRECATED: Use match_summary instead"
    )
    
    def model_post_init(self, __context):
        """Auto-populate legacy fields for backwards compatibility"""
        if not self.is_duplicate and self.duplicate_likelihood >= 0.7:
            object.__setattr__(self, 'is_duplicate', True)
        if self.confidence == 0.0:
            object.__setattr__(self, 'confidence', self.duplicate_likelihood)
        if not self.analysis:
            object.__setattr__(self, 'analysis', self.match_summary)
    
    class Config:
        json_schema_extra = {
            "example": {
                "draft_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "ticket_id": "INC000016349815",
                "duplicate_likelihood": 0.88,
                "match_summary": "Ticket beschreibt VPN-Verbindungsprobleme unter Windows 11. Bestehender KBA behandelt exakt dieses Problem mit vollständiger Lösung.",
                "strengths_existing_kba": [
                    "Vollständige Schritt-für-Schritt-Anleitung",
                    "Klare Symptombeschreibung",
                    "Lösung ist getestet"
                ],
                "gaps_existing_kba": [
                    "Keine Windows 11 22H2 spezifischen Warnungen"
                ],
                "recommendation": "keep_existing",
                "recommendation_reason": "Der bestehende KBA deckt das Problem vollständig ab. Neuer KBA wäre redundant.",
                "confidence_notes": "Sehr hohe Konfidenz aufgrund identischer Symptome.",
                "is_duplicate": True,
                "confidence": 0.88,
                "analysis": "Ticket beschreibt VPN-Verbindungsprobleme unter Windows 11. Bestehender KBA behandelt exakt dieses Problem mit vollständiger Lösung."
            }
        }


class SimilarityDecisionRequest(BaseModel):
    """Request to log a user's similarity check decision
    
    Used to audit and track when users choose to keep existing KBAs
    vs. creating new ones after viewing similarity matches.
    """
    ticket_id: str = Field(..., description="Original ticket ID (UUID or Incident ID)")
    user_id: str = Field(..., description="User making the decision")
    
    # Similarity check context
    similarity_check_performed: bool = Field(default=True)
    match_count: int = Field(default=0, ge=0)
    threshold_used: float = Field(default=0.5, ge=0.0, le=1.0)
    strong_match_found: bool = Field(default=False)
    highest_similarity_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    
    # User decision
    decision: SimilarityDecisionType
    selected_existing_kba_id: Optional[UUID] = Field(
        default=None,
        description="If decision=keep_existing, which KBA was chosen"
    )
    created_new_draft_id: Optional[UUID] = Field(
        default=None,
        description="If decision=create_new*, the new draft ID"
    )
    
    # Optional user reasoning
    user_note: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Optional note explaining the decision"
    )
    
    # Additional context
    context_data: dict = Field(
        default_factory=dict,
        description="Additional context (e.g., match details, comparison results)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "ticket_id": "INC000016349815",
                "user_id": "user@example.com",
                "similarity_check_performed": True,
                "match_count": 3,
                "threshold_used": 0.5,
                "strong_match_found": True,
                "highest_similarity_score": 0.88,
                "decision": "keep_existing",
                "selected_existing_kba_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "user_note": "Bestehender KBA deckt das Problem vollständig ab, keine Änderungen nötig.",
                "context_data": {
                    "comparison_recommendation": "keep_existing",
                    "duplicate_likelihood": 0.88
                }
            }
        }


class SimilarityDecisionResponse(BaseModel):
    """Response after logging a similarity decision"""
    id: UUID = Field(..., description="ID of the logged decision")
    ticket_id: str
    decision: SimilarityDecisionType
    timestamp: datetime
    message: str = Field(default="Decision logged successfully")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
                "ticket_id": "INC000016349815",
                "decision": "keep_existing",
                "timestamp": "2026-03-04T10:30:00Z",
                "message": "Decision logged successfully"
            }
        }


# ============================================================================
# EMBEDDINGS TABLE
# ============================================================================

class KBAEmbeddingTable(SQLModel, table=True):
    """SQLModel table for KBA embeddings (vector search)"""
    __tablename__ = "kba_embeddings"
    
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    draft_id: UUID = SQLField(index=True, unique=True)  # One embedding per draft
    embedding_json: str = SQLField(description="JSON-serialized embedding vector")
    indexed_at: datetime = SQLField(default_factory=datetime.now, index=True)
    model_name: str = SQLField(default="text-embedding-3-small")
    
    # Optional: Store searchable text used for embedding generation
    searchable_text: Optional[str] = SQLField(default=None, description="Text that was embedded")

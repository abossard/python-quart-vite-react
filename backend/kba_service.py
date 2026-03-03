"""
KBA Service - Core Business Logic

Main service for KBA draft generation, management, and publishing.
Coordinates between LLM (OpenAI), Guidelines, CSV tickets, and Audit logging.

Following "Deep Modules" philosophy:
- Simple interface: generate_draft(), get_draft(), update_draft(), publish_draft()
- Complex implementation: LLM integration, parsing, retry logic, validation

Key responsibilities:
- Generate KBA drafts from tickets using OpenAI
- Parse and validate LLM output
- Manage draft lifecycle (draft → reviewed → published)
- Coordinate with audit service for logging
"""

import logging
from datetime import datetime
from time import perf_counter
from typing import Optional, Union
from uuid import UUID, uuid4

from sqlmodel import Session, select, desc

from csv_data import get_csv_ticket_service
from guidelines_loader import get_guidelines_loader
from kba_audit import KBAAuditService
from kba_exceptions import (
    DraftNotFoundError,
    DuplicateKBADraftError,
    InvalidLLMOutputError,
    InvalidStatusError,
    TicketNotFoundError,
    LLMUnavailableError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMAuthenticationError,
)
from kba_models import (
    KBAAuditEventType,
    KBADraft,
    KBADraftCreate,
    KBADraftFilter,
    KBADraftListResponse,
    KBADraftStatus,
    KBADraftTable,
    KBADraftUpdate,
    KBAPublishRequest,
    KBAPublishResult,
)
from kba_prompts import build_kba_prompt
from kba_output_models import KBAOutputSchema
from llm_service import LLMService, get_llm_service
from kb_adapters import get_kb_adapter, KBPublishResult as AdapterPublishResult

logger = logging.getLogger(__name__)


class KBAService:
    """Core service for KBA draft management"""
    
    def __init__(
        self,
        session: Session,
        llm_service: Optional[LLMService] = None,
        audit_service: Optional[KBAAuditService] = None
    ):
        """
        Initialize KBA service
        
        Args:
            session: SQLModel database session
            llm_service: LLM service for draft generation (default: singleton)
            audit_service: Audit logging service
        """
        self.session = session
        self.llm = llm_service or get_llm_service()
        self.audit = audit_service or KBAAuditService(session)
        self.csv_service = get_csv_ticket_service()
        self.guidelines_loader = get_guidelines_loader()
    
    async def generate_draft(self, create_req: KBADraftCreate) -> KBADraft:
        """
        Generate new KBA draft from ticket using OpenAI
        
        Args:
            create_req: Creation request with ticket_id and options
            
        Returns:
            Generated KBADraft object
            
        Raises:
            TicketNotFoundError: If ticket doesn't exist
            LLMUnavailableError: If OpenAI service is not reachable
            InvalidLLMOutputError: If LLM output cannot be parsed after retries
        """
        start_time = perf_counter()
        
        logger.info(
            "KBA draft generation started",
            extra={
                "ticket_id": str(create_req.ticket_id),
                "user_id": create_req.user_id
            }
        )
        
        # 1. Load ticket (support UUID or Incident-ID format)
        ticket_id_str = str(create_req.ticket_id)
        
        # Check if input looks like Incident-ID (e.g., INC000016349815)
        if ticket_id_str.startswith('INC') and len(ticket_id_str) == 15:
            # Incident-ID format - convert to UUID
            from csv_data import generate_uuid_from_incident_id
            actual_uuid = generate_uuid_from_incident_id(ticket_id_str)
            ticket = self.csv_service.get_ticket(actual_uuid)
            logger.debug(f"Converted Incident-ID {ticket_id_str} to UUID {actual_uuid}")
        else:
            # Standard UUID format
            ticket = self.csv_service.get_ticket(create_req.ticket_id)
        
        if not ticket:
            raise TicketNotFoundError(
                f"Ticket {create_req.ticket_id} not found in CSV data"
            )
        
        # 2. Check for existing drafts (unless force_create is True)
        if not create_req.force_create:
            existing_drafts = self.check_existing_drafts(create_req.ticket_id)
            if existing_drafts:
                # Format existing drafts for error response
                existing_summary = [
                    {
                        "id": str(draft.id),
                        "status": draft.status.value if hasattr(draft.status, 'value') else str(draft.status),
                        "title": draft.title,
                        "created_at": draft.created_at.isoformat() if draft.created_at else None,
                        "incident_id": draft.incident_id
                    }
                    for draft in existing_drafts
                ]
                logger.info(
                    "KBA draft already exists",
                    extra={
                        "ticket_id": str(create_req.ticket_id),
                        "existing_count": len(existing_drafts)
                    }
                )
                raise DuplicateKBADraftError(
                    f"{len(existing_drafts)} KBA draft(s) already exist for ticket {create_req.ticket_id}",
                    existing_summary
                )
        
        # 3. Load guidelines
        if create_req.custom_guidelines:
            guidelines = self.guidelines_loader.get_combined(create_req.custom_guidelines)
            guidelines_used = create_req.custom_guidelines
        else:
            guidelines_used = self.guidelines_loader.detect_categories_from_ticket(ticket)
            guidelines = self.guidelines_loader.get_combined(guidelines_used)
        
        logger.debug(
            f"Guidelines loaded",
            extra={"guidelines_used": guidelines_used, "length": len(guidelines)}
        )
        
        # 4. Build prompt
        prompt = build_kba_prompt(ticket, guidelines)
        
        # 5. Call OpenAI with structured output
        llm_start = perf_counter()
        try:
            kba_data = await self._generate_with_structured_output(prompt)
        except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError, LLMAuthenticationError) as e:
            logger.error(f"LLM service error: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to generate structured output: {e}")
            raise InvalidLLMOutputError(
                f"Could not generate valid KBA structure: {str(e)}"
            )
        llm_time_ms = int((perf_counter() - llm_start) * 1000)
        
        # 6. Create KBADraft object (handle both new and legacy field names)
        draft = KBADraft(
            id=uuid4(),
            ticket_id=create_req.ticket_id,
            incident_id=ticket.incident_id,
            title=kba_data["title"],
            # New structured fields
            symptoms=kba_data.get("symptoms", []),
            cause=kba_data.get("cause"),
            resolution_steps=kba_data.get("resolution_steps", []),
            validation_checks=kba_data.get("validation_checks", []),
            warnings=kba_data.get("warnings", []),
            confidence_notes=kba_data.get("confidence_notes"),
            # Legacy fields (backward compatibility)
            problem_description=kba_data.get("problem_description", ""),
            additional_notes=kba_data.get("additional_notes", ""),
            tags=kba_data["tags"],
            related_tickets=kba_data.get("related_tickets", []),
            guidelines_used=guidelines_used,
            status=KBADraftStatus.DRAFT,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=create_req.user_id,
            llm_model=self.llm.model,
            llm_generation_time_ms=llm_time_ms
        )
        
        # 7. Save to database
        draft_table = self._draft_to_table(draft)
        self.session.add(draft_table)
        self.session.commit()
        self.session.refresh(draft_table)
        
        total_time_ms = int((perf_counter() - start_time) * 1000)
        
        # 8. Audit log
        self.audit.log_event(
            draft_id=draft.id,
            event_type=KBAAuditEventType.DRAFT_GENERATED,
            user_id=create_req.user_id,
            details={
                "ticket_id": str(create_req.ticket_id),
                "incident_id": ticket.incident_id,
                "llm_model": draft.llm_model,
                "generation_time_ms": llm_time_ms,
                "total_time_ms": total_time_ms,
                "guidelines_used": guidelines_used
            }
        )
        
        logger.info(
            "KBA draft generated successfully",
            extra={
                "draft_id": str(draft.id),
                "ticket_id": str(create_req.ticket_id),
                "total_time_ms": total_time_ms
            }
        )
        
        return draft
    
    async def _generate_with_structured_output(self, prompt: str) -> dict:
        """
        Generate KBA draft using OpenAI structured output
        
        Uses OpenAI's native beta.chat.completions.parse() for automatic
        Pydantic parsing and validation. No manual parsing or retry needed.
        
        Args:
            prompt: KBA generation prompt
            
        Returns:
            Validated KBA data dict
            
        Raises:
            LLMUnavailableError: If OpenAI not reachable
            LLMTimeoutError: If request times out
            InvalidLLMOutputError: If parsing/validation fails
        """
        logger.debug("Calling OpenAI with structured output")
        
        try:
            # Single call with automatic Pydantic parsing
            result: KBAOutputSchema = await self.llm.structured_chat(
                messages=[{"role": "user", "content": prompt}],
                output_schema=KBAOutputSchema
            )
            
            # Convert Pydantic model to dict
            kba_data = result.model_dump()
            
            logger.info(
                "Structured output generated successfully",
                extra={
                    "title": kba_data.get("title", "")[:50],
                    "symptom_count": len(kba_data.get("symptoms", [])),
                    "step_count": len(kba_data.get("resolution_steps", [])),
                    "tag_count": len(kba_data.get("tags", []))
                }
            )
            
            return kba_data
        
        except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError, LLMAuthenticationError) as e:
            # Log and re-raise LLM service errors
            logger.error(f"LLM service error during KBA generation: {e}")
            raise
        
        except Exception as e:
            # Wrap unexpected errors as InvalidLLMOutputError
            logger.error(f"Unexpected error in structured output: {e}", exc_info=True)
            raise InvalidLLMOutputError(f"Failed to generate valid KBA: {e}")
    
    def get_draft(self, draft_id: UUID) -> KBADraft:
        """
        Get KBA draft by ID
        
        Args:
            draft_id: UUID of the draft
            
        Returns:
            KBADraft object
            
        Raises:
            DraftNotFoundError: If draft doesn't exist
        """
        statement = select(KBADraftTable).where(KBADraftTable.id == draft_id)
        draft_table = self.session.exec(statement).first()
        
        if not draft_table:
            raise DraftNotFoundError(f"Draft {draft_id} not found")
        
        return self._table_to_draft(draft_table)
    
    def update_draft(
        self,
        draft_id: UUID,
        update: KBADraftUpdate,
        user_id: str
    ) -> KBADraft:
        """
        Update KBA draft
        
        Args:
            draft_id: UUID of the draft
            update: Update data
            user_id: User making the update
            
        Returns:
            Updated KBADraft
            
        Raises:
            DraftNotFoundError: If draft doesn't exist
        """
        draft_table = self.session.exec(
            select(KBADraftTable).where(KBADraftTable.id == draft_id)
        ).first()
        
        if not draft_table:
            raise DraftNotFoundError(f"Draft {draft_id} not found")
        
        # Track changed fields
        changed_fields = []
        
        # Update fields
        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(draft_table, field, value)
                changed_fields.append(field)
        
        draft_table.updated_at = datetime.now()
        
        self.session.add(draft_table)
        self.session.commit()
        self.session.refresh(draft_table)
        
        # Audit log
        self.audit.log_event(
            draft_id=draft_id,
            event_type=KBAAuditEventType.DRAFT_EDITED,
            user_id=user_id,
            details={
                "fields_changed": changed_fields,
                "new_status": draft_table.status
            }
        )
        
        logger.info(
            f"Draft updated",
            extra={"draft_id": str(draft_id), "fields_changed": changed_fields}
        )
        
        return self._table_to_draft(draft_table)
    
    def check_existing_drafts(self, ticket_id: Union[UUID, str]) -> list[KBADraft]:
        """
        Check for existing KBA drafts for a ticket
        
        Args:
            ticket_id: UUID or Incident-ID of the ticket
            
        Returns:
            List of existing drafts (all statuses)
        """
        # Convert Incident-ID to UUID if needed
        ticket_id_str = str(ticket_id)
        actual_ticket_id: UUID
        
        if ticket_id_str.startswith('INC') and len(ticket_id_str) == 15:
            from csv_data import generate_uuid_from_incident_id
            actual_ticket_id = generate_uuid_from_incident_id(ticket_id_str)
        elif isinstance(ticket_id, UUID):
            actual_ticket_id = ticket_id
        else:
            actual_ticket_id = UUID(ticket_id_str)
        
        # Query drafts by ticket_id
        filters = KBADraftFilter(ticket_id=actual_ticket_id, limit=100)
        result = self.list_drafts(filters)
        return result.items
    
    def list_drafts(self, filters: KBADraftFilter) -> KBADraftListResponse:
        """
        List KBA drafts with filtering
        
        Args:
            filters: Filter criteria
            
        Returns:
            List response with items and pagination
        """
        statement = select(KBADraftTable)
        
        if filters.status:
            statement = statement.where(KBADraftTable.status == filters.status.value)
        if filters.created_by:
            statement = statement.where(KBADraftTable.created_by == filters.created_by)
        if filters.ticket_id:
            statement = statement.where(KBADraftTable.ticket_id == filters.ticket_id)
        if filters.incident_id:
            statement = statement.where(KBADraftTable.incident_id == filters.incident_id)
        
        # Count total
        total = len(self.session.exec(statement).all())
        
        # Apply pagination
        statement = statement.offset(filters.offset).limit(filters.limit)
        statement = statement.order_by(desc(KBADraftTable.created_at))
        
        draft_tables = self.session.exec(statement).all()
        drafts = [self._table_to_draft(dt) for dt in draft_tables]
        
        return KBADraftListResponse(
            items=drafts,
            total=total,
            limit=filters.limit,
            offset=filters.offset
        )
    
    async def replace_draft(self, draft_id: UUID, user_id: str) -> KBADraft:
        """
        Replace/regenerate a KBA draft with new content from LLM
        
        Loads the existing draft, regenerates content using OpenAI,
        and updates all content fields while keeping the same ID.
        Resets status to DRAFT if it was REVIEWED or PUBLISHED.
        
        Args:
            draft_id: UUID of the draft to replace
            user_id: User ID requesting replacement (for audit)
            
        Returns:
            Updated KBADraft with new content
            
        Raises:
            DraftNotFoundError: If draft doesn't exist
            TicketNotFoundError: If associated ticket no longer exists
            LLMUnavailableError: If OpenAI service is not reachable
        """
        start_time = perf_counter()
        
        # 1. Load existing draft
        draft_table = self.session.exec(
            select(KBADraftTable).where(KBADraftTable.id == draft_id)
        ).first()
        
        if not draft_table:
            raise DraftNotFoundError(f"Draft {draft_id} not found")
        
        logger.info(
            "Replacing KBA draft",
            extra={
                "draft_id": str(draft_id),
                "ticket_id": str(draft_table.ticket_id),
                "user_id": user_id
            }
        )
        
        # 2. Load ticket
        ticket = self.csv_service.get_ticket(draft_table.ticket_id)
        if not ticket:
            raise TicketNotFoundError(
                f"Ticket {draft_table.ticket_id} not found in CSV data"
            )
        
        # 3. Load guidelines (use original guidelines if available)
        if draft_table.guidelines_used:
            guidelines = self.guidelines_loader.get_combined(draft_table.guidelines_used)
            guidelines_used = draft_table.guidelines_used
        else:
            guidelines_used = self.guidelines_loader.detect_categories_from_ticket(ticket)
            guidelines = self.guidelines_loader.get_combined(guidelines_used)
        
        # 4. Build prompt
        prompt = build_kba_prompt(ticket, guidelines)
        
        # 5. Call OpenAI with structured output
        llm_start = perf_counter()
        try:
            kba_data = await self._generate_with_structured_output(prompt)
        except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError, LLMAuthenticationError) as e:
            logger.error(f"LLM service error during replacement: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to regenerate structured output: {e}")
            raise InvalidLLMOutputError(
                f"Could not generate valid KBA structure: {str(e)}"
            )
        llm_time_ms = int((perf_counter() - llm_start) * 1000)
        
        # 6. Update all content fields
        draft_table.title = kba_data["title"]
        draft_table.symptoms = kba_data.get("symptoms", [])
        draft_table.cause = kba_data.get("cause")
        draft_table.resolution_steps = kba_data.get("resolution_steps", [])
        draft_table.validation_checks = kba_data.get("validation_checks", [])
        draft_table.warnings = kba_data.get("warnings", [])
        draft_table.confidence_notes = kba_data.get("confidence_notes")
        draft_table.tags = kba_data["tags"]
        draft_table.related_tickets = kba_data.get("related_tickets", [])
        draft_table.guidelines_used = guidelines_used
        
        # Legacy fields
        draft_table.problem_description = kba_data.get("problem_description", "")
        draft_table.additional_notes = kba_data.get("additional_notes", "")
        
        # 7. Reset status to DRAFT and update metadata
        draft_table.status = KBADraftStatus.DRAFT.value
        draft_table.updated_at = datetime.now()
        draft_table.llm_model = self.llm.model
        draft_table.llm_generation_time_ms = llm_time_ms
        
        # Clear review/publish metadata if it was reviewed or published
        draft_table.reviewed_by = None
        draft_table.published_at = None
        draft_table.published_url = None
        draft_table.published_id = None
        
        self.session.add(draft_table)
        self.session.commit()
        self.session.refresh(draft_table)
        
        total_time_ms = int((perf_counter() - start_time) * 1000)
        
        # 8. Audit log
        self.audit.log_event(
            draft_id=draft_id,
            event_type=KBAAuditEventType.DRAFT_EDITED,
            user_id=user_id,
            details={
                "action": "regenerated",
                "ticket_id": str(draft_table.ticket_id),
                "incident_id": draft_table.incident_id,
                "llm_model": draft_table.llm_model,
                "generation_time_ms": llm_time_ms,
                "total_time_ms": total_time_ms,
                "status_reset": "draft"
            }
        )
        
        logger.info(
            "KBA draft replaced successfully",
            extra={
                "draft_id": str(draft_id),
                "ticket_id": str(draft_table.ticket_id),
                "total_time_ms": total_time_ms
            }
        )
        
        return self._table_to_draft(draft_table)
    
    def delete_draft(self, draft_id: UUID, user_id: str) -> bool:
        """
        Delete a KBA draft
        
        Args:
            draft_id: UUID of the draft to delete
            user_id: User ID requesting deletion (for audit)
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            InvalidStatusError: If draft is already published
        """
        draft_table = self.session.get(KBADraftTable, draft_id)
        if not draft_table:
            return False
        
        # Prevent deletion of published drafts
        if draft_table.status == KBADraftStatus.PUBLISHED.value:
            raise InvalidStatusError(
                f"Cannot delete published draft {draft_id}"
            )
        
        # Log deletion in audit trail
        self.audit.log_event(
            event_type=KBAAuditEventType.DRAFT_DELETED,
            draft_id=draft_id,
            user_id=user_id,
            details={"title": draft_table.title, "status": draft_table.status}
        )
        
        # Delete from database
        self.session.delete(draft_table)
        self.session.commit()
        
        logger.info(
            f"Draft deleted",
            extra={"draft_id": str(draft_id), "user_id": user_id}
        )
        
        return True
    
    async def publish_draft(
        self,
        draft_id: UUID,
        publish_req: KBAPublishRequest
    ) -> KBAPublishResult:
        """
        Publish KBA draft to target system
        
        Implements idempotent publishing with proper validation:
        - Checks if already published (returns existing result)
        - Validates status (must be DRAFT or REVIEWED)
        - Uses KB adapter for actual publishing
        - Updates metadata and audit trail
        
        Args:
            draft_id: UUID of the draft
            publish_req: Publishing request with target_system, category, user_id
            
        Returns:
            Result with success status, published URL and ID
            
        Raises:
            DraftNotFoundError: If draft doesn't exist
            InvalidStatusError: If draft is in FAILED status
            PublishFailedError: If publishing fails
        """
        # 1. Load draft
        draft_table = self.session.exec(
            select(KBADraftTable).where(KBADraftTable.id == draft_id)
        ).first()
        
        if not draft_table:
            raise DraftNotFoundError(f"Draft {draft_id} not found")
        
        # 2. Idempotency check - if already published, return existing result
        if draft_table.status == KBADraftStatus.PUBLISHED.value:
            logger.info(
                f"Draft {draft_id} already published, returning existing result",
                extra={
                    "published_id": draft_table.published_id,
                    "published_at": str(draft_table.published_at)
                }
            )
            return KBAPublishResult(
                success=True,
                published_url=draft_table.published_url,
                published_id=draft_table.published_id,
                message=f"KBA was already published on {draft_table.published_at.strftime('%Y-%m-%d %H:%M')}"
            )
        
        # 3. Validate status - can publish from DRAFT or REVIEWED
        if draft_table.status == KBADraftStatus.FAILED.value:
            raise InvalidStatusError(
                f"Cannot publish draft in FAILED status. Please review and fix issues first."
            )
        
        # 4. Automatically transition DRAFT → REVIEWED if not already reviewed
        if draft_table.status == KBADraftStatus.DRAFT.value:
            logger.info(f"Auto-transitioning draft {draft_id} from DRAFT to REVIEWED before publishing")
            draft_table.status = KBADraftStatus.REVIEWED.value
            draft_table.reviewed_by = publish_req.user_id
            self.session.add(draft_table)
            self.session.commit()
        
        # 5. Prepare draft data for adapter
        draft_dict = {
            "id": str(draft_table.id),
            "ticket_id": str(draft_table.ticket_id),
            "incident_id": draft_table.incident_id,
            "title": draft_table.title,
            "symptoms": draft_table.symptoms,
            "cause": draft_table.cause,
            "resolution_steps": draft_table.resolution_steps,
            "validation_checks": draft_table.validation_checks,
            "warnings": draft_table.warnings,
            "confidence_notes": draft_table.confidence_notes,
            "problem_description": draft_table.problem_description,
            "additional_notes": draft_table.additional_notes,
            "tags": draft_table.tags,
            "related_tickets": draft_table.related_tickets,
        }
        
        # 6. Get KB adapter and publish
        try:
            # Configure adapter based on target system
            adapter_config = self._get_adapter_config(publish_req.target_system)
            adapter = get_kb_adapter(publish_req.target_system, adapter_config)
            
            logger.info(
                f"Publishing draft {draft_id} to {publish_req.target_system}",
                extra={"category": publish_req.category, "visibility": publish_req.visibility}
            )
            
            # Actual publishing
            result: AdapterPublishResult = await adapter.publish(
                draft_dict=draft_dict,
                category=publish_req.category,
                visibility=publish_req.visibility
            )
            
            if not result.success:
                # Publishing failed
                draft_table.status = KBADraftStatus.FAILED.value
                self.session.add(draft_table)
                self.session.commit()
                
                # Log failure
                self.audit.log_event(
                    draft_id=draft_id,
                    event_type=KBAAuditEventType.PUBLISH_FAILED,
                    user_id=publish_req.user_id,
                    details={
                        "target_system": publish_req.target_system,
                        "error": result.error_message,
                        "category": publish_req.category
                    }
                )
                
                from kba_exceptions import PublishFailedError
                raise PublishFailedError(
                    f"Failed to publish to {publish_req.target_system}: {result.error_message}"
                )
            
            # 7. Update draft with published metadata
            draft_table.status = KBADraftStatus.PUBLISHED.value
            draft_table.published_at = datetime.now()
            draft_table.published_url = result.published_url
            draft_table.published_id = result.published_id
            
            self.session.add(draft_table)
            self.session.commit()
            
            # 8. Audit log success
            self.audit.log_event(
                draft_id=draft_id,
                event_type=KBAAuditEventType.DRAFT_PUBLISHED,
                user_id=publish_req.user_id,
                details={
                    "target_system": publish_req.target_system,
                    "category": publish_req.category,
                    "visibility": publish_req.visibility,
                    "published_url": result.published_url,
                    "published_id": result.published_id,
                    "metadata": result.metadata
                }
            )
            
            logger.info(
                f"Draft published successfully",
                extra={
                    "draft_id": str(draft_id),
                    "published_id": result.published_id,
                    "target_system": publish_req.target_system
                }
            )
            
            return KBAPublishResult(
                success=True,
                published_url=result.published_url,
                published_id=result.published_id,
                message=f"KBA successfully published to {publish_req.target_system}"
            )
            
        except Exception as e:
            # Handle unexpected errors
            draft_table.status = KBADraftStatus.FAILED.value
            self.session.add(draft_table)
            self.session.commit()
            
            self.audit.log_event(
                draft_id=draft_id,
                event_type=KBAAuditEventType.PUBLISH_FAILED,
                user_id=publish_req.user_id,
                details={
                    "target_system": publish_req.target_system,
                    "error": str(e),
                    "exception_type": type(e).__name__
                }
            )
            
            logger.error(
                f"Unexpected error publishing draft {draft_id}",
                exc_info=True,
                extra={"draft_id": str(draft_id), "target_system": publish_req.target_system}
            )
            
            from kba_exceptions import PublishFailedError
            raise PublishFailedError(f"Unexpected error during publishing: {str(e)}") from e
    
    def _get_adapter_config(self, target_system: str) -> dict:
        """
        Get configuration for KB adapter
        
        In production, this should load from environment variables or config service.
        For MVP, returns sensible defaults.
        
        Args:
            target_system: Target system name
            
        Returns:
            Configuration dict for adapter
        """
        configs = {
            "file": {
                "base_path": "./kb_published",
                "create_categories": True
            },
            "sharepoint": {
                "site_url": "https://example.sharepoint.com/sites/KB",
                "client_id": "...",  # TODO: Load from env
                "client_secret": "..."  # TODO: Load from env
            },
            "itsm": {
                "instance_url": "https://example.service-now.com",
                "username": "...",  # TODO: Load from env
                "password": "..."  # TODO: Load from env
            },
            "confluence": {
                "base_url": "https://example.atlassian.net",
                "username": "...",  # TODO: Load from env
                "api_token": "..."  # TODO: Load from env
            }
        }
        
        return configs.get(target_system, {})
    
    def _draft_to_table(self, draft: KBADraft) -> KBADraftTable:
        """Convert KBADraft to KBADraftTable for persistence"""
        # Convert Incident-ID to UUID if needed
        from csv_data import generate_uuid_from_incident_id
        ticket_uuid = draft.ticket_id
        if isinstance(ticket_uuid, str):
            # Incident-ID format - convert to UUID
            ticket_uuid = generate_uuid_from_incident_id(ticket_uuid)
        
        return KBADraftTable(
            id=draft.id,
            ticket_id=ticket_uuid,
            incident_id=draft.incident_id,
            title=draft.title,
            symptoms=draft.symptoms,
            cause=draft.cause,
            resolution_steps=draft.resolution_steps,
            validation_checks=draft.validation_checks,
            warnings=draft.warnings,
            confidence_notes=draft.confidence_notes,
            problem_description=draft.problem_description or "",
            additional_notes=draft.additional_notes or "",
            tags=draft.tags,
            related_tickets=draft.related_tickets,
            guidelines_used=draft.guidelines_used,
            status=draft.status.value,
            created_at=draft.created_at,
            updated_at=draft.updated_at,
            created_by=draft.created_by,
            reviewed_by=draft.reviewed_by,
            published_at=draft.published_at,
            published_url=draft.published_url,
            published_id=draft.published_id,
            llm_model=draft.llm_model,
            llm_generation_time_ms=draft.llm_generation_time_ms
        )
    
    def _table_to_draft(self, table: KBADraftTable) -> KBADraft:
        """Convert KBADraftTable to KBADraft"""
        return KBADraft(
            id=table.id,
            ticket_id=table.ticket_id,
            incident_id=table.incident_id,
            title=table.title,
            symptoms=table.symptoms,
            cause=table.cause,
            resolution_steps=table.resolution_steps,
            validation_checks=table.validation_checks,
            warnings=table.warnings,
            confidence_notes=table.confidence_notes,
            problem_description=table.problem_description,
            additional_notes=table.additional_notes,
            tags=table.tags,
            related_tickets=table.related_tickets,
            guidelines_used=table.guidelines_used,
            status=KBADraftStatus(table.status),
            created_at=table.created_at,
            updated_at=table.updated_at,
            created_by=table.created_by,
            reviewed_by=table.reviewed_by,
            published_at=table.published_at,
            published_url=table.published_url,
            published_id=table.published_id,
            llm_model=table.llm_model,
            llm_generation_time_ms=table.llm_generation_time_ms
        )


# Singleton instance (will be initialized with session in operations.py)
_kba_service: Optional[KBAService] = None


def get_kba_service(session: Session) -> KBAService:
    """
    Get KBAService instance
    
    Args:
        session: SQLModel database session
        
    Returns:
        KBAService instance
    """
    return KBAService(session)

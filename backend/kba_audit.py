"""
KBA Audit Service

Provides comprehensive audit logging for KBA draft lifecycle.
All events (generate, view, edit, publish, delete) are logged with full context.

Following "Grokking Simplicity":
- Actions: Database writes (audit logs)
- Clear separation: Service layer handles business logic
- Pure calculations: Event formatting

Audit trail enables:
- Compliance tracking
- Troubleshooting
- User accountability
- System analytics
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlmodel import Session, select, asc, desc

from kba_models import (
    KBAAuditEvent,
    KBAAuditEventType,
    KBAAuditLog,
    SimilarityDecisionLog,
    SimilarityDecisionRequest,
    SimilarityDecisionResponse,
    SimilarityDecisionType,
)

logger = logging.getLogger(__name__)


class KBAAuditService:
    """Service for logging KBA draft audit events"""
    
    def __init__(self, session: Session):
        """
        Initialize audit service
        
        Args:
            session: SQLModel database session
        """
        self.session = session
    
    def log_event(
        self,
        draft_id: UUID,
        event_type: KBAAuditEventType,
        user_id: str,
        details: Optional[dict] = None
    ) -> KBAAuditEvent:
        """
        Log audit event to database and application logger
        
        Args:
            draft_id: UUID of the KBA draft
            event_type: Type of event (from KBAAuditEventType enum)
            user_id: User ID who triggered the event
            details: Optional JSON metadata about the event
            
        Returns:
            Created KBAAuditEvent object
        """
        # Create audit log entry
        audit_log = KBAAuditLog(
            draft_id=draft_id,
            event_type=event_type.value,
            user_id=user_id,
            timestamp=datetime.now(),
            details=details or {}
        )
        
        # Save to database
        self.session.add(audit_log)
        self.session.commit()
        self.session.refresh(audit_log)
        
        # Also log to application logger (for centralized logging systems)
        logger.info(
            f"Audit event: {event_type.value}",
            extra={
                "draft_id": str(draft_id),
                "user_id": user_id,
                "event_type": event_type.value,
                "details": details or {},
                "timestamp": audit_log.timestamp.isoformat()
            }
        )
        
        # Convert to Pydantic model
        event = KBAAuditEvent(
            id=audit_log.id,
            draft_id=audit_log.draft_id,
            event_type=KBAAuditEventType(audit_log.event_type),
            user_id=audit_log.user_id,
            timestamp=audit_log.timestamp,
            details=audit_log.details
        )
        
        return event
    
    def get_audit_trail(self, draft_id: UUID) -> list[KBAAuditEvent]:
        """
        Get complete audit trail for a specific draft
        
        Args:
            draft_id: UUID of the KBA draft
            
        Returns:
            List of audit events ordered by timestamp (ascending)
        """
        statement = select(KBAAuditLog).where(
            KBAAuditLog.draft_id == draft_id
        ).order_by(asc(KBAAuditLog.timestamp))
        
        audit_logs = self.session.exec(statement).all()
        
        # Convert to Pydantic models
        events = [
            KBAAuditEvent(
                id=log.id,
                draft_id=log.draft_id,
                event_type=KBAAuditEventType(log.event_type),
                user_id=log.user_id,
                timestamp=log.timestamp,
                details=log.details
            )
            for log in audit_logs
        ]
        
        logger.debug(
            f"Retrieved audit trail",
            extra={
                "draft_id": str(draft_id),
                "event_count": len(events)
            }
        )
        
        return events
    
    def get_recent_events(
        self,
        limit: int = 100,
        event_type: Optional[KBAAuditEventType] = None,
        user_id: Optional[str] = None
    ) -> list[KBAAuditEvent]:
        """
        Get recent audit events across all drafts
        
        Args:
            limit: Maximum number of events to return
            event_type: Optional filter by event type
            user_id: Optional filter by user
            
        Returns:
            List of recent audit events ordered by timestamp (descending)
        """
        statement = select(KBAAuditLog).order_by(desc(KBAAuditLog.timestamp)).limit(limit)
        
        if event_type:
            statement = statement.where(KBAAuditLog.event_type == event_type.value)
        
        if user_id:
            statement = statement.where(KBAAuditLog.user_id == user_id)
        
        audit_logs = self.session.exec(statement).all()
        
        events = [
            KBAAuditEvent(
                id=log.id,
                draft_id=log.draft_id,
                event_type=KBAAuditEventType(log.event_type),
                user_id=log.user_id,
                timestamp=log.timestamp,
                details=log.details
            )
            for log in audit_logs
        ]
        
        return events
    
    def log_similarity_decision(
        self,
        decision_request: SimilarityDecisionRequest
    ) -> SimilarityDecisionResponse:
        """
        Log a user's decision after similarity check
        
        Records detailed information about whether the user chose to:
        - Keep an existing KBA
        - Create a new KBA (with or without comparison)
        - Cancel the workflow
        
        This enables full audit trail for KBA reuse vs. creation decisions.
        
        Args:
            decision_request: Complete decision context
            
        Returns:
            Response with logged decision ID and timestamp
        """
        # Create decision log entry
        decision_log = SimilarityDecisionLog(
            ticket_id=decision_request.ticket_id,
            user_id=decision_request.user_id,
            similarity_check_performed=decision_request.similarity_check_performed,
            match_count=decision_request.match_count,
            threshold_used=decision_request.threshold_used,
            strong_match_found=decision_request.strong_match_found,
            highest_similarity_score=decision_request.highest_similarity_score,
            decision=decision_request.decision.value,
            selected_existing_kba_id=decision_request.selected_existing_kba_id,
            created_new_draft_id=decision_request.created_new_draft_id,
            user_note=decision_request.user_note,
            decision_timestamp=datetime.now(),
            context_data=decision_request.context_data
        )
        
        # Save to database
        self.session.add(decision_log)
        self.session.commit()
        self.session.refresh(decision_log)
        
        # Also log a general audit event (for backwards compatibility)
        if decision_request.created_new_draft_id:
            self.log_event(
                draft_id=decision_request.created_new_draft_id,
                event_type=KBAAuditEventType.SIMILARITY_DECISION,
                user_id=decision_request.user_id,
                details={
                    "ticket_id": decision_request.ticket_id,
                    "decision": decision_request.decision.value,
                    "match_count": decision_request.match_count,
                    "strong_match_found": decision_request.strong_match_found,
                    "user_note": decision_request.user_note
                }
            )
        
        # Application logging
        logger.info(
            f"Similarity decision logged: {decision_request.decision.value}",
            extra={
                "ticket_id": decision_request.ticket_id,
                "user_id": decision_request.user_id,
                "decision": decision_request.decision.value,
                "match_count": decision_request.match_count,
                "selected_existing_kba": str(decision_request.selected_existing_kba_id) if decision_request.selected_existing_kba_id else None,
                "created_new_draft": str(decision_request.created_new_draft_id) if decision_request.created_new_draft_id else None,
            }
        )
        
        # Build response
        return SimilarityDecisionResponse(
            id=decision_log.id,
            ticket_id=decision_log.ticket_id,
            decision=SimilarityDecisionType(decision_log.decision),
            timestamp=decision_log.decision_timestamp,
            message="Decision logged successfully"
        )
    
    def get_similarity_decisions(
        self,
        ticket_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> list[SimilarityDecisionLog]:
        """
        Retrieve similarity decisions from audit log
        
        Args:
            ticket_id: Optional filter by ticket ID
            user_id: Optional filter by user
            limit: Maximum number of results
            
        Returns:
            List of decision log entries
        """
        statement = select(SimilarityDecisionLog).order_by(
            desc(SimilarityDecisionLog.decision_timestamp)
        ).limit(limit)
        
        if ticket_id:
            statement = statement.where(SimilarityDecisionLog.ticket_id == ticket_id)
        
        if user_id:
            statement = statement.where(SimilarityDecisionLog.user_id == user_id)
        
        decisions = self.session.exec(statement).all()
        
        logger.debug(
            f"Retrieved similarity decisions",
            extra={
                "count": len(decisions),
                "ticket_id": ticket_id,
                "user_id": user_id
            }
        )
        
        return list(decisions)


# Singleton instance (will be initialized with session in operations.py)
_audit_service: Optional[KBAAuditService] = None


def get_audit_service(session: Session) -> KBAAuditService:
    """
    Get KBAAuditService instance
    
    Args:
        session: SQLModel database session
        
    Returns:
        KBAAuditService instance
    """
    return KBAAuditService(session)

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

from sqlmodel import Session, select

from kba_models import KBAAuditEvent, KBAAuditEventType, KBAAuditLog

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
        ).order_by(KBAAuditLog.timestamp.asc())
        
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
        statement = select(KBAAuditLog).order_by(KBAAuditLog.timestamp.desc()).limit(limit)
        
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

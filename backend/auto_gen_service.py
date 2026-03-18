"""
Auto-Generation Service

Service for automatic KBA draft generation from tickets.
Handles ticket selection, draft creation, and scheduling logic.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from auto_gen_models import AutoGenRunResult, AutoGenSettings, AutoGenSettingsTable
from csv_data import CSVTicketService
from kba_models import KBADraft, KBADraftCreate, KBADraftTable
from kba_service import KBAService
from tickets import Ticket, TicketStatus

logger = logging.getLogger(__name__)


class AutoGenService:
    """Service for automatic KBA draft generation"""
    
    def __init__(self):
        self.ticket_service = CSVTicketService()
        self._lock = asyncio.Lock()  # Prevent concurrent runs
    
    def _get_kba_service(self) -> KBAService:
        """Get KBA service with session (lazy initialization)"""
        from operations import _get_kba_session
        session = _get_kba_session()
        return KBAService(session)
    
    # ========================================================================
    # SETTINGS MANAGEMENT
    # ========================================================================
    
    def get_settings(self) -> AutoGenSettings:
        """Get auto-generation settings (creates default if not exists)"""
        from operations import _get_kba_session
        
        with _get_kba_session() as session:
            settings_row = session.get(AutoGenSettingsTable, 1)
            if not settings_row:
                # Create default settings
                settings_row = AutoGenSettingsTable(id=1)
                session.add(settings_row)
                session.commit()
                session.refresh(settings_row)
            
            # Convert SQLModel to Pydantic using model_dump
            return AutoGenSettings(**settings_row.model_dump())
    
    def update_settings(self, updates: dict) -> AutoGenSettings:
        """Update auto-generation settings"""
        from operations import _get_kba_session
        
        with _get_kba_session() as session:
            settings_row = session.get(AutoGenSettingsTable, 1)
            if not settings_row:
                settings_row = AutoGenSettingsTable(id=1)
                session.add(settings_row)
            
            # Apply updates
            for key, value in updates.items():
                if value is not None and hasattr(settings_row, key):
                    setattr(settings_row, key, value)
            
            settings_row.updated_at = datetime.now()
            session.commit()
            session.refresh(settings_row)
            
            # Convert SQLModel to Pydantic using model_dump
            return AutoGenSettings(**settings_row.model_dump())
    
    # ========================================================================
    # TICKET SELECTION
    # ========================================================================
    
    def select_tickets_for_auto_gen(self, limit: int) -> List[Ticket]:
        """
        Select tickets for automatic KBA generation.
        
        Selection criteria:
        - Status: Resolved or Closed
        - No existing KBA draft for this ticket
        - Sorted by: Priority (1=Critical first), then Created Date (newest first)
        
        Args:
            limit: Maximum number of tickets to select
            
        Returns:
            List of selected tickets
        """
        # Get all resolved/closed tickets
        resolved_tickets = self.ticket_service.list_tickets(
            status=TicketStatus.RESOLVED
        )
        closed_tickets = self.ticket_service.list_tickets(
            status=TicketStatus.CLOSED
        )
        
        all_candidate_tickets = resolved_tickets + closed_tickets
        logger.info(f"Found {len(all_candidate_tickets)} resolved/closed tickets")
        
        if not all_candidate_tickets:
            return []
        
        # Filter out tickets that already have KBA drafts
        tickets_without_drafts = []
        from operations import _get_kba_session
        
        with _get_kba_session() as session:
            for ticket in all_candidate_tickets:
                # Check if draft exists for this ticket
                statement = select(KBADraftTable).where(
                    KBADraftTable.ticket_id == ticket.id
                )
                existing_draft = session.exec(statement).first()
                
                if not existing_draft:
                    tickets_without_drafts.append(ticket)
        
        logger.info(f"Filtered to {len(tickets_without_drafts)} tickets without drafts")
        
        if not tickets_without_drafts:
            return []
        
        # Sort by priority (1=Critical first) and created_at (newest first)
        def sort_key(ticket: Ticket):
            # Priority: 1=Critical (highest), 4=Low (lowest)
            priority_value = int(ticket.priority.value) if ticket.priority else 999
            # Negate timestamp for descending order (newest first)
            timestamp_value = -ticket.created_at.timestamp() if ticket.created_at else 0
            return (priority_value, timestamp_value)
        
        sorted_tickets = sorted(tickets_without_drafts, key=sort_key)
        
        # Return top N tickets
        selected = sorted_tickets[:limit]
        logger.info(f"Selected {len(selected)} tickets for auto-generation")
        
        return selected
    
    # ========================================================================
    # AUTO-GENERATION
    # ========================================================================
    
    async def run_auto_generation(
        self,
        user_id: str = "system"
    ) -> AutoGenRunResult:
        """
        Run automatic KBA draft generation.
        
        This is the main entry point for scheduled generation.
        Selects tickets and generates drafts sequentially.
        
        Args:
            user_id: User ID for audit trail (default: "system")
            
        Returns:
            Result summary with counts and errors
        """
        async with self._lock:
            start_time = time.time()
            logger.info("Starting automatic KBA draft generation")
            
            # Load settings
            settings = self.get_settings()
            
            if not settings.enabled:
                logger.warning("Auto-generation is disabled, skipping")
                return AutoGenRunResult(
                    success=False,
                    drafts_created=0,
                    drafts_failed=0,
                    tickets_processed=0,
                    errors=["Auto-generation is disabled"],
                    run_time_seconds=0
                )
            
            # Select tickets
            tickets = self.select_tickets_for_auto_gen(settings.daily_limit)
            
            if not tickets:
                logger.info("No tickets available for auto-generation")
                self._update_last_run(0)
                return AutoGenRunResult(
                    success=True,
                    drafts_created=0,
                    drafts_failed=0,
                    tickets_processed=0,
                    errors=[],
                    run_time_seconds=time.time() - start_time
                )
            
            # Generate drafts sequentially
            drafts_created = 0
            drafts_failed = 0
            errors = []
            
            for ticket in tickets:
                try:
                    logger.info(f"Generating draft for ticket {ticket.incident_id} ({ticket.id})")
                    
                    # Create draft request
                    draft_request = KBADraftCreate(
                        ticket_id=str(ticket.id),
                        include_related_tickets=False,
                        user_id=user_id,
                        force_create=False
                    )
                    
                    # Generate draft (async method)
                    kba_service = self._get_kba_service()
                    draft = await kba_service.generate_draft(draft_request)
                    
                    # Mark as auto-generated
                    from operations import _get_kba_session
                    
                    with _get_kba_session() as session:
                        statement = select(KBADraftTable).where(
                            KBADraftTable.id == draft.id
                        )
                        draft_row = session.exec(statement).first()
                        if draft_row:
                            draft_row.is_auto_generated = True
                            session.commit()
                    
                    drafts_created += 1
                    logger.info(f"Successfully created draft {draft.id}")
                    
                except Exception as e:
                    drafts_failed += 1
                    error_msg = f"Failed to generate draft for ticket {ticket.incident_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue
            
            # Update last run stats
            self._update_last_run(drafts_created)
            
            run_time = time.time() - start_time
            logger.info(
                f"Auto-generation completed: {drafts_created} created, "
                f"{drafts_failed} failed in {run_time:.1f}s"
            )
            
            return AutoGenRunResult(
                success=drafts_failed == 0,
                drafts_created=drafts_created,
                drafts_failed=drafts_failed,
                tickets_processed=len(tickets),
                errors=errors,
                run_time_seconds=run_time
            )
    
    def _update_last_run(self, count: int):
        """Update last_run_at and last_run_count in settings"""
        from operations import _get_kba_session
        
        with _get_kba_session() as session:
            settings_row = session.get(AutoGenSettingsTable, 1)
            if settings_row:
                settings_row.last_run_at = datetime.now()
                settings_row.last_run_count = count
                session.commit()

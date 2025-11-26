"""
Support Ticket Management Module

Pydantic models and service layer for IT support ticket tracking.
Follows the same clean architecture pattern as tasks.py.
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid


# ============================================================================
# ENUMS - Category, Priority, Status
# ============================================================================

class TicketCategory(str, Enum):
    """Support ticket categories."""
    HARDWARE = "hardware"
    SOFTWARE = "software"
    NETWORK = "network"
    EMAIL = "email"
    SECURITY = "security"
    ACCOUNT_ACCESS = "account_access"
    PRINTER = "printer"
    OTHER = "other"


class Priority(str, Enum):
    """Ticket priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, Enum):
    """Ticket status workflow."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_ON_CUSTOMER = "waiting_on_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


# ============================================================================
# WORKLOG MODEL
# ============================================================================

class Worklog(BaseModel):
    """Work log entry for a ticket."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique worklog identifier")
    ticket_id: str = Field(..., description="Associated ticket ID")
    technician: str = Field(..., description="Technician who performed the work")
    time_spent_minutes: int = Field(..., ge=1, description="Time spent in minutes")
    description: str = Field(..., min_length=1, max_length=1000, description="Work description")
    created_at: datetime = Field(default_factory=datetime.now, description="When work was logged")


class WorklogCreate(BaseModel):
    """Data required to create a worklog."""
    technician: str = Field(..., description="Technician name")
    time_spent_minutes: int = Field(..., ge=1, description="Time spent in minutes")
    description: str = Field(..., min_length=1, max_length=1000, description="Work description")


# ============================================================================
# DATA MODELS - Pydantic for validation and schema generation
# ============================================================================

class SupportTicket(BaseModel):
    """Complete support ticket representation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique ticket identifier")
    ticket_number: str = Field(..., description="Human-readable ticket number (e.g., TICK-1001)")
    title: str = Field(..., min_length=1, max_length=200, description="Issue title")
    description: str = Field(default="", max_length=2000, description="Detailed description")
    category: TicketCategory = Field(..., description="Issue category")
    priority: Priority = Field(default=Priority.MEDIUM, description="Priority level")
    status: TicketStatus = Field(default=TicketStatus.OPEN, description="Current status")
    assigned_to: Optional[str] = Field(None, description="Assigned technician name")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
    resolution_time_hours: Optional[float] = Field(None, description="Time to resolution in hours")
    customer_satisfaction: Optional[int] = Field(None, ge=1, le=5, description="Customer rating (1-5)")
    worklogs: List[Worklog] = Field(default_factory=list, description="Work log entries")

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


class SupportTicketCreate(BaseModel):
    """Data required to create a new ticket."""
    title: str = Field(..., min_length=1, max_length=200, description="Issue title")
    description: str = Field(default="", max_length=2000, description="Detailed description")
    category: TicketCategory = Field(..., description="Issue category")
    priority: Priority = Field(default=Priority.MEDIUM, description="Priority level")

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


class SupportTicketUpdate(BaseModel):
    """Data for updating a ticket."""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="New title")
    description: Optional[str] = Field(None, max_length=2000, description="New description")
    category: Optional[TicketCategory] = Field(None, description="New category")
    priority: Optional[Priority] = Field(None, description="New priority")
    status: Optional[TicketStatus] = Field(None, description="New status")
    assigned_to: Optional[str] = Field(None, description="Assign to technician")
    customer_satisfaction: Optional[int] = Field(None, ge=1, le=5, description="Customer rating")


class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_tickets: int = Field(..., description="Total number of tickets")
    open_tickets: int = Field(..., description="Currently open tickets")
    in_progress_tickets: int = Field(..., description="Tickets being worked on")
    resolved_today: int = Field(..., description="Tickets resolved today")
    avg_resolution_time_hours: float = Field(..., description="Average resolution time")
    customer_satisfaction_avg: float = Field(..., description="Average satisfaction score")
    tickets_by_category: dict[str, int] = Field(..., description="Count by category")
    tickets_by_priority: dict[str, int] = Field(..., description="Count by priority")
    tickets_by_status: dict[str, int] = Field(..., description="Count by status")


class TicketTrend(BaseModel):
    """Daily ticket trend data."""
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    created: int = Field(..., description="Tickets created on this date")
    resolved: int = Field(..., description="Tickets resolved on this date")
    open: int = Field(..., description="Open tickets at end of day")


class CategoryPerformance(BaseModel):
    """Performance metrics by category."""
    category: str = Field(..., description="Category name")
    total_tickets: int = Field(..., description="Total tickets in category")
    avg_resolution_hours: float = Field(..., description="Average resolution time")
    satisfaction_score: float = Field(..., description="Average satisfaction")


class TechnicianPerformance(BaseModel):
    """Performance metrics by technician."""
    technician: str = Field(..., description="Technician name")
    total_tickets: int = Field(..., description="Total tickets assigned")
    resolved_tickets: int = Field(..., description="Tickets resolved")
    in_progress_tickets: int = Field(..., description="Tickets currently in progress")
    avg_resolution_hours: float = Field(..., description="Average resolution time")
    satisfaction_score: float = Field(..., description="Average customer satisfaction")
    total_time_spent_hours: float = Field(..., description="Total time logged in hours")


# ============================================================================
# DATA STORAGE - In-memory database
# ============================================================================

_tickets_db: dict[str, SupportTicket] = {}


# ============================================================================
# SERVICE LAYER - Business logic
# ============================================================================

class SupportTicketService:
    """Service handling all support ticket operations."""

    @staticmethod
    def create_ticket(data: SupportTicketCreate, ticket_number: Optional[str] = None) -> SupportTicket:
        """Create a new support ticket."""
        ticket = SupportTicket(
            ticket_number=ticket_number or f"TICK-{len(_tickets_db) + 1000}",
            title=data.title,
            description=data.description,
            category=data.category,
            priority=data.priority
        )
        _tickets_db[ticket.id] = ticket
        return ticket

    @staticmethod
    def get_ticket(ticket_id: str) -> Optional[SupportTicket]:
        """Get a ticket by ID."""
        return _tickets_db.get(ticket_id)

    @staticmethod
    def list_tickets(
        status: Optional[TicketStatus] = None,
        category: Optional[TicketCategory] = None,
        priority: Optional[Priority] = None
    ) -> list[SupportTicket]:
        """List tickets with optional filtering."""
        tickets = list(_tickets_db.values())

        if status:
            tickets = [t for t in tickets if t.status == status]
        if category:
            tickets = [t for t in tickets if t.category == category]
        if priority:
            tickets = [t for t in tickets if t.priority == priority]

        # Sort by created_at descending (newest first)
        tickets.sort(key=lambda t: t.created_at, reverse=True)
        return tickets

    @staticmethod
    def update_ticket(ticket_id: str, updates: SupportTicketUpdate) -> Optional[SupportTicket]:
        """Update a ticket with validation."""
        ticket = _tickets_db.get(ticket_id)
        if not ticket:
            return None

        update_data = updates.model_dump(exclude_unset=True)
        
        # Auto-set resolved_at and calculate resolution_time when status changes to resolved/closed
        if 'status' in update_data and update_data['status'] in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
            if ticket.resolved_at is None:
                update_data['resolved_at'] = datetime.now()
                resolution_time = (update_data['resolved_at'] - ticket.created_at).total_seconds() / 3600
                update_data['resolution_time_hours'] = round(resolution_time, 2)
        
        update_data['updated_at'] = datetime.now()
        updated_ticket = ticket.model_copy(update=update_data)

        _tickets_db[ticket_id] = updated_ticket
        return updated_ticket

    @staticmethod
    def delete_ticket(ticket_id: str) -> bool:
        """Delete a ticket."""
        if ticket_id in _tickets_db:
            del _tickets_db[ticket_id]
            return True
        return False

    @staticmethod
    def get_stats() -> DashboardStats:
        """Get comprehensive dashboard statistics."""
        tickets = list(_tickets_db.values())
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Basic counts
        total = len(tickets)
        open_count = sum(1 for t in tickets if t.status == TicketStatus.OPEN)
        in_progress_count = sum(1 for t in tickets if t.status == TicketStatus.IN_PROGRESS)
        resolved_today = sum(1 for t in tickets if t.resolved_at and t.resolved_at >= today_start)

        # Average resolution time
        resolved_tickets = [t for t in tickets if t.resolution_time_hours is not None]
        avg_resolution = (
            sum(t.resolution_time_hours for t in resolved_tickets) / len(resolved_tickets)
            if resolved_tickets else 0
        )

        # Average satisfaction
        rated_tickets = [t for t in tickets if t.customer_satisfaction is not None]
        avg_satisfaction = (
            sum(t.customer_satisfaction for t in rated_tickets) / len(rated_tickets)
            if rated_tickets else 0
        )

        # Category breakdown
        tickets_by_category = {}
        for category in TicketCategory:
            tickets_by_category[category.value] = sum(1 for t in tickets if t.category == category)

        # Priority breakdown
        tickets_by_priority = {}
        for priority in Priority:
            tickets_by_priority[priority.value] = sum(1 for t in tickets if t.priority == priority)

        # Status breakdown
        tickets_by_status = {}
        for status in TicketStatus:
            tickets_by_status[status.value] = sum(1 for t in tickets if t.status == status)

        return DashboardStats(
            total_tickets=total,
            open_tickets=open_count,
            in_progress_tickets=in_progress_count,
            resolved_today=resolved_today,
            avg_resolution_time_hours=round(avg_resolution, 2),
            customer_satisfaction_avg=round(avg_satisfaction, 2),
            tickets_by_category=tickets_by_category,
            tickets_by_priority=tickets_by_priority,
            tickets_by_status=tickets_by_status
        )

    @staticmethod
    def get_ticket_trends(days: int = 30) -> list[TicketTrend]:
        """Get daily ticket trends for the specified number of days."""
        from collections import defaultdict
        from datetime import timedelta

        tickets = list(_tickets_db.values())
        now = datetime.now()
        
        # Initialize data structure
        trends = defaultdict(lambda: {"created": 0, "resolved": 0, "open": 0})
        
        # Process tickets
        for ticket in tickets:
            created_date = ticket.created_at.date().isoformat()
            trends[created_date]["created"] += 1
            
            if ticket.resolved_at:
                resolved_date = ticket.resolved_at.date().isoformat()
                trends[resolved_date]["resolved"] += 1
        
        # Calculate open tickets at end of each day
        result = []
        for i in range(days):
            date = (now - timedelta(days=days-i-1)).date()
            date_str = date.isoformat()
            
            # Count open tickets at end of this day
            open_count = sum(
                1 for t in tickets
                if t.created_at.date() <= date and (not t.resolved_at or t.resolved_at.date() > date)
            )
            
            result.append(TicketTrend(
                date=date_str,
                created=trends[date_str]["created"],
                resolved=trends[date_str]["resolved"],
                open=open_count
            ))
        
        return result

    @staticmethod
    def get_category_performance() -> list[CategoryPerformance]:
        """Get performance metrics by category."""
        tickets = list(_tickets_db.values())
        performance = []

        for category in TicketCategory:
            cat_tickets = [t for t in tickets if t.category == category]
            if not cat_tickets:
                continue

            resolved_tickets = [t for t in cat_tickets if t.resolution_time_hours is not None]
            avg_resolution = (
                sum(t.resolution_time_hours for t in resolved_tickets) / len(resolved_tickets)
                if resolved_tickets else 0
            )

            rated_tickets = [t for t in cat_tickets if t.customer_satisfaction is not None]
            satisfaction = (
                sum(t.customer_satisfaction for t in rated_tickets) / len(rated_tickets)
                if rated_tickets else 0
            )

            performance.append(CategoryPerformance(
                category=category.value,
                total_tickets=len(cat_tickets),
                avg_resolution_hours=round(avg_resolution, 2),
                satisfaction_score=round(satisfaction, 2)
            ))

        return performance

    @staticmethod
    def get_resolution_time_distribution() -> dict[str, int]:
        """Get distribution of resolution times in buckets."""
        tickets = [t for t in _tickets_db.values() if t.resolution_time_hours is not None]
        
        distribution = {
            "< 1 hour": 0,
            "1-4 hours": 0,
            "4-8 hours": 0,
            "8-24 hours": 0,
            "> 24 hours": 0
        }

        for ticket in tickets:
            hours = ticket.resolution_time_hours
            if hours < 1:
                distribution["< 1 hour"] += 1
            elif hours < 4:
                distribution["1-4 hours"] += 1
            elif hours < 8:
                distribution["4-8 hours"] += 1
            elif hours < 24:
                distribution["8-24 hours"] += 1
            else:
                distribution["> 24 hours"] += 1

        return distribution

    @staticmethod
    def clear_all_tickets() -> int:
        """Clear all tickets."""
        count = len(_tickets_db)
        _tickets_db.clear()
        return count


    @staticmethod
    def add_worklog(ticket_id: str, worklog_data: WorklogCreate) -> Optional[SupportTicket]:
        """Add a worklog entry to a ticket."""
        ticket = _tickets_db.get(ticket_id)
        if not ticket:
            return None
        
        worklog = Worklog(
            ticket_id=ticket_id,
            technician=worklog_data.technician,
            time_spent_minutes=worklog_data.time_spent_minutes,
            description=worklog_data.description
        )
        
        # Create updated ticket with new worklog
        updated_worklogs = ticket.worklogs + [worklog]
        updated_ticket = ticket.model_copy(update={
            'worklogs': updated_worklogs,
            'updated_at': datetime.now()
        })
        
        _tickets_db[ticket_id] = updated_ticket
        return updated_ticket


    @staticmethod
    def get_technician_performance() -> list[TechnicianPerformance]:
        """Get performance metrics for each technician."""
        from collections import defaultdict
        
        tickets = list(_tickets_db.values())
        
        # Group tickets by technician
        tech_data = defaultdict(lambda: {
            'total': 0,
            'resolved': 0,
            'in_progress': 0,
            'resolution_times': [],
            'satisfactions': [],
            'time_spent': 0
        })
        
        for ticket in tickets:
            if not ticket.assigned_to:
                continue
            
            tech = ticket.assigned_to
            tech_data[tech]['total'] += 1
            
            if ticket.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
                tech_data[tech]['resolved'] += 1
                if ticket.resolution_time_hours:
                    tech_data[tech]['resolution_times'].append(ticket.resolution_time_hours)
            
            if ticket.status == TicketStatus.IN_PROGRESS:
                tech_data[tech]['in_progress'] += 1
            
            if ticket.customer_satisfaction:
                tech_data[tech]['satisfactions'].append(ticket.customer_satisfaction)
            
            # Sum worklog time
            for worklog in ticket.worklogs:
                if worklog.technician == tech:
                    tech_data[tech]['time_spent'] += worklog.time_spent_minutes / 60
        
        # Calculate averages and create performance objects
        performance = []
        for tech, data in tech_data.items():
            avg_resolution = (
                sum(data['resolution_times']) / len(data['resolution_times'])
                if data['resolution_times'] else 0
            )
            avg_satisfaction = (
                sum(data['satisfactions']) / len(data['satisfactions'])
                if data['satisfactions'] else 0
            )
            
            performance.append(TechnicianPerformance(
                technician=tech,
                total_tickets=data['total'],
                resolved_tickets=data['resolved'],
                in_progress_tickets=data['in_progress'],
                avg_resolution_hours=round(avg_resolution, 2),
                satisfaction_score=round(avg_satisfaction, 2),
                total_time_spent_hours=round(data['time_spent'], 2)
            ))
        
        # Sort by total tickets descending
        performance.sort(key=lambda p: p.total_tickets, reverse=True)
        return performance


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

service = SupportTicketService()

__all__ = [
    'SupportTicket',
    'SupportTicketCreate',
    'SupportTicketUpdate',
    'TicketCategory',
    'Priority',
    'TicketStatus',
    'DashboardStats',
    'TicketTrend',
    'CategoryPerformance',
    'TechnicianPerformance',
    'Worklog',
    'WorklogCreate',
    'SupportTicketService',
    'service'
]

"""
Task Management Module

This module demonstrates clean architecture with Pydantic models:
- Type-safe data models with automatic validation
- Self-documenting schemas for REST and MCP
- Consolidated business logic (avoiding overly granular functions)
- Separation of pure functions (calculations) from I/O (actions)

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Simple interface, complex implementation
- Avoid short, trivial functions - prefer consolidated, meaningful operations
- Clear separation: Data models, Calculations, Actions, Service layer
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum
import uuid


# ============================================================================
# DATA MODELS - Pydantic for validation and schema generation
# ============================================================================

class Priority(str, Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class Task(BaseModel):
    """
    Complete task representation.

    Pydantic automatically:
    - Validates types
    - Generates JSON schema (for MCP)
    - Handles serialization
    - Provides IDE autocompletion
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique task identifier")
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(default="", max_length=1000, description="Task description")
    completed: bool = Field(default=False, description="Completion status")
    in_progress: bool = Field(default=False, description="In progress status")
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority level")
    time_spent: float = Field(default=0.0, description="Time spent in hours")
    closed_at: Optional[datetime] = Field(default=None, description="Timestamp when task was closed")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Learn Pydantic",
                "description": "Understand Pydantic models and validation",
                "completed": False,
                "priority": "medium",
                "created_at": "2025-11-18T12:00:00"
            }]
        }
    }

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        """Ensure title is not just whitespace."""
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


class TaskCreate(BaseModel):
    """
    Data required to create a new task.

    Separate from Task to avoid exposing internal fields (id, created_at).
    """
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(default="", max_length=1000, description="Optional task description")
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority level")

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()

    @field_validator('description')
    @classmethod
    def clean_description(cls, v: str) -> str:
        return v.strip()


class TaskUpdate(BaseModel):
    """
    Data for updating a task.

    All fields optional - only provided fields will be updated.
    """
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="New task title")
    description: Optional[str] = Field(None, max_length=1000, description="New task description")
    completed: Optional[bool] = Field(None, description="New completion status")
    in_progress: Optional[bool] = Field(None, description="New in progress status")
    priority: Optional[Priority] = Field(None, description="New task priority level")
    time_spent: Optional[float] = Field(None, description="Time spent in hours")

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip() if v else None

    @field_validator('description')
    @classmethod
    def clean_description(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None


class TaskFilter(str, Enum):
    """Task filter options."""
    ALL = "all"
    COMPLETED = "completed"
    PENDING = "pending"


class TaskStats(BaseModel):
    """Task statistics."""
    total: int = Field(..., description="Total number of tasks")
    completed: int = Field(..., description="Number of completed tasks")
    pending: int = Field(..., description="Number of pending tasks")


class TaskOverview(BaseModel):
    """Detailed task overview with priority breakdown."""
    total: int = Field(..., description="Total number of tasks")
    completed: int = Field(..., description="Number of completed tasks")
    in_progress: int = Field(..., description="Number of tasks in progress")
    pending: int = Field(..., description="Number of pending tasks")
    by_priority: dict[str, int] = Field(..., description="Task count by priority")
    completion_rate: float = Field(..., description="Completion rate as percentage")
    tasks_by_status: dict[str, list[Task]] = Field(..., description="Tasks grouped by status")


class TaskError(BaseModel):
    """Error response."""
    error: str = Field(..., description="Error message")


# ============================================================================
# DATA STORAGE - In-memory database
# ============================================================================

_tasks_db: dict[str, Task] = {}


# ============================================================================
# SERVICE LAYER - Business logic with consolidated operations
# ============================================================================
# Note: We consolidate related operations instead of creating many tiny functions.
# This follows "A Philosophy of Software Design" - deeper modules with meaningful work.

class TaskService:
    """
    Task service handling all business logic.

    This class consolidates all task operations into a cohesive interface.
    We avoid creating many tiny helper functions - each method does substantial work.
    """

    @staticmethod
    def create_task(data: TaskCreate) -> Task:
        """
        Create a new task with validation.

        This consolidated method:
        - Validates input (via Pydantic)
        - Creates task with generated ID and timestamp
        - Stores in database
        - Returns the created task

        No need for separate tiny functions like create_task_data(),
        validate_title(), etc. - Pydantic handles validation, and we do
        the rest here in one clear operation.
        """
        task = Task(
            title=data.title,
            description=data.description,
            priority=data.priority
        )
        _tasks_db[task.id] = task
        return task

    @staticmethod
    def get_task(task_id: str) -> Optional[Task]:
        """Get a task by ID. Returns None if not found."""
        return _tasks_db.get(task_id)

    @staticmethod
    def list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
        """
        List tasks with optional filtering.

        Consolidated filtering logic - we could split this into
        filter_completed(), filter_pending(), etc., but that would
        create unnecessary tiny functions. This is clearer.
        """
        all_tasks = list(_tasks_db.values())

        if filter == TaskFilter.COMPLETED:
            return [task for task in all_tasks if task.completed]
        elif filter == TaskFilter.PENDING:
            return [task for task in all_tasks if not task.completed]
        else:
            return all_tasks

    @staticmethod
    def update_task(task_id: str, updates: TaskUpdate) -> Optional[Task]:
        """
        Update a task with validation.

        Consolidated update logic:
        - Retrieves existing task
        - Applies only provided fields
        - Validates via Pydantic
        - Updates database
        - Returns updated task

        Returns None if task not found.
        """
        task = _tasks_db.get(task_id)
        if not task:
            return None

        # Apply updates (only fields that were provided)
        update_data = updates.model_dump(exclude_unset=True)
        
        # If marking as completed, set closed_at timestamp
        if update_data.get('completed') is True and not task.completed:
            update_data['closed_at'] = datetime.now()
        # If reopening, clear closed_at
        elif update_data.get('completed') is False:
            update_data['closed_at'] = None
        
        updated_task = task.model_copy(update=update_data)

        _tasks_db[task_id] = updated_task
        return updated_task

    @staticmethod
    def delete_task(task_id: str) -> bool:
        """Delete a task. Returns True if deleted, False if not found."""
        if task_id in _tasks_db:
            del _tasks_db[task_id]
            return True
        return False

    @staticmethod
    def get_stats() -> TaskStats:
        """
        Get task statistics.

        Consolidated stats calculation - we could split into
        count_total(), count_completed(), count_pending(), but
        that's unnecessary fragmentation. This is clearer.
        """
        all_tasks = list(_tasks_db.values())
        completed = sum(1 for task in all_tasks if task.completed)

        return TaskStats(
            total=len(all_tasks),
            completed=completed,
            pending=len(all_tasks) - completed
        )

    @staticmethod
    def get_overview() -> TaskOverview:
        """
        Get detailed task overview with all statistics.
        
        Returns comprehensive overview including:
        - Total, completed, in_progress, pending counts
        - Priority breakdown
        - Completion rate
        - Tasks grouped by status
        """
        all_tasks = list(_tasks_db.values())
        completed_tasks = [task for task in all_tasks if task.completed]
        in_progress_tasks = [task for task in all_tasks if task.in_progress and not task.completed]
        pending_tasks = [task for task in all_tasks if not task.completed and not task.in_progress]
        
        # Count by priority
        by_priority = {
            Priority.LOW.value: sum(1 for t in all_tasks if t.priority == Priority.LOW),
            Priority.MEDIUM.value: sum(1 for t in all_tasks if t.priority == Priority.MEDIUM),
            Priority.HIGH.value: sum(1 for t in all_tasks if t.priority == Priority.HIGH),
            Priority.URGENT.value: sum(1 for t in all_tasks if t.priority == Priority.URGENT),
        }
        
        # Calculate completion rate
        total = len(all_tasks)
        completion_rate = (len(completed_tasks) / total * 100) if total > 0 else 0.0
        
        return TaskOverview(
            total=total,
            completed=len(completed_tasks),
            in_progress=len(in_progress_tasks),
            pending=len(pending_tasks),
            by_priority=by_priority,
            completion_rate=round(completion_rate, 1),
            tasks_by_status={
                "completed": completed_tasks,
                "in_progress": in_progress_tasks,
                "pending": pending_tasks
            }
        )

    @staticmethod
    def clear_all_tasks() -> int:
        """Clear all tasks. Returns count of tasks cleared."""
        count = len(_tasks_db)
        _tasks_db.clear()
        return count

    @staticmethod
    def initialize_sample_data() -> int:
        """
        Initialize database with sample tasks.

        Consolidated initialization - creates multiple tasks in one operation.
        Returns count of tasks created.
        """
        # Clear existing data
        _tasks_db.clear()

        # Create 30 diverse sample tasks with various themes and priorities
        samples = [
            # IT Infrastructure
            TaskCreate(title="Server-Migration durchführen", description="Produktion-Server auf neue Hardware migrieren", priority=Priority.URGENT),
            TaskCreate(title="Backup-System testen", description="Wöchentlicher Test der Backup-Wiederherstellung", priority=Priority.HIGH),
            TaskCreate(title="Firewall-Regeln aktualisieren", description="Neue Sicherheitsrichtlinien implementieren", priority=Priority.HIGH),
            TaskCreate(title="Monitoring-Alerts konfigurieren", description="Schwellenwerte für CPU und RAM festlegen", priority=Priority.MEDIUM),
            TaskCreate(title="VPN-Zugang einrichten", description="Neuer Mitarbeiter benötigt Remote-Zugang", priority=Priority.MEDIUM),
            
            # Software Development
            TaskCreate(title="API-Dokumentation aktualisieren", description="REST-Endpoints dokumentieren mit OpenAPI", priority=Priority.LOW),
            TaskCreate(title="Security-Patch einspielen", description="Kritische Sicherheitslücke in Abhängigkeit", priority=Priority.URGENT),
            TaskCreate(title="Code-Review durchführen", description="Pull Request #245 überprüfen", priority=Priority.MEDIUM),
            TaskCreate(title="Unit-Tests erweitern", description="Test-Coverage auf 80% erhöhen", priority=Priority.LOW),
            TaskCreate(title="Performance-Optimierung", description="Datenbankabfragen beschleunigen", priority=Priority.HIGH),
            
            # User Support
            TaskCreate(title="Benutzer-Schulung planen", description="Workshop für neue Software-Features", priority=Priority.MEDIUM),
            TaskCreate(title="Passwort-Reset für Admin", description="Dringend: CEO hat Passwort vergessen", priority=Priority.URGENT),
            TaskCreate(title="Drucker-Problem beheben", description="Etage 3, Raum 305 - Papierstau", priority=Priority.LOW),
            TaskCreate(title="Email-Migration abschließen", description="100 Postfächer auf neuen Server", priority=Priority.HIGH),
            TaskCreate(title="Software-Lizenz erneuern", description="Adobe Creative Suite läuft nächste Woche ab", priority=Priority.HIGH),
            
            # Database Management
            TaskCreate(title="Datenbank-Index optimieren", description="Langsame Abfragen beschleunigen", priority=Priority.MEDIUM),
            TaskCreate(title="Alte Logs archivieren", description="Daten älter als 2 Jahre verschieben", priority=Priority.LOW),
            TaskCreate(title="Replikation einrichten", description="Master-Slave für Produktionsdatenbank", priority=Priority.HIGH),
            TaskCreate(title="SQL-Injection Prüfung", description="Sicherheitsaudit aller Queries", priority=Priority.URGENT),
            
            # Network & Infrastructure
            TaskCreate(title="WLAN-Abdeckung erweitern", description="Access Points im neuen Gebäudeflügel", priority=Priority.MEDIUM),
            TaskCreate(title="Switch-Konfiguration prüfen", description="VLAN-Setup verifizieren", priority=Priority.LOW),
            TaskCreate(title="DNS-Einträge aktualisieren", description="Neue Subdomain für Staging", priority=Priority.MEDIUM),
            TaskCreate(title="Netzwerk-Verkehr analysieren", description="Ungewöhnlich hohe Auslastung untersuchen", priority=Priority.HIGH),
            
            # Security & Compliance
            TaskCreate(title="GDPR-Audit durchführen", description="Datenschutz-Compliance überprüfen", priority=Priority.URGENT),
            TaskCreate(title="Zugriffsrechte überprüfen", description="Quartalsweise Rechtevergabe kontrollieren", priority=Priority.MEDIUM),
            TaskCreate(title="Sicherheits-Awareness Training", description="Phishing-Simulation für alle Mitarbeiter", priority=Priority.LOW),
            
            # Project Management
            TaskCreate(title="Sprint-Planning vorbereiten", description="User Stories für nächsten Sprint priorisieren", priority=Priority.MEDIUM),
            TaskCreate(title="Stakeholder-Meeting", description="Projekt-Update für Management präsentieren", priority=Priority.HIGH),
            TaskCreate(title="Budget-Report erstellen", description="Q4 Ausgaben zusammenfassen", priority=Priority.MEDIUM),
            TaskCreate(title="Deployment-Pipeline bauen", description="CI/CD mit Jenkins automatisieren", priority=Priority.HIGH),
        ]

        # Create all tasks
        created_tasks = []
        for sample_data in samples:
            task = TaskService.create_task(sample_data)
            created_tasks.append(task)
        
        # Mark 7 tasks as completed
        completed_indices = [1, 5, 7, 12, 16, 20, 25]  # Different priorities and categories
        for idx in completed_indices:
            if idx < len(created_tasks):
                task_id = created_tasks[idx].id
                TaskService.update_task(task_id, TaskUpdate(completed=True))
        
        # Mark 6 tasks as in progress
        in_progress_indices = [0, 3, 6, 11, 18, 23]  # Different priorities and categories
        for idx in in_progress_indices:
            if idx < len(created_tasks):
                task_id = created_tasks[idx].id
                TaskService.update_task(task_id, TaskUpdate(in_progress=True))

        return len(samples)


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

# Export service for easy importing
service = TaskService()

# Export models for type hints
__all__ = [
    'Task',
    'TaskCreate',
    'TaskUpdate',
    'TaskFilter',
    'Priority',
    'TaskStats',
    'TaskOverview',
    'TaskError',
    'TaskService',
    'service'
]

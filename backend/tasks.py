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
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"

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
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority level")
    description: str = Field(default="", max_length=1000, description="Task description")
    deadline: Optional[datetime] = Field(default=None, description="Task deadline")
    completed: bool = Field(default=False, description="Completion status")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Learn Pydantic",
                "description": "Understand Pydantic models and validation",
                "completed": False,
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
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority level")
    description: str = Field(default="", max_length=1000, description="Optional task description")
    deadline: Optional[datetime] = Field(default=None, description="Optional task deadline")

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
    priority: Optional[Priority] = Field(None, description="New task priority level")
    description: Optional[str] = Field(None, max_length=1000, description="New task description")
    deadline: Optional[datetime] = Field(None, description="New task deadline")
    completed: Optional[bool] = Field(None, description="New completion status")

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


class PriorityStats(BaseModel):
    """Priority statistics for open/pending tasks."""
    low: int = Field(..., description="Number of open tasks with Low priority")
    medium: int = Field(..., description="Number of open tasks with Medium priority")
    high: int = Field(..., description="Number of open tasks with High priority")


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
            priority=data.priority,
            description=data.description,
            deadline=data.deadline
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
    def get_priority_stats() -> PriorityStats:
        """
        Get priority statistics for open/pending tasks only.

        Returns count of open tasks grouped by priority level.
        """
        open_tasks = [task for task in _tasks_db.values() if not task.completed]
        
        low_count = sum(1 for task in open_tasks if task.priority == Priority.LOW)
        medium_count = sum(1 for task in open_tasks if task.priority == Priority.MEDIUM)
        high_count = sum(1 for task in open_tasks if task.priority == Priority.HIGH)

        return PriorityStats(
            low=low_count,
            medium=medium_count,
            high=high_count
        )

    @staticmethod
    def get_urgent_tasks() -> list[Task]:
        """
        Get urgent tasks: High priority, not completed, deadline within 2 days.

        Returns list of tasks that need immediate attention.
        """
        now = datetime.now()
        two_days_later = now + __import__('datetime').timedelta(days=2)
        
        urgent = [
            task for task in _tasks_db.values()
            if not task.completed
            and task.priority == Priority.HIGH
            and task.deadline is not None
            and task.deadline <= two_days_later
        ]
        
        # Sort by deadline (earliest first) - we know deadline is not None due to filter above
        return sorted(urgent, key=lambda t: t.deadline or datetime.max)

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

        # Create sample tasks with deadlines
        from datetime import timedelta
        now = datetime.now()
        
        samples = [
            TaskCreate(
                title="Dringend: Kritischer Bug beheben",
                priority=Priority.HIGH,
                description="Production bug muss sofort gefixt werden",
                deadline=now + timedelta(days=1)  # Urgent: 1 day
            ),
            TaskCreate(
                title="Wichtiges Meeting vorbereiten",
                priority=Priority.HIGH,
                description="Präsentation für Stakeholder-Meeting",
                deadline=now + timedelta(hours=36)  # Urgent: 1.5 days
            ),
            TaskCreate(
                title="Learn Quart",
                priority=Priority.HIGH,
                description="Explore the Quart web framework",
                deadline=now + timedelta(days=7)  # Not urgent: 7 days
            ),
            TaskCreate(
                title="Build React UI",
                priority=Priority.MEDIUM,
                description="Create a modern UI with FluentUI",
                deadline=now + timedelta(days=5)
            ),
            TaskCreate(
                title="Write tests",
                priority=Priority.LOW,
                description="Add Playwright E2E tests"
            )
        ]

        for sample_data in samples:
            TaskService.create_task(sample_data)

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
    'PriorityStats',
    'TaskError',
    'TaskService',
    'service'
]

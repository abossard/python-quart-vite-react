"""
Task Management Module

This module demonstrates clean architecture with SQLModel:
- Type-safe data models with automatic validation (Pydantic)
- ORM with SQLAlchemy for database operations
- Self-documenting schemas for REST and MCP
- Consolidated business logic (avoiding overly granular functions)
- Separation of pure functions (calculations) from I/O (actions)

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Simple interface, complex implementation
- Avoid short, trivial functions - prefer consolidated, meaningful operations
- Clear separation: Data models, Calculations, Actions, Service layer
"""

import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import field_validator
from sqlmodel import Field, Session, SQLModel, create_engine, select

# ============================================================================
# DATA MODELS - SQLModel for database tables + Pydantic validation
# ============================================================================

class Task(SQLModel, table=True):
    """
    Complete task representation - both database table and Pydantic model.

    SQLModel automatically:
    - Creates database table
    - Validates types (Pydantic)
    - Generates JSON schema (for MCP)
    - Handles serialization
    - Provides IDE autocompletion
    """
    
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, description="Unique task identifier")
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(default="", max_length=1000, description="Task description")
    completed: bool = Field(default=False, description="Completion status")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        """Ensure title is not just whitespace."""
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


class TaskCreate(SQLModel):
    """
    Data required to create a new task.

    Separate from Task to avoid exposing internal fields (id, created_at).
    """
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(default="", max_length=1000, description="Optional task description")

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


class TaskUpdate(SQLModel):
    """
    Data for updating a task.

    All fields optional - only provided fields will be updated.
    """
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="New task title")
    description: Optional[str] = Field(None, max_length=1000, description="New task description")
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


class TaskStats(SQLModel):
    """Task statistics."""
    total: int = Field(..., description="Total number of tasks")
    completed: int = Field(..., description="Number of completed tasks")
    pending: int = Field(..., description="Number of pending tasks")


class TaskError(SQLModel):
    """Error response."""
    error: str = Field(..., description="Error message")


# ============================================================================
# DATA STORAGE - SQLModel engine and session
# ============================================================================

# Database path - use environment variable or default to data/tasks.db
DB_PATH = Path(__file__).parent / "data" / "tasks.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Create SQLAlchemy engine
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    """Initialize database - create all tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Get database session."""
    return Session(engine)


# Initialize database on module import
init_db()


# ============================================================================
# SERVICE LAYER - Business logic with consolidated operations
# ============================================================================
# Note: We consolidate related operations instead of creating many tiny functions.
# This follows "A Philosophy of Software Design" - deeper modules with meaningful work.

class TaskService:
    """
    Task service handling all business logic with SQLModel.

    This class consolidates all task operations into a cohesive interface.
    We avoid creating many tiny helper functions - each method does substantial work.
    """

    @staticmethod
    def create_task(data: TaskCreate) -> Task:
        """
        Create a new task with validation.

        SQLModel handles:
        - Pydantic validation
        - ID generation
        - Timestamp creation
        - Database insertion
        """
        task = Task.model_validate(data)
        
        with get_session() as session:
            session.add(task)
            session.commit()
            session.refresh(task)
        
        return task

    @staticmethod
    def get_task(task_id: str) -> Optional[Task]:
        """Get a task by ID. Returns None if not found."""
        with get_session() as session:
            return session.get(Task, task_id)

    @staticmethod
    def list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
        """
        List tasks with optional filtering.

        Uses SQLModel's type-safe query builder.
        """
        with get_session() as session:
            statement = select(Task)
            
            if filter == TaskFilter.COMPLETED:
                statement = statement.where(Task.completed == True)  # noqa: E712
            elif filter == TaskFilter.PENDING:
                statement = statement.where(Task.completed == False)  # noqa: E712
            
            return list(session.exec(statement).all())

    @staticmethod
    def update_task(task_id: str, updates: TaskUpdate) -> Optional[Task]:
        """
        Update a task with validation.

        SQLModel handles validation and database updates.
        Returns None if task not found.
        """
        with get_session() as session:
            task = session.get(Task, task_id)
            if not task:
                return None

            # Apply updates (only fields that were provided)
            update_data = updates.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(task, key, value)
            
            session.add(task)
            session.commit()
            session.refresh(task)
            
            return task

    @staticmethod
    def delete_task(task_id: str) -> bool:
        """Delete a task. Returns True if deleted, False if not found."""
        with get_session() as session:
            task = session.get(Task, task_id)
            if not task:
                return False
            
            session.delete(task)
            session.commit()
            return True

    @staticmethod
    def get_stats() -> TaskStats:
        """
        Get task statistics using SQLModel queries.
        """
        with get_session() as session:
            total = len(session.exec(select(Task)).all())
            completed = len(session.exec(select(Task).where(Task.completed == True)).all())  # noqa: E712

            return TaskStats(
                total=total,
                completed=completed,
                pending=total - completed
            )

    @staticmethod
    def clear_all_tasks() -> int:
        """Clear all tasks. Returns count of tasks cleared."""
        with get_session() as session:
            tasks = session.exec(select(Task)).all()
            count = len(tasks)
            for task in tasks:
                session.delete(task)
            session.commit()
            return count

    @staticmethod
    def initialize_sample_data() -> int:
        """
        Initialize database with sample tasks.

        Consolidated initialization - creates multiple tasks in one operation.
        Returns count of tasks created.
        """
        # Clear existing data
        TaskService.clear_all_tasks()

        # Create sample tasks
        samples = [
            TaskCreate(
                title="Learn Quart",
                description="Explore the Quart web framework"
            ),
            TaskCreate(
                title="Build React UI",
                description="Create a modern UI with FluentUI"
            ),
            TaskCreate(
                title="Write tests",
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
    'TaskStats',
    'TaskError',
    'TaskService',
    'service'
]

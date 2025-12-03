# SQLModel Migration

## Overview

Successfully migrated from raw SQLite queries to **SQLModel** ORM, combining the best of Pydantic and SQLAlchemy.

## What Changed

### Before: Raw SQL + Manual Conversion
```python
# Raw SQL queries
conn.execute("INSERT INTO tasks (id, title, ...) VALUES (?, ?, ...)")
row = conn.execute("SELECT * FROM tasks WHERE id = ?").fetchone()

# Manual row to Pydantic conversion
task = Task(
    id=row["id"],
    title=row["title"],
    completed=bool(row["completed"]),
    created_at=datetime.fromisoformat(row["created_at"])
)
```

### After: SQLModel ORM
```python
# Type-safe ORM queries
with get_session() as session:
    task = Task(title="Learn SQLModel")
    session.add(task)
    session.commit()
    
    # No manual conversion needed!
    task = session.get(Task, task_id)
    tasks = session.exec(select(Task).where(Task.completed == True)).all()
```

## Benefits

### 1. **Zero Code Duplication**
- Single `Task` class serves as:
  - Database table definition (`table=True`)
  - Pydantic validation model
  - JSON schema for MCP
  - Type hints for IDE

### 2. **Type Safety**
- SQLModel queries return typed results
- IDE autocompletion for queries
- Compile-time type checking
- No manual type conversions

### 3. **Reduced Code**
- Eliminated ~100 lines of:
  - Manual SQL strings
  - Row-to-Pydantic conversion
  - Database connection boilerplate
  - Schema creation logic

### 4. **Better Developer Experience**
- No SQL injection risks (parameterized queries)
- Automatic migrations (via Alembic, optional)
- Cleaner, more readable code
- Easier to maintain

## Implementation Details

### Models

```python
from sqlmodel import SQLModel, Field, Session, create_engine, select

class Task(SQLModel, table=True):
    """Both database table AND Pydantic model"""
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), 
                              primary_key=True)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    
    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
```

### Database Setup

```python
# Database engine
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, echo=False)

# Auto-create tables
def init_db():
    SQLModel.metadata.create_all(engine)

# Session factory
def get_session():
    return Session(engine)
```

### CRUD Operations

```python
# Create
with get_session() as session:
    task = Task.model_validate(data)
    session.add(task)
    session.commit()
    session.refresh(task)

# Read
with get_session() as session:
    task = session.get(Task, task_id)
    tasks = session.exec(select(Task).where(Task.completed == True)).all()

# Update
with get_session() as session:
    task = session.get(Task, task_id)
    for key, value in updates.items():
        setattr(task, key, value)
    session.commit()

# Delete
with get_session() as session:
    task = session.get(Task, task_id)
    session.delete(task)
    session.commit()
```

## Testing Results

All MCP tools verified working:
- ✅ `create_task` - Creates tasks with validation
- ✅ `get_task` - Retrieves by ID
- ✅ `list_tasks` - Filters by status
- ✅ `update_task` - Partial updates
- ✅ `delete_task` - Removes tasks
- ✅ `get_task_stats` - Calculates statistics

## Dependencies

Added to `requirements.txt`:
```
sqlmodel>=0.0.27
```

SQLModel brings in:
- `sqlalchemy>=2.0.44` (ORM engine)
- `pydantic>=2.0.0` (validation, already installed)

## Migration Path

If you need to migrate existing data:

1. **Export data** from old SQLite:
   ```python
   old_tasks = list_tasks()  # Before migration
   ```

2. **Apply migration** (update code)

3. **Import data**:
   ```python
   for task_data in old_tasks:
       TaskService.create_task(TaskCreate(**task_data))
   ```

For this project, we use `initialize_sample_data()` which clears and recreates sample tasks.

## Future Enhancements

With SQLModel, we can easily add:

### 1. Relationships
```python
class User(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str
    
class Task(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id")
    user: User = Relationship()
```

### 2. Migrations
```bash
# Install Alembic
pip install alembic

# Auto-generate migrations
alembic revision --autogenerate -m "Add user_id to tasks"
alembic upgrade head
```

### 3. Async Support
```python
from sqlmodel.ext.asyncio.session import AsyncSession

async def create_task(data: TaskCreate) -> Task:
    async with AsyncSession(engine) as session:
        task = Task.model_validate(data)
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return task
```

## Resources

- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [FastAPI + SQLModel Tutorial](https://sqlmodel.tiangolo.com/tutorial/fastapi/)
- [SQLAlchemy 2.0 Docs](https://docs.sqlalchemy.org/en/20/)

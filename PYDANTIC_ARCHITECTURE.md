# Pydantic-Based Architecture

This document explains the clean, type-safe architecture using Pydantic models for automatic validation, schema generation, and documentation.

## Overview

The architecture has been refactored to use Pydantic for:
- **Type safety** - Automatic validation of all inputs
- **Schema generation** - JSON schemas for MCP auto-generated from models
- **Documentation** - Self-documenting models with examples
- **Consolidation** - Avoidpractice of creating many tiny functions

## Key Files

### 1. [tasks.py](backend/tasks.py) - Business Logic with Pydantic

Single file containing everything task-related:
- Pydantic models (Task, TaskCreate, TaskUpdate, TaskFilter, TaskStats)
- TaskService class with consolidated business logic
- No overly granular functions - each method does substantial work

```python
from pydantic import BaseModel, Field

class Task(BaseModel):
    """Complete task with automatic validation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class TaskService:
    @staticmethod
    def create_task(data: TaskCreate) -> Task:
        """Consolidated creation logic - validation, ID generation, storage."""
        task = Task(title=data.title, description=data.description)
        _tasks_db[task.id] = task
        return task
```

**Key Benefits:**
- Pydantic automatically validates min_length, max_length
- Type hints provide IDE autocompletion
- `model_dump()` for JSON serialization
- `model_json_schema()` for automatic schema generation

### 2. [api_decorators.py](backend/api_decorators.py) - Unified Operations

Simplified decorator system that extracts schemas from Pydantic models:

```python
@operation(
    name="create_task",
    description="Create a new task with validation",
    http_method="POST"
)
async def op_create_task(data: TaskCreate) -> Task:
    return task_service.create_task(data)
```

**What happens automatically:**
1. Decorator sees `data: TaskCreate` parameter
2. Extracts Pydantic's JSON schema from `TaskCreate.model_json_schema()`
3. Uses that schema for MCP tool definition
4. REST endpoint gets Pydantic validation
5. MCP tool gets same validation

**No manual Parameter definitions needed!**

### 3. [app.py](backend/app.py) - REST + MCP with Pydantic

Clean integration:

```python
@app.route("/api/tasks", methods=["POST"])
async def rest_create_task():
    try:
        data = await request.get_json()
        task_data = TaskCreate(**data)  # Pydantic validates here!
        task = await op_create_task(task_data)
        return jsonify(task.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
```

**Benefits:**
- Automatic validation via Pydantic
- Clear error messages from Pydantic
- Type-safe throughout
- Same validation for REST and MCP

## Architecture Comparison

### Before (Manual Parameters)

```python
# Manual parameter definitions
Parameter("title", "string", "Task title", required=True)
Parameter("description", "string", "Task description")

# Manual validation
if not title or not title.strip():
    raise ValueError("Title required")

# Manual schema generation for MCP
{"type": "object", "properties": {...}}
```

### After (Pydantic)

```python
# Define model once
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)

# Validation automatic
# Schema generation automatic
# Documentation automatic
```

## Consolidated Functions Philosophy

Following "A Philosophy of Software Design", we **avoid creating many tiny functions**:

### ❌ Overly Granular (Don't Do This)

```python
def validate_title(title: str) -> bool:
    return len(title.strip()) > 0

def create_task_id() -> str:
    return str(uuid.uuid4())

def create_timestamp() -> datetime:
    return datetime.now()

def create_task_data(title: str, desc: str) -> dict:
    return {"id": create_task_id(), "title": title, ...}

def save_to_db(task: dict) -> None:
    _tasks_db[task["id"]] = task

# Too many tiny functions!
```

### ✅ Consolidated (Do This)

```python
class TaskService:
    @staticmethod
    def create_task(data: TaskCreate) -> Task:
        """
        Consolidated creation logic.

        This method does substantial work:
        - Validates input (via Pydantic)
        - Generates ID and timestamp
        - Creates Task instance
        - Stores in database
        - Returns created task

        No need for separate validate_title(), create_id(), etc.
        Pydantic handles validation, Task model handles creation.
        """
        task = Task(title=data.title, description=data.description)
        _tasks_db[task.id] = task
        return task
```

**Rationale:**
- Each method does meaningful work
- Clear, understandable operations
- Less cognitive overhead
- Following "deep modules" principle
- Only extract functions when there's real complexity or reuse

## Pydantic Features Used

### 1. Field Validation

```python
title: str = Field(..., min_length=1, max_length=200)
```
- Automatic length checking
- Clear error messages
- No manual `if len(title) < 1` checks

### 2. Custom Validators

```python
@field_validator('title')
@classmethod
def title_not_empty(cls, v: str) -> str:
    if not v.strip():
        raise ValueError('Title cannot be empty')
    return v.strip()
```
- Custom business rules
- Automatic invocation
- Chainable with built-in validators

### 3. Schema Generation

```python
Task.model_json_schema()
# Returns complete JSON schema for MCP, OpenAPI, etc.
```

### 4. Serialization

```python
task.model_dump()  # Convert to dict
task.model_dump_json()  # Convert to JSON string
```

### 5. Enums

```python
class TaskFilter(str, Enum):
    ALL = "all"
    COMPLETED = "completed"
    PENDING = "pending"
```
- Type-safe filter options
- Automatic schema generation with enum values
- IDE autocompletion

## Example Flow

### Creating a Task

1. **HTTP Request**:
   ```json
   POST /api/tasks
   {"title": "Learn Pydantic", "description": "Study models"}
   ```

2. **Pydantic Validation**:
   ```python
   task_data = TaskCreate(**data)
   # Validates: title not empty, within length limits
   # Automatically trims whitespace
   ```

3. **Service Call**:
   ```python
   task = task_service.create_task(task_data)
   # Creates Task model with auto-generated ID, timestamp
   ```

4. **Response**:
   ```python
   return jsonify(task.model_dump())
   # Automatically serializes datetime, etc.
   ```

### Same via MCP

1. **MCP Tool Call**:
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "create_task",
       "arguments": {"data": {"title": "Learn Pydantic", ...}}
     }
   }
   ```

2. **Same Validation, Same Service, Same Model!**

## Benefits Summary

1. **Type Safety**: Catch errors at development time
2. **Automatic Validation**: No manual `if` checks
3. **Schema Generation**: MCP tools auto-configured
4. **Documentation**: Models are self-documenting
5. **Consistency**: REST and MCP validated identically
6. **Less Code**: Pydantic eliminates boilerplate
7. **Better IDEs**: Full autocompletion and type hints
8. **Consolidated Logic**: Meaningful methods, not tiny functions

## Guidelines

### When to Create a New Function

Only create a separate function if:
1. **Reused in multiple places** - DRY principle
2. **Complex algorithm** - Needs isolation for clarity
3. **Different abstraction level** - Separating concerns

### When NOT to Create a Function

Don't create tiny functions for:
1. **Single-use operations** - Inline them
2. **Simple transformations** - Keep in caller
3. **Obvious operations** - Like `create_id()` → just use `uuid.uuid4()`
4. **Pydantic-handled logic** - Like `validate_title()` → use Field validators

### Code Organization

```
backend/
├── tasks.py              # All task logic (models + service)
├── api_decorators.py     # Unified operation system
├── app.py                # REST + MCP routes
└── requirements.txt      # Including pydantic>=2.0.0
```

Simple, flat structure. No unnecessary nesting.

## Migration from Old Code

### Old Structure (With tasks/ folder)

```
tasks/
├── __init__.py
└── service.py (many tiny functions)
```

### New Structure (Single file)

```
tasks.py (Pydantic models + consolidated service)
```

**Changes:**
- Removed `tasks/` folder
- Consolidated into single `tasks.py`
- Replaced manual validation with Pydantic
- Removed tiny helper functions
- Added comprehensive Pydantic models

## Testing with Pydantic

```python
# Validation happens automatically
def test_create_task():
    # Valid
    task = TaskCreate(title="Valid")  # ✓ Works

    # Invalid - raises ValidationError
    task = TaskCreate(title="")  # ✗ Fails (min_length=1)
    task = TaskCreate(title="x" * 201)  # ✗ Fails (max_length=200)
```

Pydantic provides detailed error messages automatically!

## Learn More

- Pydantic documentation: https://docs.pydantic.dev/
- See [tasks.py](backend/tasks.py) for complete implementation
- See [app.py](backend/app.py) for REST + MCP integration
- See [api_decorators.py](backend/api_decorators.py) for automatic schema extraction

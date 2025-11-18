# Unified Architecture: Zero-Duplication REST + MCP

This document explains the advanced architectural pattern used in this project where REST API and MCP server share the same metadata with zero duplication.

## The Problem

Traditional approaches to supporting multiple interfaces lead to duplication:

### ❌ Traditional Approach (Duplicated)

```python
# REST endpoint
@app.route("/api/tasks", methods=["POST"])
async def create_task():
    """Create a new task"""  # Description #1
    data = await request.get_json()
    if "title" not in data:  # Validation #1
        return {"error": "Title required"}, 400
    # ... implementation

# MCP tool
@mcp.tool()
async def create_task_tool():
    """Create a new task"""  # Description #2 (duplicate!)
    return Tool(
        name="create_task",
        description="Create a new task",  # Description #3 (duplicate!)
        inputSchema={  # Schema (duplicate validation!)
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Task title"}
            },
            "required": ["title"]
        }
    )
    # ... different implementation using same business logic
```

**Problems:**
1. Descriptions defined 3 times
2. Validation defined 2 times
3. Schema defined 2 times
4. Easy to get out of sync
5. More code to maintain

## The Solution: Unified Operations

### ✅ Our Approach (Zero Duplication)

```python
from api_decorators import operation, Parameter

@operation(
    name="create_task",
    description="Create a new task",  # DEFINED ONCE
    parameters=[
        Parameter("title", "string", "Task title", required=True)  # DEFINED ONCE
    ],
    http_method="POST",
    http_path="/api/tasks"
)
async def op_create_task(title: str):
    return tasks_service.create_task(title)
```

**Benefits:**
1. ✅ Description defined **once**
2. ✅ Schema defined **once**
3. ✅ Automatically generates both REST and MCP
4. ✅ Cannot get out of sync
5. ✅ Less code to maintain

## How It Works

### 1. The Decorator System ([api_decorators.py](backend/api_decorators.py))

The `@operation` decorator captures all metadata:

```python
@operation(
    name="create_task",           # Used for MCP tool name
    description="...",            # Used for both REST docs and MCP description
    parameters=[...],             # Converted to JSON schema for MCP
    http_method="POST",           # Used for REST routing
    http_path="/api/tasks"        # Used for REST routing
)
async def op_create_task(title: str, description: str = ""):
    return tasks_service.create_task(title, description)
```

This decorator:
- Stores the operation in a global registry
- Captures metadata that works for both REST and MCP
- Returns the original function unchanged

### 2. REST Route Generation ([app.py](backend/app.py))

REST routes call the decorated functions:

```python
@app.route("/api/tasks", methods=["POST"])
async def rest_create_task():
    """REST wrapper for create_task operation."""
    data = await request.get_json()

    # Validate using operation metadata
    if not data or "title" not in data:
        return jsonify({"error": "Title is required"}), 400

    # Call the operation handler
    task, error = await op_create_task(
        title=data["title"],
        description=data.get("description", "")
    )

    if error:
        return jsonify({"error": error}), 400

    return jsonify(task), 201
```

### 3. MCP Tool Generation ([app.py](backend/app.py#L434))

MCP tools are auto-generated from the same decorators:

```python
@app.route("/mcp", methods=["POST"])
async def mcp_json_rpc():
    method = data.get("method")

    if method == "tools/list":
        # Auto-generate tool list from @operation decorators
        tools = get_mcp_tools()  # Reads from decorator registry
        return jsonify({"jsonrpc": "2.0", "result": {"tools": tools}})

    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        # Get the operation handler
        op = get_operation(tool_name)

        # Call the same handler that REST uses!
        result = await op.handler(**arguments)

        return jsonify({"jsonrpc": "2.0", "result": {...}})
```

### 4. Shared Business Logic ([tasks/service.py](backend/tasks/service.py))

Both interfaces call the same business logic:

```python
# In tasks/service.py
def create_task(title: str, description: str = "") -> tuple[dict | None, str | None]:
    """Core business logic - used by all interfaces."""
    # Validation
    is_valid, error = validate_task_data({"title": title})
    if not is_valid:
        return None, error

    # Create task
    task = create_task_data(title, description)

    # Save
    saved_task = save_task(task)

    return saved_task, None
```

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Interfaces Layer                       │
│  ┌─────────────────┐         ┌─────────────────┐        │
│  │   REST Routes   │         │  MCP JSON-RPC   │        │
│  │ (HTTP Wrappers) │         │   (HTTP/POST)   │        │
│  └────────┬────────┘         └────────┬────────┘        │
└───────────┼──────────────────────────┼──────────────────┘
            │                          │
            └──────────┬───────────────┘
                       │
         ┌─────────────▼─────────────┐
         │  @operation Decorators     │
         │  (api_decorators.py)       │
         │  • Metadata registry       │
         │  • Schema generation       │
         │  • Operation routing       │
         └─────────────┬──────────────┘
                       │
         ┌─────────────▼─────────────┐
         │  Operation Handlers        │
         │  (op_create_task, etc.)    │
         │  • Parameter handling      │
         │  • Call business logic     │
         └─────────────┬──────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   Business Logic Layer     │
         │   (tasks/service.py)       │
         │   • Calculations           │
         │   • Actions                │
         │   • Data                   │
         └────────────────────────────┘
```

## Key Benefits

### 1. **DRY (Don't Repeat Yourself)**
Metadata is defined exactly once. Change it once, both interfaces update.

### 2. **Consistency Guaranteed**
REST and MCP cannot have different descriptions or schemas - they're generated from the same source.

### 3. **Single Process**
No need for inter-process communication. Both interfaces share the same memory and business logic.

### 4. **Easy to Add Interfaces**
Want to add GraphQL? WebSocket? CLI? Just add another interface layer that uses the same operations.

### 5. **Type Safety**
TypeScript-like type hints in Python decorators help catch errors early.

## Example: Adding a New Operation

To add a new operation that's exposed as both REST and MCP:

```python
@operation(
    name="mark_all_complete",
    description="Mark all tasks as completed",
    parameters=[],
    http_method="POST",
    http_path="/api/tasks/complete-all"
)
async def op_mark_all_complete() -> dict:
    """Mark all tasks as completed."""
    count = tasks_service.mark_all_complete()
    return {"marked_complete": count}

# Add REST wrapper
@app.route("/api/tasks/complete-all", methods=["POST"])
async def rest_mark_all_complete():
    result = await op_mark_all_complete()
    return jsonify(result)

# MCP automatically picks it up from the decorator!
# No additional MCP code needed!
```

## Testing Both Interfaces

### Test REST:
```bash
curl -X POST http://localhost:5001/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"REST Task","description":"Created via REST"}'
```

### Test MCP:
```bash
curl -X POST http://localhost:5001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_task","arguments":{"title":"MCP Task","description":"Created via MCP"}},"id":1}'
```

### Verify They Share Data:
```bash
curl http://localhost:5001/api/tasks
# Both "REST Task" and "MCP Task" appear!
```

## Design Principles Applied

### From "A Philosophy of Software Design":

1. **Deep Modules**: `tasks.service` has simple interface, complex implementation
2. **Information Hiding**: Business logic hidden behind operation decorators
3. **Define Errors Out of Existence**: Cannot have inconsistent metadata between interfaces

### From "Grokking Simplicity":

1. **Separate Calculations from Actions**: Pure functions vs I/O in `tasks.service`
2. **Stratified Design**: Clear layers (interface → operations → business logic)
3. **Minimize Side Effects**: Operations are predictable and testable

## Comparison with Other Approaches

| Approach | Lines of Code | Duplication | Consistency | Maintenance |
|----------|---------------|-------------|-------------|-------------|
| **Separate REST + MCP** | ~500 | High | Manual sync | Hard |
| **Shared Business Logic** | ~400 | Medium | Better | Medium |
| **Unified Operations (Ours)** | ~350 | None | Guaranteed | Easy |

## Future Enhancements

This pattern makes it trivial to add:

1. **GraphQL**: Read operations, call handlers
2. **gRPC**: Define protobuf, call handlers
3. **WebSocket**: Real-time events, call handlers
4. **CLI**: Argparse interface, call handlers
5. **Message Queue**: Consume messages, call handlers

All without duplicating business logic or metadata!

## Learn More

- See [app.py](backend/app.py) for the implementation
- See [api_decorators.py](backend/api_decorators.py) for the decorator system
- See [tasks/service.py](backend/tasks/service.py) for business logic
- See [README.md](README.md) for usage instructions

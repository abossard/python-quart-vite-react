"""
Unified Quart Backend with REST and MCP

Clean architecture with Pydantic:
- Type-safe with automatic validation
- Single process for REST API and MCP JSON-RPC
- Zero duplication: types and schemas defined once
- Pydantic models drive everything

Architecture layers:
- tasks.py: Pydantic models + business logic
- api_decorators.py: Unified operation system
- This file: REST routes + MCP JSON-RPC

Key insight: Define operation with type hints, get REST + MCP + validation automatically!
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

# Import unified operation system
from api_decorators import get_mcp_tools, get_operation, operation
from pydantic import ValidationError
from quart import Quart, jsonify, request, send_from_directory
from quart_cors import cors
# Import Pydantic models and service
from tasks import (Task, TaskCreate, TaskFilter, TaskService, TaskStats,
                   TaskUpdate)
from ollama_service import (ChatRequest, ChatResponse, ModelListResponse,
                             OllamaService)

# ============================================================================
# APPLICATION SETUP
# ============================================================================

app = Quart(__name__)
app = cors(app, allow_origin="*")

# Service instances
task_service = TaskService()
ollama_service = OllamaService()


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def format_datetime(dt: datetime) -> str:
    """Format datetime to ISO 8601 string."""
    return dt.isoformat()


# ============================================================================
# UNIFIED OPERATIONS
# Define once with Pydantic types, use for both REST and MCP!
# ============================================================================

@operation(
    name="list_tasks",
    description="List all tasks with optional filtering by completion status",
    http_method="GET",
    http_path="/api/tasks"
)
async def op_list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
    """
    List tasks with optional filtering.

    This operation serves BOTH:
    - REST API: GET /api/tasks?filter=...
    - MCP tool: list_tasks(filter=...)

    Pydantic's TaskFilter enum automatically generates MCP schema!
    """
    return task_service.list_tasks(filter)


@operation(
    name="create_task",
    description="Create a new task with validation",
    http_method="POST",
    http_path="/api/tasks"
)
async def op_create_task(data: TaskCreate) -> Task:
    """
    Create a new task.

    Pydantic automatically:
    - Validates title is not empty
    - Trims whitespace
    - Generates JSON schema for MCP

    Returns the created Task model.
    """
    return task_service.create_task(data)


@operation(
    name="get_task",
    description="Retrieve a specific task by its unique identifier",
    http_method="GET",
    http_path="/api/tasks/{task_id}"
)
async def op_get_task(task_id: str) -> Task | None:
    """
    Get task by ID.

    Returns None if not found - caller handles 404.
    """
    return task_service.get_task(task_id)


@operation(
    name="update_task",
    description="Update an existing task's properties",
    http_method="PUT",
    http_path="/api/tasks/{task_id}"
)
async def op_update_task(task_id: str, data: TaskUpdate) -> Task | None:
    """
    Update task with validation.

    TaskUpdate has all optional fields - only provided fields are updated.
    Pydantic validates any provided values automatically.

    Returns None if task not found.
    """
    return task_service.update_task(task_id, data)


@operation(
    name="delete_task",
    description="Delete a task permanently by its identifier",
    http_method="DELETE",
    http_path="/api/tasks/{task_id}"
)
async def op_delete_task(task_id: str) -> bool:
    """
    Delete task.

    Returns True if deleted, False if not found.
    """
    return task_service.delete_task(task_id)


@operation(
    name="get_task_stats",
    description="Get summary statistics for all tasks",
    http_method="GET",
    http_path="/api/tasks/stats"
)
async def op_get_task_stats() -> TaskStats:
    """
    Get task statistics.

    Returns Pydantic TaskStats model with total, completed, pending counts.
    """
    return task_service.get_stats()


@operation(
    name="ollama_chat",
    description="Generate a chat completion using local Ollama LLM",
    http_method="POST",
    http_path="/api/ollama/chat"
)
async def op_ollama_chat(request: ChatRequest) -> ChatResponse:
    """
    Chat with Ollama LLM.

    Supports conversation history and configurable temperature.
    Pydantic automatically validates message format and parameters.

    Returns the generated response with metadata.
    """
    return await ollama_service.chat(request)


@operation(
    name="list_ollama_models",
    description="List all available Ollama models on the local system",
    http_method="GET",
    http_path="/api/ollama/models"
)
async def op_list_ollama_models() -> ModelListResponse:
    """
    List available Ollama models.

    Returns list of models with name, size, and modification time.
    """
    return await ollama_service.list_models()


# ============================================================================
# REST API WRAPPERS
# These handle HTTP concerns and call the operations
# ============================================================================

@app.route("/api/tasks", methods=["GET"])
async def rest_list_tasks():
    """REST wrapper: list tasks."""
    filter_param = request.args.get("filter", "all")
    try:
        filter_enum = TaskFilter(filter_param)
        tasks = await op_list_tasks(filter_enum)
        return jsonify([task.model_dump() for task in tasks])
    except ValueError:
        return jsonify({"error": f"Invalid filter: {filter_param}"}), 400


@app.route("/api/tasks", methods=["POST"])
async def rest_create_task():
    """REST wrapper: create task with Pydantic validation."""
    try:
        data = await request.get_json()
        task_data = TaskCreate(**data)
        task = await op_create_task(task_data)
        return jsonify(task.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["GET"])
async def rest_get_task(task_id: str):
    """REST wrapper: get task by ID."""
    task = await op_get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task.model_dump())


@app.route("/api/tasks/<task_id>", methods=["PUT"])
async def rest_update_task(task_id: str):
    """REST wrapper: update task with Pydantic validation."""
    try:
        data = await request.get_json()
        update_data = TaskUpdate(**data)
        task = await op_update_task(task_id, update_data)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task.model_dump())
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
async def rest_delete_task(task_id: str):
    """REST wrapper: delete task."""
    success = await op_delete_task(task_id)
    if not success:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"message": "Task deleted successfully"}), 200


@app.route("/api/tasks/stats", methods=["GET"])
async def rest_get_stats():
    """REST wrapper: get task statistics."""
    stats = await op_get_task_stats()
    return jsonify(stats.model_dump())


@app.route("/api/ollama/chat", methods=["POST"])
async def rest_ollama_chat():
    """REST wrapper: chat with Ollama LLM."""
    try:
        data = await request.get_json()
        chat_request = ChatRequest(**data)
        response = await op_ollama_chat(chat_request)
        return jsonify(response.model_dump()), 200
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except ValueError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ollama/models", methods=["GET"])
async def rest_list_ollama_models():
    """REST wrapper: list available Ollama models."""
    try:
        models = await op_list_ollama_models()
        return jsonify(models.model_dump()), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# NON-TASK ENDPOINTS
# ============================================================================

@app.route("/api/health", methods=["GET"])
async def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": format_datetime(datetime.now()),
        "interfaces": ["REST", "MCP"],
        "features": ["Pydantic validation", "Type safety", "Auto schemas"]
    })


@app.route("/api/date", methods=["GET"])
async def get_current_date():
    """Get current date and time."""
    now = datetime.now()
    return jsonify({
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "datetime": format_datetime(now),
        "timestamp": now.timestamp()
    })


@app.route("/api/time-stream", methods=["GET"])
async def time_stream():
    """Server-Sent Events endpoint for real-time updates."""
    async def generate_time_events():
        try:
            while True:
                now = datetime.now()
                time_data = {
                    "time": now.strftime("%H:%M:%S"),
                    "date": now.strftime("%Y-%m-%d"),
                    "timestamp": now.timestamp()
                }
                yield f"data: {json.dumps(time_data)}\n\n"
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass

    return generate_time_events(), {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no"
    }


frontend_dist_path = Path(
    os.getenv(
        "FRONTEND_DIST",
        Path(__file__).resolve().parents[1] / "frontend" / "dist"
    )
)

if frontend_dist_path.exists() and (frontend_dist_path / "index.html").exists():
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    async def serve_frontend(path: str):
        """Serve the built frontend assets when available."""
        if path.startswith("api") or path.startswith("mcp"):
            return jsonify({"error": "Not Found"}), 404

        candidate = frontend_dist_path / path
        if path and candidate.exists() and candidate.is_file():
            return await send_from_directory(frontend_dist_path, path)

        return await send_from_directory(frontend_dist_path, "index.html")


# ============================================================================
# MCP JSON-RPC ENDPOINT
# ============================================================================

@app.route("/mcp", methods=["POST"])
async def mcp_json_rpc():
    """
    MCP JSON-RPC 2.0 over HTTP.

    Uses the SAME operations as REST, with schemas auto-generated from Pydantic!

    Supported methods:
    - initialize: Initialize MCP session
    - tools/list: List available tools (generated from @operation decorators + Pydantic)
    - tools/call: Execute a tool (uses same functions as REST)
    """
    try:
        data = await request.get_json()

        if not data or "jsonrpc" not in data:
            return jsonify({
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "Invalid Request"},
                "id": data.get("id") if data else None
            }), 400

        method = data.get("method")
        params = data.get("params", {})
        request_id = data.get("id")

        # Notifications (no response required but we acknowledge for logs)
        if method == "notifications/initialized":
            return jsonify({
                "jsonrpc": "2.0",
                "result": None,
                "id": request_id
            }), 200

        # Initialize
        if method == "initialize":
            return jsonify({
                "jsonrpc": "2.0",
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": "quart-pydantic-task-server",
                        "version": "2.0.0"
                    }
                },
                "id": request_id
            })

        # List tools (auto-generated from Pydantic models!)
        elif method == "tools/list":
            tools = get_mcp_tools()
            return jsonify({
                "jsonrpc": "2.0",
                "result": {"tools": tools},
                "id": request_id
            })

        # Call tool with Pydantic validation
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            op = get_operation(tool_name)
            if not op:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": f"Tool not found: {tool_name}"},
                    "id": request_id
                }), 404

            try:
                # Call operation with validation
                result = await op.handler(**arguments)

                # Serialize Pydantic models
                if isinstance(result, list):
                    result_text = json.dumps([item.model_dump() if hasattr(item, 'model_dump') else item for item in result], indent=2)
                elif hasattr(result, 'model_dump'):
                    result_text = json.dumps(result.model_dump(), indent=2)
                elif isinstance(result, bool):
                    result_text = f"Success: {result}"
                else:
                    result_text = json.dumps(result, indent=2)

                return jsonify({
                    "jsonrpc": "2.0",
                    "result": {
                        "content": [{
                            "type": "text",
                            "text": result_text
                        }]
                    },
                    "id": request_id
                })

            except ValidationError as e:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32602, "message": f"Validation error: {str(e)}"},
                    "id": request_id
                }), 400
            except Exception as e:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
                    "id": request_id
                }), 500

        else:
            return jsonify({
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": request_id
            }), 404

    except Exception as e:
        return jsonify({
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
            "id": None
        }), 500


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    # Initialize sample data
    num_tasks = task_service.initialize_sample_data()

    print("=" * 70)
    print("🚀 Unified Quart Server with Pydantic")
    print("=" * 70)
    print(f"📝 {num_tasks} sample tasks loaded")
    print()
    print("✨ Key Features:")
    print("   • Single process serving REST API + MCP JSON-RPC")
    print("   • Pydantic models for type safety and validation")
    print("   • Automatic schema generation from type hints")
    print("   • Zero duplication between interfaces")
    print()
    print("🌐 Available Interfaces:")
    print("   REST API:     http://localhost:5001/api/*")
    print("   MCP JSON-RPC: http://localhost:5001/mcp")
    print()
    print("💡 Port 5001 (macOS AirPlay uses 5000)")
    print("=" * 70)

    app.run(debug=True, host="0.0.0.0", port=5001)

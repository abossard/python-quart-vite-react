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
from typing import Optional

# Import unified operation system
from api_decorators import get_mcp_tools, get_operation, operation
from pydantic import ValidationError
from quart import Quart, jsonify, request, send_from_directory
from quart_cors import cors
# Import Pydantic models and service
from tasks import (Task, TaskCreate, TaskFilter, TaskService, TaskStats,
                   TaskUpdate)
# Import support ticket models and service
from support_tickets import (
    SupportTicket, SupportTicketCreate, SupportTicketUpdate,
    TicketCategory, Priority, TicketStatus,
    DashboardStats, TicketTrend, CategoryPerformance, TechnicianPerformance,
    Worklog, WorklogCreate,
    SupportTicketService
)
from support_data import initialize_support_data

# ============================================================================
# APPLICATION SETUP
# ============================================================================

app = Quart(__name__)
app = cors(app, allow_origin="*")

# Service instances
task_service = TaskService()
support_service = SupportTicketService()


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


# ============================================================================
# SUPPORT TICKET OPERATIONS
# ============================================================================

@operation(
    name="list_support_tickets",
    description="List all support tickets with optional filtering",
    http_method="GET",
    http_path="/api/support/tickets"
)
async def op_list_support_tickets(
    status: Optional[TicketStatus] = None,
    category: Optional[TicketCategory] = None,
    priority: Optional[Priority] = None,
    limit: int = 100
) -> list[SupportTicket]:
    """List support tickets with optional filtering."""
    tickets = support_service.list_tickets(status, category, priority)
    return tickets[:limit]


@operation(
    name="create_support_ticket",
    description="Create a new support ticket",
    http_method="POST",
    http_path="/api/support/tickets"
)
async def op_create_support_ticket(data: SupportTicketCreate) -> SupportTicket:
    """Create a new support ticket."""
    return support_service.create_ticket(data)


@operation(
    name="get_support_ticket",
    description="Get a specific support ticket by ID",
    http_method="GET",
    http_path="/api/support/tickets/{ticket_id}"
)
async def op_get_support_ticket(ticket_id: str) -> SupportTicket | None:
    """Get support ticket by ID."""
    return support_service.get_ticket(ticket_id)


@operation(
    name="update_support_ticket",
    description="Update an existing support ticket",
    http_method="PUT",
    http_path="/api/support/tickets/{ticket_id}"
)
async def op_update_support_ticket(ticket_id: str, data: SupportTicketUpdate) -> SupportTicket | None:
    """Update support ticket."""
    return support_service.update_ticket(ticket_id, data)


@operation(
    name="delete_support_ticket",
    description="Delete a support ticket",
    http_method="DELETE",
    http_path="/api/support/tickets/{ticket_id}"
)
async def op_delete_support_ticket(ticket_id: str) -> bool:
    """Delete support ticket."""
    return support_service.delete_ticket(ticket_id)


@operation(
    name="get_dashboard_stats",
    description="Get comprehensive dashboard statistics",
    http_method="GET",
    http_path="/api/support/stats"
)
async def op_get_dashboard_stats() -> DashboardStats:
    """Get dashboard statistics."""
    return support_service.get_stats()


@operation(
    name="get_ticket_trends",
    description="Get daily ticket trends for the specified number of days",
    http_method="GET",
    http_path="/api/support/trends"
)
async def op_get_ticket_trends(days: int = 30) -> list[TicketTrend]:
    """Get ticket trends over time."""
    return support_service.get_ticket_trends(days)


@operation(
    name="get_category_performance",
    description="Get performance metrics by category",
    http_method="GET",
    http_path="/api/support/category-performance"
)
async def op_get_category_performance() -> list[CategoryPerformance]:
    """Get category performance metrics."""
    return support_service.get_category_performance()


@operation(
    name="get_resolution_time_distribution",
    description="Get distribution of resolution times in buckets",
    http_method="GET",
    http_path="/api/support/resolution-distribution"
)
async def op_get_resolution_time_distribution() -> dict[str, int]:
    """Get resolution time distribution."""
    return support_service.get_resolution_time_distribution()


@operation(
    name="add_worklog",
    description="Add a worklog entry to a ticket",
    http_method="POST",
    http_path="/api/support/tickets/{ticket_id}/worklogs"
)
async def op_add_worklog(ticket_id: str, data: WorklogCreate) -> SupportTicket | None:
    """Add worklog to ticket."""
    return support_service.add_worklog(ticket_id, data)


@operation(
    name="get_technician_performance",
    description="Get performance metrics for all technicians",
    http_method="GET",
    http_path="/api/support/technician-performance"
)
async def op_get_technician_performance() -> list[TechnicianPerformance]:
    """Get technician performance metrics."""
    return support_service.get_technician_performance()


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


# ============================================================================
# SUPPORT TICKET REST WRAPPERS
# ============================================================================

@app.route("/api/support/tickets", methods=["GET"])
async def rest_list_support_tickets():
    """REST wrapper: list support tickets with optional filtering."""
    try:
        status_param = request.args.get("status")
        category_param = request.args.get("category")
        priority_param = request.args.get("priority")
        limit = int(request.args.get("limit", 100))
        
        status = TicketStatus(status_param) if status_param else None
        category = TicketCategory(category_param) if category_param else None
        priority = Priority(priority_param) if priority_param else None
        
        tickets = await op_list_support_tickets(status, category, priority, limit)
        return jsonify([ticket.model_dump() for ticket in tickets])
    except ValueError as e:
        return jsonify({"error": f"Invalid parameter: {str(e)}"}), 400


@app.route("/api/support/tickets", methods=["POST"])
async def rest_create_support_ticket():
    """REST wrapper: create support ticket."""
    try:
        data = await request.get_json()
        ticket_data = SupportTicketCreate(**data)
        ticket = await op_create_support_ticket(ticket_data)
        return jsonify(ticket.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/support/tickets/<ticket_id>", methods=["GET"])
async def rest_get_support_ticket(ticket_id: str):
    """REST wrapper: get support ticket by ID."""
    ticket = await op_get_support_ticket(ticket_id)
    if not ticket:
        return jsonify({"error": "Ticket not found"}), 404
    return jsonify(ticket.model_dump())


@app.route("/api/support/tickets/<ticket_id>", methods=["PUT"])
async def rest_update_support_ticket(ticket_id: str):
    """REST wrapper: update support ticket."""
    try:
        data = await request.get_json()
        update_data = SupportTicketUpdate(**data)
        ticket = await op_update_support_ticket(ticket_id, update_data)
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(ticket.model_dump())
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/support/tickets/<ticket_id>", methods=["DELETE"])
async def rest_delete_support_ticket(ticket_id: str):
    """REST wrapper: delete support ticket."""
    success = await op_delete_support_ticket(ticket_id)
    if not success:
        return jsonify({"error": "Ticket not found"}), 404
    return jsonify({"message": "Ticket deleted successfully"}), 200


@app.route("/api/support/stats", methods=["GET"])
async def rest_get_dashboard_stats():
    """REST wrapper: get dashboard statistics."""
    stats = await op_get_dashboard_stats()
    return jsonify(stats.model_dump())


@app.route("/api/support/trends", methods=["GET"])
async def rest_get_ticket_trends():
    """REST wrapper: get ticket trends."""
    days = int(request.args.get("days", 30))
    trends = await op_get_ticket_trends(days)
    return jsonify([trend.model_dump() for trend in trends])


@app.route("/api/support/category-performance", methods=["GET"])
async def rest_get_category_performance():
    """REST wrapper: get category performance."""
    performance = await op_get_category_performance()
    return jsonify([perf.model_dump() for perf in performance])


@app.route("/api/support/resolution-distribution", methods=["GET"])
async def rest_get_resolution_distribution():
    """REST wrapper: get resolution time distribution."""
    distribution = await op_get_resolution_time_distribution()
    return jsonify(distribution)


@app.route("/api/support/tickets/<ticket_id>/worklogs", methods=["POST"])
async def rest_add_worklog(ticket_id: str):
    """REST wrapper: add worklog to ticket."""
    try:
        data = await request.get_json()
        worklog_data = WorklogCreate(**data)
        ticket = await op_add_worklog(ticket_id, worklog_data)
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(ticket.model_dump()), 200
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/support/technician-performance", methods=["GET"])
async def rest_get_technician_performance():
    """REST wrapper: get technician performance."""
    performance = await op_get_technician_performance()
    return jsonify([perf.model_dump() for perf in performance])


@app.route("/api/support/stats-stream", methods=["GET"])
async def support_stats_stream():
    """Server-Sent Events endpoint for live dashboard updates."""
    async def generate_stats_events():
        try:
            while True:
                stats = await op_get_dashboard_stats()
                stats_data = stats.model_dump()
                yield f"data: {json.dumps(stats_data)}\n\n"
                await asyncio.sleep(5)  # Update every 5 seconds
        except asyncio.CancelledError:
            pass
    
    return generate_stats_events(), {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no"
    }


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
    num_tickets = initialize_support_data(550)
    
    # Get quick stats
    support_stats = support_service.get_stats()

    print("=" * 70)
    print("🚀 Unified Quart Server with Pydantic")
    print("=" * 70)
    print(f"📝 {num_tasks} sample tasks loaded")
    print()
    print("🎯 IT Support Dashboard - Sample Data Loaded")
    print("=" * 70)
    print(f"📊 Generated {num_tickets} realistic support tickets")
    print(f"📅 Date Range: Last 90 days")
    print(f"✅ Resolved: {support_stats.tickets_by_status.get('resolved', 0) + support_stats.tickets_by_status.get('closed', 0)}")
    print(f"🔄 In Progress: {support_stats.in_progress_tickets}")
    print(f"🆕 Open: {support_stats.open_tickets}")
    print(f"⭐ Avg Satisfaction: {support_stats.customer_satisfaction_avg:.2f}/5.0")
    print(f"⏱️  Avg Resolution: {support_stats.avg_resolution_time_hours:.1f} hours")
    print()
    print("✨ Dashboard Features:")
    print("   • 90 days of historical ticket data")
    print("   • Realistic issue descriptions and categories")
    print("   • Simulated technician assignments")
    print("   • Live activity stream (SSE) at /api/support/stats-stream")
    print("   • Interactive charts with real trends")
    print()
    print("🌐 Available Interfaces:")
    print("   REST API:       http://localhost:5001/api/*")
    print("   Support API:    http://localhost:5001/api/support/*")
    print("   MCP JSON-RPC:   http://localhost:5001/mcp")
    print()
    print("💡 Port 5001 (macOS AirPlay uses 5000)")
    print("=" * 70)

    app.run(debug=True, host="0.0.0.0", port=5001)

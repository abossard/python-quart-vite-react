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
from quart import Quart, jsonify, request, send_from_directory, make_response
from quart_cors import cors
# Import Pydantic models and service
from tasks import (Task, TaskCreate, TaskFilter, TaskService, TaskStats,
                   TaskUpdate, PriorityStats)
# Import Grabit models and services
from models import (
    User, UserCreate, UserUpdate, LoginRequest, LoginResponse, SessionInfo,
    Location, Department, Amt,
    Device, DeviceCreate, DeviceUpdate, DeviceBorrow, DeviceStatus, DeviceFull,
    MissingDevice, MissingDeviceCreate,
    DeviceStats, LocationStats, PasswordResetConfirm, UserRole
)
from auth import (
    authenticate_user, create_session, get_session, destroy_session,
    get_current_user, require_auth, require_role,
    get_session_info, require_user, require_editor, require_admin
)
from typing import Optional
from database import init_db, close_db, get_db
from devices import DeviceService
from events import get_event_manager, broadcast_event, EventType

# ============================================================================
# AUDIT LOGGING HELPER
# ============================================================================

async def log_audit(
    entity_type: str,
    action: str,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    snapshot_before: Optional[dict] = None,
    snapshot_after: Optional[dict] = None,
    details: Optional[str] = None
):
    """Log audit trail for all system changes"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        # Use explicit timestamp to match device_transactions format
        now = datetime.now().isoformat()
        
        await cursor.execute("""
            INSERT INTO audit_log (
                entity_type, entity_id, action, user_id, username,
                snapshot_before, snapshot_after, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entity_type,
            entity_id,
            action,
            user_id,
            username,
            json.dumps(snapshot_before) if snapshot_before else None,
            json.dumps(snapshot_after) if snapshot_after else None,
            details,
            now
        ))
        
        await db.commit()
        await cursor.close()
    except Exception as e:
        print(f"Audit log error: {e}")

# ============================================================================
# APPLICATION SETUP
# ============================================================================

app = Quart(__name__)
app = cors(
    app, 
    allow_origin=["http://localhost:3001", "http://localhost:3002", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

# Service instance
task_service = TaskService()


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
    name="get_priority_stats",
    description="Get priority statistics for open tasks",
    http_method="GET",
    http_path="/api/tasks/priority-stats"
)
async def op_get_priority_stats() -> PriorityStats:
    """
    Get priority statistics for open/pending tasks.

    Returns count of open tasks grouped by priority level (Low, Medium, High).
    """
    return task_service.get_priority_stats()


@operation(
    name="get_urgent_tasks",
    description="Get urgent tasks (High priority with deadline within 2 days)",
    http_method="GET",
    http_path="/api/tasks/urgent"
)
async def op_get_urgent_tasks() -> list[Task]:
    """
    Get urgent tasks that need immediate attention.

    Returns High priority tasks that are not completed and have deadline within 2 days.
    """
    return task_service.get_urgent_tasks()


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
        return jsonify([task.model_dump(mode='json') for task in tasks])
    except ValueError:
        return jsonify({"error": f"Invalid filter: {filter_param}"}), 400


@app.route("/api/tasks", methods=["POST"])
async def rest_create_task():
    """REST wrapper: create task with Pydantic validation."""
    try:
        data = await request.get_json()
        task_data = TaskCreate(**data)
        task = await op_create_task(task_data)
        return jsonify(task.model_dump(mode='json')), 201
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
    return jsonify(task.model_dump(mode='json'))


@app.route("/api/tasks/<task_id>", methods=["PUT"])
async def rest_update_task(task_id: str):
    """REST wrapper: update task with Pydantic validation."""
    try:
        data = await request.get_json()
        update_data = TaskUpdate(**data)
        task = await op_update_task(task_id, update_data)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task.model_dump(mode='json'))
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
    return jsonify(stats.model_dump(mode='json'))


@app.route("/api/tasks/priority-stats", methods=["GET"])
async def rest_get_priority_stats():
    """REST wrapper: get priority statistics for open tasks."""
    stats = await op_get_priority_stats()
    return jsonify(stats.model_dump(mode='json'))


@app.route("/api/tasks/urgent", methods=["GET"])
async def rest_get_urgent_tasks():
    """REST wrapper: get urgent tasks."""
    tasks = await op_get_urgent_tasks()
    return jsonify([task.model_dump(mode='json') for task in tasks])


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


@app.route("/api/events-stream", methods=["GET"])
async def events_stream():
    """
    Server-Sent Events endpoint for real-time data updates.
    
    Broadcasts events when any data changes:
    - device:borrowed, device:returned, device:created, etc.
    - user:created, user:updated, etc.
    - department:created, amt:updated, etc.
    
    All connected clients receive immediate updates.
    """
    event_manager = get_event_manager()
    queue = await event_manager.subscribe()
    
    async def generate_events():
        try:
            # Send connection confirmation
            yield f"data: {json.dumps({'type': 'connected', 'timestamp': datetime.now().isoformat()})}\n\n"
            
            while True:
                # Wait for events from the queue
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            # Unsubscribe when client disconnects
            await event_manager.unsubscribe(queue)
    
    return generate_events(), {
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
# GRABIT DEVICE MANAGEMENT ENDPOINTS
# ============================================================================

# Device service instance (initialized after DB connection)
device_service = None


@app.route('/api/devices', methods=['GET'])
@require_auth
async def list_devices():
    """List all devices with optional filtering"""
    try:
        status_param = request.args.get('status')
        location_id_param = request.args.get('location_id')
        
        status = DeviceStatus(status_param) if status_param else None
        location_id = int(location_id_param) if location_id_param else None
        
        devices = await device_service.list_devices(status=status, location_id=location_id)
        return jsonify([d.model_dump(mode='json') for d in devices]), 200
        
    except ValueError as e:
        return jsonify({'error': f'Invalid parameter: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>', methods=['GET'])
@require_auth
async def get_device(device_id: int):
    """Get a single device by ID"""
    try:
        device = await device_service.get_device(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        return jsonify(device.model_dump(mode='json')), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices', methods=['POST'])
@require_editor
async def create_device():
    """Create a new device (requires editor role)"""
    try:
        data = await request.get_json()
        device_data = DeviceCreate(**data)
        
        user = get_current_user()
        device = await device_service.create_device(device_data, user.id)
        
        return jsonify(device.model_dump(mode='json')), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>', methods=['PUT'])
@require_editor
async def update_device(device_id: int):
    """Update a device (requires editor role)"""
    try:
        data = await request.get_json()
        update_data = DeviceUpdate(**data)
        
        user = get_current_user()
        device = await device_service.update_device(device_id, update_data, user.id)
        
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        return jsonify(device.model_dump(mode='json')), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>', methods=['DELETE'])
@require_editor
async def delete_device(device_id: int):
    """Delete a device (requires editor role)"""
    try:
        user = get_current_user()
        success = await device_service.delete_device(device_id, user.id)
        
        if not success:
            return jsonify({'error': 'Device not found'}), 404
        
        return jsonify({'message': 'Device deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>/borrow', methods=['POST'])
@require_user
async def borrow_device(device_id: int):
    """Borrow a device (requires user role)"""
    try:
        data = await request.get_json()
        borrow_data = DeviceBorrow(**data)
        
        user = get_current_user()
        device = await device_service.borrow_device(device_id, borrow_data, user.id)
        
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        return jsonify(device.model_dump(mode='json')), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>/return', methods=['POST'])
@require_user
async def return_device(device_id: int):
    """Return a borrowed device (requires user role)"""
    try:
        data = await request.get_json()
        notes = data.get('notes') if data else None
        
        user = get_current_user()
        device = await device_service.return_device(device_id, user.id, notes)
        
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        return jsonify(device.model_dump(mode='json')), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<int:device_id>/missing', methods=['POST'])
@require_editor
async def report_device_missing(device_id: int):
    """Report a device as missing (requires editor role)"""
    try:
        data = await request.get_json()
        missing_data = MissingDeviceCreate(device_id=device_id, **data)
        
        user = get_current_user()
        missing_device = await device_service.report_missing(missing_data, user.id)
        
        return jsonify(missing_device.model_dump(mode='json')), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/stats', methods=['GET'])
@require_auth
async def get_device_stats():
    """Get device statistics"""
    try:
        stats = await device_service.get_device_stats()
        return jsonify(stats.model_dump(mode='json')), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/stats/locations', methods=['GET'])
@require_auth
async def get_location_stats():
    """Get device statistics by location"""
    try:
        stats = await device_service.get_location_stats()
        return jsonify([s.model_dump(mode='json') for s in stats]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/missing', methods=['GET'])
@require_auth
async def get_missing_devices():
    """Get all devices reported as missing"""
    try:
        db_conn = get_db()
        cursor = await db_conn.cursor()
        
        await cursor.execute("""
            SELECT 
                dm.id, dm.original_device_id, dm.device_type, dm.manufacturer, 
                dm.model, dm.serial_number, dm.inventory_number, dm.status,
                dm.location_id, dm.borrowed_at, dm.expected_return_date,
                dm.borrower_name, dm.borrower_email, dm.borrower_phone,
                dm.borrower_user_id, dm.borrower_snapshot, dm.notes,
                dm.reported_at, dm.reported_by_user_id,
                l.id as loc_id, l.name as loc_name, l.address as loc_address,
                u.id as reporter_id, u.username as reporter_name
            FROM devices_missing dm
            LEFT JOIN locations l ON dm.location_id = l.id
            LEFT JOIN users u ON dm.reported_by_user_id = u.id
            ORDER BY dm.reported_at DESC
        """)
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        missing_devices = []
        for row in rows:
            device = {
                'id': row[0],
                'original_device_id': row[1],
                'device_type': row[2],
                'manufacturer': row[3],
                'model': row[4],
                'serial_number': row[5],
                'inventory_number': row[6],
                'status': row[7],
                'location_id': row[8],
                'borrowed_at': row[9],
                'expected_return_date': row[10],
                'borrower_name': row[11],
                'borrower_email': row[12],
                'borrower_phone': row[13],
                'borrower_user_id': row[14],
                'borrower_snapshot': row[15],
                'notes': row[16],
                'reported_at': row[17],
                'reported_by_user_id': row[18],
                'location': {
                    'id': row[19],
                    'name': row[20],
                    'address': row[21],
                } if row[19] else None,
                'reported_by': {
                    'id': row[22],
                    'username': row[23],
                } if row[22] else None,
            }
            missing_devices.append(device)
        
        return jsonify(missing_devices), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/missing/<int:device_id>/restore', methods=['POST'])
@require_auth
async def restore_missing_device(device_id: int):
    """Restore a missing device back to the devices table"""
    try:
        user = get_current_user()
        
        db_conn = get_db()
        device_service = DeviceService(db_conn)
        
        restored_device = await device_service.restore_missing_device(device_id, user.id)
        
        return jsonify(restored_device.model_dump(mode='json')), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/missing/<int:device_id>', methods=['PUT'])
@require_auth
async def update_missing_device(device_id: int):
    """Update all fields of a missing device"""
    try:
        data = await request.get_json()
        
        db_conn = get_db()
        cursor = await db_conn.cursor()
        
        # Check if device exists
        await cursor.execute("SELECT id FROM devices_missing WHERE id = ?", (device_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Missing device not found'}), 404
        
        # Update all device fields
        await cursor.execute("""
            UPDATE devices_missing 
            SET device_type = ?,
                manufacturer = ?,
                model = ?,
                serial_number = ?,
                inventory_number = ?,
                location_id = ?,
                department_id = ?,
                amt_id = ?,
                notes = ?
            WHERE id = ?
        """, (
            data.get('device_type'),
            data.get('manufacturer'),
            data.get('model'),
            data.get('serial_number'),
            data.get('inventory_number'),
            data.get('location_id'),
            data.get('department_id'),
            data.get('amt_id'),
            data.get('notes', ''),
            device_id
        ))
        
        await db_conn.commit()
        await cursor.close()
        
        return jsonify({'message': 'Missing device updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/missing/<int:device_id>', methods=['DELETE'])
@require_auth
async def delete_missing_device(device_id: int):
    """Permanently delete a missing device record"""
    try:
        user = get_current_user()
        
        db_conn = get_db()
        device_service = DeviceService(db_conn)
        
        await device_service.delete_missing_device(device_id, user.id)
        
        return jsonify({'message': 'Missing device deleted successfully'}), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# TRANSACTION HISTORY ENDPOINTS
# ============================================================================

@app.route('/api/transactions/history', methods=['GET'])
@require_auth
async def get_transaction_history():
    """Get transaction history for all devices"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        await cursor.execute("""
            SELECT 
                dt.id,
                dt.device_id,
                dt.user_id,
                dt.action,
                dt.snapshot_before,
                dt.snapshot_after,
                dt.notes,
                dt.created_at,
                u.username,
                u.role
            FROM device_transactions dt
            LEFT JOIN users u ON dt.user_id = u.id
            ORDER BY dt.created_at DESC
            LIMIT 100
        """)
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        transactions = []
        for row in rows:
            transaction = {
                'id': row[0],
                'device_id': row[1],
                'user_id': row[2],
                'transaction_type': row[3],
                'snapshot_before': json.loads(row[4]) if row[4] else None,
                'snapshot_after': json.loads(row[5]) if row[5] else None,
                'notes': row[6],
                'created_at': row[7],
                'user': {
                    'username': row[8],
                    'role': row[9],
                } if row[8] else None,
            }
            
            # Extract device info from snapshots
            # Prefer snapshot_before as it contains full device info, snapshot_after often only has changed fields
            snapshot = transaction['snapshot_before'] or transaction['snapshot_after']
            if snapshot:
                transaction['device_type'] = snapshot.get('device_type', 'Unknown')
                transaction['manufacturer'] = snapshot.get('manufacturer', 'Unknown')
                transaction['model'] = snapshot.get('model', 'Unknown')
                transaction['inventory_number'] = snapshot.get('inventory_number', '-')
                transaction['borrower_name'] = snapshot.get('borrower_name')
            else:
                # If no snapshot, try to fetch current device info
                if transaction['device_id']:
                    try:
                        device_cursor = await db.cursor()
                        await device_cursor.execute("""
                            SELECT device_type, manufacturer, model, inventory_number
                            FROM devices WHERE id = ?
                        """, (transaction['device_id'],))
                        device_row = await device_cursor.fetchone()
                        await device_cursor.close()
                        
                        if device_row:
                            transaction['device_type'] = device_row[0]
                            transaction['manufacturer'] = device_row[1]
                            transaction['model'] = device_row[2]
                            transaction['inventory_number'] = device_row[3]
                        else:
                            # Device might be deleted, set defaults
                            transaction['device_type'] = 'Unknown'
                            transaction['manufacturer'] = 'Unknown'
                            transaction['model'] = 'Unknown'
                            transaction['inventory_number'] = '-'
                    except Exception:
                        transaction['device_type'] = 'Unknown'
                        transaction['manufacturer'] = 'Unknown'
                        transaction['model'] = 'Unknown'
                        transaction['inventory_number'] = '-'
                else:
                    transaction['device_type'] = 'Unknown'
                    transaction['manufacturer'] = 'Unknown'
                    transaction['model'] = 'Unknown'
                    transaction['inventory_number'] = '-'
            
            transactions.append(transaction)
        
        return jsonify(transactions), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# SYSTEM LOGS ENDPOINT (Admin Only)
# ============================================================================

@app.route('/api/logs', methods=['GET'])
@require_admin
async def get_system_logs():
    """Get system activity logs (admin only) - combines device transactions and audit logs"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        # Query audit_log for user/department/amt/location changes
        await cursor.execute("""
            SELECT 
                'audit' as source,
                al.id,
                al.action,
                al.entity_type,
                al.created_at,
                al.details,
                al.snapshot_after,
                al.username,
                u.first_name,
                u.last_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 200
        """)
        
        audit_rows = await cursor.fetchall()
        
        # Query device transactions for device-related logs
        await cursor.execute("""
            SELECT 
                'device' as source,
                dt.id,
                dt.action,
                'device' as entity_type,
                dt.created_at,
                dt.notes,
                dt.snapshot_after,
                u.username,
                u.first_name,
                u.last_name
            FROM device_transactions dt
            LEFT JOIN users u ON dt.user_id = u.id
            ORDER BY dt.created_at DESC
            LIMIT 200
        """)
        
        device_rows = await cursor.fetchall()
        await cursor.close()
        
        # Combine and process all logs
        all_logs = []
        
        # Process audit logs
        for row in audit_rows:
            details = row[5] or ''  # details column
            entity_type = row[3] or 'system'  # entity_type
            
            if row[6]:  # snapshot_after
                try:
                    snapshot = json.loads(row[6])
                    if entity_type == 'user':
                        info = f"{snapshot.get('username', '')} ({snapshot.get('first_name', '')} {snapshot.get('last_name', '')})".strip()
                    elif entity_type == 'department':
                        info = snapshot.get('name', '')
                    elif entity_type == 'amt':
                        info = snapshot.get('name', '')
                    elif entity_type == 'location':
                        info = snapshot.get('name', '')
                    else:
                        info = ''
                    
                    if info:
                        details = f"{info} - {details}" if details else info
                except:
                    pass
            
            log = {
                'id': f"audit-{row[1]}",
                'event_type': row[2],  # action
                'entity_type': entity_type,
                'timestamp': row[4],   # created_at
                'details': details,
                'user': f"{row[8]} {row[9]}" if row[8] and row[9] else (row[7] or 'System')
            }
            all_logs.append(log)
        
        # Process device transaction logs
        for row in device_rows:
            details = row[5] or ''  # notes
            if row[6]:  # snapshot_after
                try:
                    snapshot = json.loads(row[6])
                    device_info = f"{snapshot.get('device_type', '')} {snapshot.get('model', '')}".strip()
                    if device_info:
                        details = f"{device_info} - {details}" if details else device_info
                except:
                    pass
            
            log = {
                'id': f"device-{row[1]}",
                'event_type': row[2],  # action
                'entity_type': 'device',
                'timestamp': row[4],   # created_at
                'details': details,
                'user': f"{row[8]} {row[9]}" if row[8] and row[9] else (row[7] or 'System')
            }
            all_logs.append(log)
        
        # Sort all logs by timestamp (descending)
        # Handle different timestamp formats: ISO (device) vs SQLite (audit)
        def parse_timestamp(ts_str):
            try:
                # Try ISO format first (device transactions): 2025-12-11T12:57:22.417560
                if 'T' in ts_str:
                    return datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                # SQLite format (audit log): 2025-12-11 12:25:23
                else:
                    return datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
            except:
                # Fallback: return epoch if parsing fails
                return datetime(1970, 1, 1)
        
        all_logs.sort(key=lambda x: parse_timestamp(x['timestamp']), reverse=True)
        
        # Limit to 200 most recent
        all_logs = all_logs[:200]
        
        return jsonify(all_logs), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# GRABIT USER MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/users', methods=['GET'])
@require_auth
async def list_users():
    """List all users (requires authentication)"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        await cursor.execute("""
            SELECT u.id, u.username, u.first_name, u.last_name, u.email,
                   u.role, u.location_id, u.department_id, u.amt_id, u.created_at,
                   l.id as loc_id, l.name as loc_name, l.address as loc_address,
                   d.id as dept_id, d.name as dept_name, d.full_name as dept_full_name,
                   a.id as amt_id_join, a.name as amt_name, a.full_name as amt_full_name,
                   u.department, u.amt
            FROM users u
            LEFT JOIN locations l ON u.location_id = l.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN amt a ON u.amt_id = a.id
            ORDER BY u.created_at DESC
        """)
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        users = []
        for row in rows:
            user_data = {
                'id': row[0],
                'username': row[1],
                'first_name': row[2],
                'last_name': row[3],
                'email': row[4],
                'role': UserRole(row[5]),
                'location_id': row[6],
                'department_id': row[7],
                'amt_id': row[8],
                'created_at': datetime.fromisoformat(row[9]) if row[9] else datetime.now(),
                'department': row[19] if len(row) > 19 else None,
                'amt': row[20] if len(row) > 20 else None,
            }
            
            # Updated indices: loc (10,11,12), dept (13,14,15), amt (16,17,18), text fields (19,20)
            if row[10]:
                user_data['location'] = Location(id=row[10], name=row[11], address=row[12])
            
            # Don't populate department/amt objects anymore - we use text fields from admindir
            
            users.append(User(**user_data))
        
        return jsonify([u.model_dump(mode='json') for u in users]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['GET'])
@require_auth
async def get_user(user_id: int):
    """Get a single user by ID"""
    try:
        db = get_db()
        user = await authenticate_user_by_id(user_id, db)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user.model_dump(mode='json')), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users', methods=['POST'])
@require_admin
async def create_user():
    """Create a new user (requires admin role)"""
    try:
        data = await request.get_json()
        user_data = UserCreate(**data)
        
        from auth import hash_password
        db = get_db()
        cursor = await db.cursor()
        
        # Check if username already exists
        await cursor.execute("SELECT id FROM users WHERE username = ?", (user_data.username,))
        if await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Username already exists'}), 400
        
        # Create user
        password_hash = hash_password(user_data.password)
        now = datetime.now().isoformat()
        
        await cursor.execute("""
            INSERT INTO users (username, first_name, last_name, email, password_hash, role, 
                             location_id, department_id, amt_id, department, amt, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_data.username, user_data.first_name, user_data.last_name, user_data.email,
            password_hash, user_data.role.value,
            user_data.location_id, user_data.department_id, user_data.amt_id,
            user_data.department, user_data.amt,
            True, now, now
        ))
        
        user_id = cursor.lastrowid
        await db.commit()
        await cursor.close()
        
        # Return created user
        user = await authenticate_user_by_id(user_id, db)
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='user',
            action='create',
            entity_id=user_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=user.model_dump(mode='json'),
            details=f"Benutzer {user.username} erstellt"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.USER_CREATED, user.model_dump(mode='json'))
        
        return jsonify(user.model_dump(mode='json')), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@require_admin
async def update_user(user_id: int):
    """Update a user (requires admin role)"""
    try:
        data = await request.get_json()
        update_data = UserUpdate(**data)
        
        from auth import hash_password
        db = get_db()
        cursor = await db.cursor()
        
        # Check if user exists
        await cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Build update query
        updates = []
        params = []
        
        if update_data.username is not None:
            updates.append("username = ?")
            params.append(update_data.username)
        if update_data.first_name is not None:
            updates.append("first_name = ?")
            params.append(update_data.first_name)
        if update_data.last_name is not None:
            updates.append("last_name = ?")
            params.append(update_data.last_name)
        if update_data.email is not None:
            updates.append("email = ?")
            params.append(update_data.email)
        if update_data.password is not None:
            updates.append("password_hash = ?")
            params.append(hash_password(update_data.password))
        if update_data.role is not None:
            updates.append("role = ?")
            params.append(update_data.role.value)
        if update_data.location_id is not None:
            updates.append("location_id = ?")
            params.append(update_data.location_id)
        if update_data.department_id is not None:
            updates.append("department_id = ?")
            params.append(update_data.department_id)
        if update_data.amt_id is not None:
            updates.append("amt_id = ?")
            params.append(update_data.amt_id)
        
        # Always update updated_at timestamp
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        
        if not updates:
            await cursor.close()
            user = await authenticate_user_by_id(user_id, db)
            return jsonify(user.model_dump(mode='json')), 200
        
        params.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        await cursor.execute(query, params)
        await db.commit()
        await cursor.close()
        
        # Return updated user
        user = await authenticate_user_by_id(user_id, db)
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='user',
            action='update',
            entity_id=user_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=user.model_dump(mode='json'),
            details=f"Benutzer {user.username} aktualisiert"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.USER_UPDATED, user.model_dump(mode='json'))
        
        return jsonify(user.model_dump(mode='json')), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/update-location', methods=['PUT'])
@require_auth
async def update_own_location():
    """Update current user's location (any authenticated user can do this)"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = await request.get_json()
        location_id = data.get('location_id')
        
        if location_id is None:
            return jsonify({'error': 'location_id is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if location exists
        await cursor.execute("SELECT id FROM locations WHERE id = ?", (location_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Location not found'}), 404
        
        # Update user's location
        await cursor.execute(
            "UPDATE users SET location_id = ? WHERE id = ?",
            (location_id, current_user.id)
        )
        await db.commit()
        await cursor.close()
        
        # Return updated user
        user = await authenticate_user_by_id(current_user.id, db)
        return jsonify(user.model_dump(mode='json')), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@require_admin
async def delete_user(user_id: int):
    """Delete a user (requires admin role)"""
    try:
        current_user = get_current_user()
        if current_user and current_user.id == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Get user data before deletion for audit log
        await cursor.execute("SELECT username, first_name, last_name, email, role FROM users WHERE id = ?", (user_id,))
        user_row = await cursor.fetchone()
        if not user_row:
            await cursor.close()
            return jsonify({'error': 'User not found'}), 404
        
        user_snapshot = {
            'username': user_row[0],
            'first_name': user_row[1],
            'last_name': user_row[2],
            'email': user_row[3],
            'role': user_row[4]
        }
        
        await cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await db.commit()
        await cursor.close()
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='user',
            action='delete',
            entity_id=user_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_before=user_snapshot,
            details=f"Benutzer {user_snapshot['username']} gelöscht"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.USER_DELETED, {'id': user_id})
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/change-location', methods=['POST'])
@require_admin
async def change_user_location(user_id: int):
    """Change user's location (requires admin role)"""
    try:
        data = await request.get_json()
        location_id = data.get('location_id')
        
        if not location_id:
            return jsonify({'error': 'location_id is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        await cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'User not found'}), 404
        
        await cursor.execute("UPDATE users SET location_id = ? WHERE id = ?", (location_id, user_id))
        await db.commit()
        await cursor.close()
        
        user = await authenticate_user_by_id(user_id, db)
        return jsonify(user.model_dump(mode='json')), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admindir/search', methods=['GET'])
@require_auth
async def search_admindir():
    """Proxy for admindir.verzeichnisse.admin.ch user search - uses persons API for faster results with email"""
    try:
        import aiohttp
        
        search_term = request.args.get('s', '')
        lang = request.args.get('lang', 'de')
        
        if not search_term or len(search_term.strip()) < 2:
            return jsonify({'persons': []}), 200
        
        # Use persons API directly - it's faster and includes email
        url = f'https://admindir.verzeichnisse.admin.ch/api/search/persons?s={search_term}&lang={lang}&page=1&pageSize=10'
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers={
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    # Transform to match the expected format
                    persons = []
                    for person in data.get('result', []):
                        persons.append({
                            'id': person.get('id', ''),
                            'result': f"{person.get('givenName', '')} {person.get('surname', '')}".strip(),
                            'email': person.get('email', ''),
                        })
                    return jsonify({'persons': persons}), 200
                else:
                    return jsonify({'error': f'Admindir search failed: {response.status}'}), response.status
    
    except Exception as e:
        print(f'Admindir search error: {e}')
        return jsonify({'error': 'Fehler beim Suchen in Admindir'}), 500


@app.route('/api/admindir/person/<person_id>', methods=['GET'])
@require_auth
async def get_admindir_person(person_id: str):
    """Proxy to get full person details from admindir.verzeichnisse.admin.ch"""
    try:
        import aiohttp
        
        lang = request.args.get('lang', 'de')
        # Use the persons search endpoint with person_id as search term
        url = f'https://admindir.verzeichnisse.admin.ch/api/search/persons?lang={lang}&s={person_id}&page=1&pageSize=10'
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers={
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return jsonify(data), 200
                else:
                    return jsonify({'error': f'Admindir person fetch failed: {response.status}'}), response.status
    
    except Exception as e:
        print(f'Admindir person fetch error: {e}')
        return jsonify({'error': 'Fehler beim Laden der Benutzerdetails'}), 500


@app.route('/api/password-reset/request', methods=['POST'])
async def request_password_reset():
    """Request a password reset token"""
    try:
        data = await request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'email is required'}), 400
        
        # In a real application, this would:
        # 1. Find user by email
        # 2. Generate secure token
        # 3. Store token in password_resets table
        # 4. Send email with reset link
        
        # For demo purposes, just return success
        return jsonify({'message': 'Password reset instructions sent to email'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/password-reset/confirm', methods=['POST'])
async def confirm_password_reset():
    """Confirm password reset with token"""
    try:
        data = await request.get_json()
        reset_data = PasswordResetConfirm(**data)
        
        from auth import hash_password
        db = get_db()
        cursor = await db.cursor()
        
        # Find valid token
        await cursor.execute("""
            SELECT user_id FROM password_resets
            WHERE token = ? AND used = 0 AND expires_at > datetime('now')
        """, (reset_data.token,))
        
        row = await cursor.fetchone()
        if not row:
            await cursor.close()
            return jsonify({'error': 'Invalid or expired token'}), 400
        
        user_id = row[0]
        
        # Update password
        password_hash = hash_password(reset_data.new_password)
        await cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        
        # Mark token as used
        await cursor.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (reset_data.token,))
        
        await db.commit()
        await cursor.close()
        
        return jsonify({'message': 'Password reset successfully'}), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Helper function for user lookup
async def authenticate_user_by_id(user_id: int, db_conn) -> Optional[User]:
    """Get user by ID with related entities"""
    cursor = await db_conn.cursor()
    await cursor.execute("""
        SELECT u.id, u.username, u.first_name, u.last_name, u.email, 
               u.role, u.location_id, u.department_id, u.amt_id, u.created_at,
               l.id as loc_id, l.name as loc_name, l.address as loc_address,
               u.department, u.amt
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.id
        WHERE u.id = ?
    """, (user_id,))
    
    row = await cursor.fetchone()
    await cursor.close()
    
    if not row:
        return None
    
    user_data = {
        'id': row[0],
        'username': row[1],
        'first_name': row[2],
        'last_name': row[3],
        'email': row[4],
        'role': UserRole(row[5]),
        'location_id': row[6],
        'department_id': row[7],
        'amt_id': row[8],
        'created_at': datetime.fromisoformat(row[9]) if row[9] else datetime.now(),
        'department': row[13] if len(row) > 13 else None,
        'amt': row[14] if len(row) > 14 else None,
    }
    
    if row[10]:
        user_data['location'] = Location(id=row[10], name=row[11], address=row[12])
    
    return User(**user_data)


# ============================================================================
# DEPARTMENTS ENDPOINTS
# ============================================================================

@app.route('/api/departments', methods=['GET'])
@require_auth
async def list_departments():
    """List all departments"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("SELECT id, name, full_name FROM departments ORDER BY name")
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        departments = [{'id': row[0], 'name': row[1], 'full_name': row[2]} for row in rows]
        return jsonify(departments), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/departments/<int:dept_id>', methods=['GET'])
@require_auth
async def get_department(dept_id):
    """Get a specific department"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("SELECT id, name, full_name FROM departments WHERE id = ?", (dept_id,))
        
        row = await cursor.fetchone()
        await cursor.close()
        
        if not row:
            return jsonify({'error': 'Department not found'}), 404
        
        return jsonify({'id': row[0], 'name': row[1], 'full_name': row[2]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/departments', methods=['POST'])
@require_admin
async def create_department():
    """Create a new department (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        full_name = data.get('full_name')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if department already exists
        await cursor.execute("SELECT id FROM departments WHERE name = ?", (name,))
        if await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Department already exists'}), 400
        
        await cursor.execute("INSERT INTO departments (name, full_name) VALUES (?, ?)", (name, full_name))
        dept_id = cursor.lastrowid
        await db.commit()
        await cursor.close()
        
        dept_data = {'id': dept_id, 'name': name, 'full_name': full_name}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='department',
            action='create',
            entity_id=dept_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=dept_data,
            details=f"Department {name} erstellt"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEPARTMENT_CREATED, dept_data)
        
        return jsonify(dept_data), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/departments/<int:dept_id>', methods=['PUT'])
@require_admin
async def update_department(dept_id):
    """Update a department (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        full_name = data.get('full_name')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if department exists
        await cursor.execute("SELECT id FROM departments WHERE id = ?", (dept_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Department not found'}), 404
        
        await cursor.execute("UPDATE departments SET name = ?, full_name = ? WHERE id = ?", (name, full_name, dept_id))
        await db.commit()
        await cursor.close()
        
        dept_data = {'id': dept_id, 'name': name, 'full_name': full_name}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='department',
            action='update',
            entity_id=dept_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=dept_data,
            details=f"Department {name} aktualisiert"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEPARTMENT_UPDATED, dept_data)
        
        return jsonify(dept_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/departments/<int:dept_id>', methods=['DELETE'])
@require_admin
async def delete_department(dept_id):
    """Delete a department (admin only)"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        # Get department data before deletion for audit log
        await cursor.execute("SELECT name, full_name FROM departments WHERE id = ?", (dept_id,))
        dept_row = await cursor.fetchone()
        if not dept_row:
            await cursor.close()
            return jsonify({'error': 'Department not found'}), 404
        
        dept_snapshot = {'id': dept_id, 'name': dept_row[0], 'full_name': dept_row[1]}
        
        # Check if department is in use
        await cursor.execute("SELECT COUNT(*) FROM users WHERE department_id = ?", (dept_id,))
        count = (await cursor.fetchone())[0]
        
        if count > 0:
            await cursor.close()
            return jsonify({'error': f'Cannot delete department: {count} users are assigned to it'}), 400
        
        await cursor.execute("DELETE FROM departments WHERE id = ?", (dept_id,))
        await db.commit()
        await cursor.close()
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='department',
            action='delete',
            entity_id=dept_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_before=dept_snapshot,
            details=f"Department {dept_snapshot['name']} gelöscht"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEPARTMENT_DELETED, {'id': dept_id})
        
        return jsonify({'message': 'Department deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# AMTS ENDPOINTS
# ============================================================================

@app.route('/api/amts', methods=['GET'])
@require_auth
async def list_amts():
    """List all amts with department info"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("""
            SELECT a.id, a.name, a.full_name, a.department_id, d.name as dept_name, d.full_name as dept_full_name
            FROM amt a
            LEFT JOIN departments d ON a.department_id = d.id
            ORDER BY a.name
        """)
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        amts = [
            {
                'id': row[0],
                'name': row[1],
                'full_name': row[2],
                'department_id': row[3],
                'department': {'id': row[3], 'name': row[4], 'full_name': row[5]} if row[3] else None
            }
            for row in rows
        ]
        return jsonify(amts), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/amts/<int:amt_id>', methods=['GET'])
@require_auth
async def get_amt(amt_id):
    """Get a specific amt with department info"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("""
            SELECT a.id, a.name, a.full_name, a.department_id, d.name as dept_name, d.full_name as dept_full_name
            FROM amt a
            LEFT JOIN departments d ON a.department_id = d.id
            WHERE a.id = ?
        """, (amt_id,))
        
        row = await cursor.fetchone()
        await cursor.close()
        
        if not row:
            return jsonify({'error': 'Amt not found'}), 404
        
        return jsonify({
            'id': row[0],
            'name': row[1],
            'full_name': row[2],
            'department_id': row[3],
            'department': {'id': row[3], 'name': row[4], 'full_name': row[5]} if row[3] else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/amts', methods=['POST'])
@require_admin
async def create_amt():
    """Create a new amt (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        full_name = data.get('full_name')
        department_id = data.get('department_id')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        if not department_id:
            return jsonify({'error': 'department_id is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if department exists
        await cursor.execute("SELECT id FROM departments WHERE id = ?", (department_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Department not found'}), 404
        
        # Check if amt already exists
        await cursor.execute("SELECT id FROM amt WHERE name = ?", (name,))
        if await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Amt already exists'}), 400
        
        await cursor.execute("INSERT INTO amt (name, full_name, department_id) VALUES (?, ?, ?)", (name, full_name, department_id))
        amt_id = cursor.lastrowid
        await db.commit()
        await cursor.close()
        
        amt_data = {'id': amt_id, 'name': name, 'full_name': full_name, 'department_id': department_id}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='amt',
            action='create',
            entity_id=amt_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=amt_data,
            details=f"Amt {name} erstellt"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.AMT_CREATED, amt_data)
        
        return jsonify(amt_data), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/amts/<int:amt_id>', methods=['PUT'])
@require_admin
async def update_amt(amt_id):
    """Update an amt (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        full_name = data.get('full_name')
        department_id = data.get('department_id')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        if not department_id:
            return jsonify({'error': 'department_id is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if amt exists
        await cursor.execute("SELECT id FROM amt WHERE id = ?", (amt_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Amt not found'}), 404
        
        # Check if department exists
        await cursor.execute("SELECT id FROM departments WHERE id = ?", (department_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Department not found'}), 404
        
        await cursor.execute("UPDATE amt SET name = ?, full_name = ?, department_id = ? WHERE id = ?", (name, full_name, department_id, amt_id))
        await db.commit()
        await cursor.close()
        
        amt_data = {'id': amt_id, 'name': name, 'full_name': full_name, 'department_id': department_id}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='amt',
            action='update',
            entity_id=amt_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=amt_data,
            details=f"Amt {name} aktualisiert"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.AMT_UPDATED, amt_data)
        
        return jsonify(amt_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/amts/<int:amt_id>', methods=['DELETE'])
@require_admin
async def delete_amt(amt_id):
    """Delete an amt (admin only)"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        # Get amt data before deletion for audit log
        await cursor.execute("SELECT name, full_name, department_id FROM amt WHERE id = ?", (amt_id,))
        amt_row = await cursor.fetchone()
        if not amt_row:
            await cursor.close()
            return jsonify({'error': 'Amt not found'}), 404
        
        amt_snapshot = {'id': amt_id, 'name': amt_row[0], 'full_name': amt_row[1], 'department_id': amt_row[2]}
        
        # Check if amt is in use
        await cursor.execute("SELECT COUNT(*) FROM users WHERE amt_id = ?", (amt_id,))
        count = (await cursor.fetchone())[0]
        
        if count > 0:
            await cursor.close()
            return jsonify({'error': f'Cannot delete amt: {count} users are assigned to it'}), 400
        
        await cursor.execute("DELETE FROM amt WHERE id = ?", (amt_id,))
        await db.commit()
        await cursor.close()
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='amt',
            action='delete',
            entity_id=amt_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_before=amt_snapshot,
            details=f"Amt {amt_snapshot['name']} gelöscht"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.AMT_DELETED, {'id': amt_id})
        
        return jsonify({'message': 'Amt deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# LOCATIONS ENDPOINTS
# ============================================================================

@app.route('/api/locations', methods=['GET'])
@require_auth
async def list_locations():
    """List all locations"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("SELECT id, name, address FROM locations ORDER BY name")
        
        rows = await cursor.fetchall()
        await cursor.close()
        
        locations = [{'id': row[0], 'name': row[1], 'address': row[2]} for row in rows]
        return jsonify(locations), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/locations/<int:location_id>', methods=['GET'])
@require_auth
async def get_location(location_id):
    """Get a specific location"""
    try:
        db = get_db()
        cursor = await db.cursor()
        await cursor.execute("SELECT id, name, address FROM locations WHERE id = ?", (location_id,))
        
        row = await cursor.fetchone()
        await cursor.close()
        
        if not row:
            return jsonify({'error': 'Location not found'}), 404
        
        return jsonify({'id': row[0], 'name': row[1], 'address': row[2]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/locations', methods=['POST'])
@require_admin
async def create_location():
    """Create a new location (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        address = data.get('address')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if location already exists
        await cursor.execute("SELECT id FROM locations WHERE name = ?", (name,))
        if await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Location already exists'}), 400
        
        await cursor.execute("INSERT INTO locations (name, address) VALUES (?, ?)", (name, address))
        location_id = cursor.lastrowid
        await db.commit()
        await cursor.close()
        
        location_data = {'id': location_id, 'name': name, 'address': address}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='location',
            action='create',
            entity_id=location_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=location_data,
            details=f"Standort {name} erstellt"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.LOCATION_CREATED, location_data)
        
        return jsonify(location_data), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/locations/<int:location_id>', methods=['PUT'])
@require_admin
async def update_location(location_id):
    """Update a location (admin only)"""
    try:
        data = await request.get_json()
        name = data.get('name')
        address = data.get('address')
        
        if not name:
            return jsonify({'error': 'name is required'}), 400
        
        db = get_db()
        cursor = await db.cursor()
        
        # Check if location exists
        await cursor.execute("SELECT id FROM locations WHERE id = ?", (location_id,))
        if not await cursor.fetchone():
            await cursor.close()
            return jsonify({'error': 'Location not found'}), 404
        
        await cursor.execute("UPDATE locations SET name = ?, address = ? WHERE id = ?", (name, address, location_id))
        await db.commit()
        await cursor.close()
        
        location_data = {'id': location_id, 'name': name, 'address': address}
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='location',
            action='update',
            entity_id=location_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_after=location_data,
            details=f"Standort {name} aktualisiert"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.LOCATION_UPDATED, location_data)
        
        return jsonify(location_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/locations/<int:location_id>', methods=['DELETE'])
@require_admin
async def delete_location(location_id):
    """Delete a location (admin only)"""
    try:
        db = get_db()
        cursor = await db.cursor()
        
        # Get location data before deletion for audit log
        await cursor.execute("SELECT name, address FROM locations WHERE id = ?", (location_id,))
        location_row = await cursor.fetchone()
        if not location_row:
            await cursor.close()
            return jsonify({'error': 'Location not found'}), 404
        
        location_snapshot = {'id': location_id, 'name': location_row[0], 'address': location_row[1]}
        
        # Check if location is in use by users
        await cursor.execute("SELECT COUNT(*) FROM users WHERE location_id = ?", (location_id,))
        user_count = (await cursor.fetchone())[0]
        
        # Check if location is in use by devices
        await cursor.execute("SELECT COUNT(*) FROM devices WHERE location_id = ?", (location_id,))
        device_count = (await cursor.fetchone())[0]
        
        total_count = user_count + device_count
        
        if total_count > 0:
            await cursor.close()
            return jsonify({'error': f'Cannot delete location: {user_count} users and {device_count} devices are assigned to it'}), 400
        
        await cursor.execute("DELETE FROM locations WHERE id = ?", (location_id,))
        await db.commit()
        await cursor.close()
        
        # Log audit trail
        current_user_info = get_current_user()
        await log_audit(
            entity_type='location',
            action='delete',
            entity_id=location_id,
            user_id=current_user_info.id if current_user_info else None,
            username=current_user_info.username if current_user_info else 'System',
            snapshot_before=location_snapshot,
            details=f"Standort {location_snapshot['name']} gelöscht"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.LOCATION_DELETED, {'id': location_id})
        
        return jsonify({'message': 'Location deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# GRABIT AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/login', methods=['POST'])
async def login():
    """Login endpoint - creates session and sets cookie"""
    try:
        data = await request.get_json()
        login_req = LoginRequest(**data)
        
        # Authenticate user
        db = get_db()
        user = await authenticate_user(login_req.username, login_req.password, db)
        
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Create session
        session_id = create_session(user)
        
        # Create response with session cookie
        response = jsonify({
            'user': user.model_dump(mode='json'),
            'session_id': session_id
        })
        
        # Set HTTP-only cookie
        response.set_cookie(
            'session_id',
            session_id,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            max_age=86400  # 24 hours
        )
        
        return response, 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.errors()}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/session', methods=['GET'])
async def check_session():
    """Check if current session is valid"""
    try:
        session_id = request.cookies.get('session_id')
        if not session_id:
            return jsonify({'authenticated': False}), 401
        
        session_data = get_session(session_id)
        if not session_data:
            return jsonify({'authenticated': False}), 401
        
        # Get user from session data
        user_data = session_data.get('user')
        if not user_data:
            return jsonify({'authenticated': False}), 401
        
        return jsonify({
            'authenticated': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({'authenticated': False, 'error': str(e)}), 401


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
async def logout():
    """Logout endpoint - destroys session"""
    try:
        session_id = request.cookies.get('session_id')
        if session_id:
            destroy_session(session_id)
        
        response = jsonify({'message': 'Logged out successfully'})
        response.set_cookie('session_id', '', expires=0)
        return response, 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/me', methods=['GET'])
@require_auth
async def get_current_user_info():
    """Get current user info from session"""
    try:
        user = get_current_user()
        session_id = request.cookies.get('session_id')
        session_info = get_session_info(session_id)
        
        # Load full user data with related entities (location, department, amt)
        db = get_db()
        full_user = await authenticate_user_by_id(user.id, db)
        
        return jsonify({
            'user': full_user.model_dump(mode='json') if full_user else user.model_dump(mode='json'),
            'session': {
                'session_id': session_info.session_id,
                'expires_at': session_info.expires_at.isoformat()
            } if session_info else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/check', methods=['GET'])
async def check_auth():
    """Check if user is authenticated (no @require_auth to avoid 401)"""
    try:
        user = get_current_user()
        if user:
            return jsonify({
                'authenticated': True,
                'user': user.model_dump(mode='json')
            }), 200
        else:
            return jsonify({'authenticated': False}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================

@app.before_serving
async def startup():
    """Initialize database and services before serving requests"""
    global device_service
    await init_db()
    device_service = DeviceService(get_db())
    print("✅ Database initialized")
    print("✅ Device service initialized")


@app.after_serving
async def shutdown():
    """Clean up resources after serving"""
    await close_db()
    print("✅ Database closed")


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    # Initialize sample data
    num_tasks = task_service.initialize_sample_data()

    print("=" * 70)
    print("🚀 Grabit Device Management System")
    print("=" * 70)
    print(f"📝 {num_tasks} sample tasks loaded")
    print()
    print("✨ Key Features:")
    print("   • Authentication & Role-Based Access Control")
    print("   • Device lending and tracking")
    print("   • Pydantic models for type safety and validation")
    print("   • Single process serving REST API + MCP JSON-RPC")
    print()
    print("🌐 Available Interfaces:")
    print("   REST API:     http://localhost:5001/api/*")
    print("   Auth:         http://localhost:5001/api/auth/*")
    print("   MCP JSON-RPC: http://localhost:5001/mcp")
    print()
    print("🔐 Default Credentials:")
    print("   Username: admin / Password: admin123")
    print("   Username: testuser / Password: test123")
    print()
    print("💡 Port 5001 (macOS AirPlay uses 5000)")
    print("=" * 70)

    app.run(debug=True, host="0.0.0.0", port=5001)

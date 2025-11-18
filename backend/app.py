"""
Quart Backend Application

This module demonstrates a simple Quart web application following principles from:
- Grokking Simplicity: Separating actions, calculations, and data
- A Philosophy of Software Design: Deep modules with clear interfaces

The app provides:
- RESTful API endpoints for task management (CRUD)
- Server-Sent Events (SSE) for real-time time updates
- Current date/time information
"""

from quart import Quart, jsonify, request
from quart_cors import cors
from datetime import datetime
import asyncio
from typing import Dict, List
import uuid
import json


# ============================================================================
# DATA LAYER - Pure data structures
# ============================================================================

tasks_db: Dict[str, dict] = {}


# ============================================================================
# CALCULATIONS - Pure functions with no I/O
# ============================================================================

def format_datetime(dt: datetime) -> str:
    """Format datetime to ISO 8601 string."""
    return dt.isoformat()


def create_task_data(title: str, description: str = "") -> dict:
    """Create a new task data structure."""
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "completed": False,
        "created_at": format_datetime(datetime.now())
    }


def update_task_data(task: dict, updates: dict) -> dict:
    """Create updated task data without mutating original."""
    return {**task, **updates}


def filter_completed_tasks(tasks: List[dict]) -> List[dict]:
    """Filter tasks to show only completed ones."""
    return [task for task in tasks if task.get("completed", False)]


def filter_pending_tasks(tasks: List[dict]) -> List[dict]:
    """Filter tasks to show only pending ones."""
    return [task for task in tasks if not task.get("completed", False)]


# ============================================================================
# ACTIONS - Functions with I/O side effects
# ============================================================================

def get_all_tasks() -> List[dict]:
    """Retrieve all tasks from the database."""
    return list(tasks_db.values())


def get_task_by_id(task_id: str) -> dict | None:
    """Retrieve a specific task by ID."""
    return tasks_db.get(task_id)


def save_task(task: dict) -> dict:
    """Save a task to the database."""
    tasks_db[task["id"]] = task
    return task


def delete_task(task_id: str) -> bool:
    """Delete a task from the database."""
    if task_id in tasks_db:
        del tasks_db[task_id]
        return True
    return False


# ============================================================================
# APPLICATION SETUP
# ============================================================================

app = Quart(__name__)
app = cors(app, allow_origin="*")


# ============================================================================
# ROUTE HANDLERS - API Endpoints
# ============================================================================

@app.route("/api/health", methods=["GET"])
async def health_check():
    """Health check endpoint to verify server is running."""
    return jsonify({
        "status": "healthy",
        "timestamp": format_datetime(datetime.now())
    })


@app.route("/api/date", methods=["GET"])
async def get_current_date():
    """Get the current date and time."""
    now = datetime.now()
    return jsonify({
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "datetime": format_datetime(now),
        "timestamp": now.timestamp()
    })


@app.route("/api/time-stream", methods=["GET"])
async def time_stream():
    """
    Server-Sent Events endpoint that streams current time every second.

    This demonstrates real-time server-to-client communication.
    """
    async def generate_time_events():
        """Generate time update events."""
        try:
            while True:
                now = datetime.now()
                time_data = {
                    "time": now.strftime("%H:%M:%S"),
                    "date": now.strftime("%Y-%m-%d"),
                    "timestamp": now.timestamp()
                }
                # SSE format: data: <json>\n\n
                yield f"data: {json.dumps(time_data)}\n\n"
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            # Client disconnected
            pass

    return generate_time_events(), {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no"
    }


@app.route("/api/tasks", methods=["GET"])
async def list_tasks():
    """Get all tasks, optionally filtered by status."""
    filter_param = request.args.get("filter", "all")

    all_tasks = get_all_tasks()

    if filter_param == "completed":
        tasks = filter_completed_tasks(all_tasks)
    elif filter_param == "pending":
        tasks = filter_pending_tasks(all_tasks)
    else:
        tasks = all_tasks

    return jsonify(tasks)


@app.route("/api/tasks", methods=["POST"])
async def create_task():
    """Create a new task."""
    data = await request.get_json()

    if not data or "title" not in data:
        return jsonify({"error": "Title is required"}), 400

    # Create new task using pure function
    new_task = create_task_data(
        title=data["title"],
        description=data.get("description", "")
    )

    # Save to database (action)
    saved_task = save_task(new_task)

    return jsonify(saved_task), 201


@app.route("/api/tasks/<task_id>", methods=["GET"])
async def get_task(task_id: str):
    """Get a specific task by ID."""
    task = get_task_by_id(task_id)

    if not task:
        return jsonify({"error": "Task not found"}), 404

    return jsonify(task)


@app.route("/api/tasks/<task_id>", methods=["PUT"])
async def update_task(task_id: str):
    """Update an existing task."""
    existing_task = get_task_by_id(task_id)

    if not existing_task:
        return jsonify({"error": "Task not found"}), 404

    data = await request.get_json()

    # Create updated task using pure function
    updated_task = update_task_data(existing_task, data)

    # Save to database (action)
    saved_task = save_task(updated_task)

    return jsonify(saved_task)


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
async def remove_task(task_id: str):
    """Delete a task."""
    success = delete_task(task_id)

    if not success:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"}), 200


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    # Add some sample data for demonstration
    sample_tasks = [
        create_task_data("Learn Quart", "Explore the Quart web framework"),
        create_task_data("Build React UI", "Create a modern UI with FluentUI"),
        create_task_data("Write tests", "Add Playwright E2E tests")
    ]

    for task in sample_tasks:
        save_task(task)

    print("🚀 Starting Quart server...")
    print("📝 Sample tasks loaded")
    print("🔗 API available at http://localhost:5001")
    print("💡 Note: Using port 5001 (port 5000 is used by macOS AirPlay)")

    app.run(debug=True, host="0.0.0.0", port=5001)

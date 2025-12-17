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

# Load environment variables from .env file
from dotenv import load_dotenv

load_dotenv()


# Import unified operation system

from mcp import handle_mcp_request
from ollama_service import ChatRequest
from operations import (op_create_task, op_delete_task, op_get_task,
                        op_get_task_stats, op_list_ollama_models,
                        op_list_tasks, op_ollama_chat, op_update_task,
                        task_service)

from api_decorators import operation
# FastMCP client for direct ticket MCP calls (no AI)
from fastmcp import Client as MCPClient

# Ticket MCP server URL (same as in agents.py)
TICKET_MCP_SERVER_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/mcp/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"
from mcp_handler import handle_mcp_request
from ollama_service import (ChatRequest, ChatResponse, ModelListResponse,
                            OllamaService)

from pydantic import ValidationError
from quart import Quart, jsonify, request, send_from_directory
from quart_cors import cors
# Import Pydantic models and service
from tasks import (Task, TaskCreate, TaskFilter, TaskService, TaskStats,
                   TaskUpdate)

# ============================================================================
# APPLICATION SETUP
# ============================================================================

app = Quart(__name__)
app = cors(app, allow_origin="*")

# Service instances live in operations.py so every interface shares them


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def format_datetime(dt: datetime) -> str:
    """Format datetime to ISO 8601 string."""
    return dt.isoformat()


# =========================================================================
# UNIFIED OPERATIONS
# Defined once in operations.py so REST, MCP, and agents share logic.
# =========================================================================


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
# TICKET MCP EXAMPLE - Direct FastMCP client usage (no AI)
# ============================================================================

async def _call_ticket_mcp_tool(tool_name: str, args: dict | None = None) -> list[dict]:
    """
    Helper: Call a tool on the Ticket MCP server and extract results.
    
    This demonstrates using FastMCP client programmatically without any AI.
    The connection is opened, tool is called, and connection is closed.
    
    Args:
        tool_name: Name of the MCP tool to call (e.g., "list_tickets")
        args: Optional dict of arguments for the tool
        
    Returns:
        List of parsed JSON results from the tool response
    """
    args = args or {}
    results = []
    
    async with MCPClient(TICKET_MCP_SERVER_URL) as client:
        response = await client.call_tool(tool_name, args)
        
        # Extract text content from MCP response
        if hasattr(response, 'content') and response.content:
            for content_item in response.content:
                # Only process TextContent items (use getattr for type safety)
                text = getattr(content_item, 'text', None)
                if text is not None and isinstance(text, str):
                    try:
                        # Parse JSON if possible
                        results.append(json.loads(text))
                    except json.JSONDecodeError:
                        results.append({"text": text})
    
    return results
    
    return results


@app.route("/api/tickets", methods=["GET"])
async def rest_list_tickets():
    """
    List tickets from external Ticket MCP server.
    
    Example of calling MCP tools directly via FastMCP client.
    No AI involved - just pure MCP protocol.
    
    Query params:
        - status: Filter by status (new, assigned, in_progress, etc.)
        - priority: Filter by priority (critical, high, medium, low)
        - search: Full-text search in summary/description
        - page: Page number (default: 1)
        - page_size: Results per page (default: 20)
    """
    try:
        # Build args from query params
        args = {}
        for param in ["status", "priority", "city", "service", "search"]:
            if val := request.args.get(param):
                args[param] = val
        for param in ["page", "page_size"]:
            if val := request.args.get(param):
                args[param] = int(val)
        
        results = await _call_ticket_mcp_tool("list_tickets", args)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tickets/<ticket_id>", methods=["GET"])
async def rest_get_ticket(ticket_id: str):
    """
    Get a single ticket by ID from the Ticket MCP server.
    
    Demonstrates calling MCP tool with path parameter.
    """
    try:
        results = await _call_ticket_mcp_tool("get_ticket", {"ticket_id": ticket_id})
        if not results:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(results[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tickets/stats", methods=["GET"])
async def rest_get_ticket_stats():
    """
    Get ticket statistics from the Ticket MCP server.
    
    Returns aggregated counts by status, priority, service, city.
    """
    try:
        args = {}
        if time_from := request.args.get("time_from"):
            args["time_from"] = time_from
        if time_to := request.args.get("time_to"):
            args["time_to"] = time_to
            
        results = await _call_ticket_mcp_tool("get_ticket_stats", args)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tickets/search", methods=["POST"])
async def rest_search_tickets():
    """
    Advanced ticket search with multiple filters.
    
    Body JSON:
        - query: Full-text search string
        - filters: {status: [...], priority: [...], city: [...], service: [...]}
        - limit: Max results
    """
    try:
        data = await request.get_json() or {}
        results = await _call_ticket_mcp_tool("search_tickets", data)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# QA TICKETS ENDPOINT
# ============================================================================

@app.route("/api/qa-tickets", methods=["GET"])
async def get_qa_tickets():
    """Get QA tickets that need escalation."""
    # Mock data - will be replaced with real database later
    tickets = [
        {
            "id": "INC-1001",
            "title": "Login page nicht erreichbar",
            "status": "Open",
            "priority": "High",
            "assignee": None,
            "createdAt": "2025-12-09T08:30:00Z",
            "updatedAt": "2025-12-09T08:30:00Z",
            "escalationNeeded": True,
            "description": "Benutzer können sich nicht anmelden. Die Login-Seite gibt einen 500-Fehler zurück. Betrifft alle Umgebungen.",
            "category": "QA",
            "reporter": "M. Schmidt",
        },
        {
            "id": "INC-1002",
            "title": "Performance-Problem im Dashboard",
            "status": "Open",
            "priority": "Medium",
            "assignee": None,
            "createdAt": "2025-12-09T10:15:00Z",
            "updatedAt": "2025-12-09T10:15:00Z",
            "escalationNeeded": True,
            "description": "Dashboard lädt sehr langsam (>10 Sekunden). API-Aufrufe scheinen blockiert zu sein.",
            "category": "QA",
            "reporter": "A. Müller",
        },
        {
            "id": "INC-1003",
            "title": "Datenverlust beim Speichern",
            "status": "Open",
            "priority": "Critical",
            "assignee": None,
            "createdAt": "2025-12-09T14:45:00Z",
            "updatedAt": "2025-12-09T14:45:00Z",
            "escalationNeeded": True,
            "description": "Formulardaten werden nicht gespeichert. Validierung schlägt fehl ohne Fehlermeldung.",
            "category": "QA",
            "reporter": "T. Weber",
        },
        {
            "id": "INC-1004",
            "title": "Export-Funktion fehlerhaft",
            "status": "Open",
            "priority": "Low",
            "assignee": None,
            "createdAt": "2025-12-10T09:00:00Z",
            "updatedAt": "2025-12-10T09:00:00Z",
            "escalationNeeded": True,
            "description": "CSV-Export generiert leere Dateien. Excel-Export funktioniert korrekt.",
            "category": "QA",
            "reporter": "L. Fischer",
        },
        {
            "id": "INC-1005",
            "title": "Notification-Service offline",
            "status": "Open",
            "priority": "High",
            "assignee": None,
            "createdAt": "2025-12-10T11:30:00Z",
            "updatedAt": "2025-12-10T11:30:00Z",
            "escalationNeeded": True,
            "description": "E-Mail-Benachrichtigungen werden nicht versendet. Queue läuft voll.",
            "category": "QA",
            "reporter": "K. Becker",
        },
    ]
    return jsonify({"tickets": tickets})


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
    """MCP JSON-RPC 2.0 endpoint - delegates to mcp.py handler."""
    return await handle_mcp_request()


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

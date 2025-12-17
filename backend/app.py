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

# Agent service for Azure OpenAI LangGraph agents
from agents import AgentRequest, AgentResponse, agent_service
from api_decorators import operation

# FastMCP client for direct ticket MCP calls (no AI)
from fastmcp import Client as MCPClient
from mcp_handler import handle_mcp_request
from operations import (
    op_create_task,
    op_delete_task,
    op_get_task,
    op_get_task_stats,
    op_list_tasks,
    op_update_task,
    task_service,
)

# Reminder logic
from reminder import (
    ReminderCandidate,
    ReminderRequest,
    ReminderResult,
    build_reminder_candidate,
    is_assigned_without_assignee,
)
from tickets import Ticket, WorkLog

# Ticket MCP server URL (same as in agents.py)
TICKET_MCP_SERVER_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/mcp/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"

from pydantic import ValidationError
from quart import Quart, jsonify, request, send_from_directory
from quart_cors import cors

# Import Pydantic models and service
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate

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


# ============================================================================
# AGENT ENDPOINT - Azure OpenAI LangGraph Agent
# ============================================================================

@app.route("/api/agents/run", methods=["POST"])
async def rest_run_agent():
    """REST wrapper: run AI agent with Azure OpenAI.
    
    The agent has access to task tools and ticket MCP tools.
    """
    try:
        data = await request.get_json()
        agent_request = AgentRequest(**data)
        response = await agent_service.run_agent(agent_request)
        return jsonify(response.model_dump()), 200
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
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


def _map_mcp_ticket_to_frontend(mcp_ticket: dict) -> dict:
    """
    Pure function: Map MCP ticket schema to frontend expected format.
    
    MCP fields -> Frontend fields:
      - summary -> title
      - requester_name -> reporter
      - created_at -> createdAt (camelCase)
      - updated_at -> updatedAt
      - priority (lowercase) -> Priority (capitalized)
      - status (lowercase) -> status (capitalized)
    """
    priority_raw = mcp_ticket.get("priority", "medium")
    priority = priority_raw.capitalize() if priority_raw else "Medium"
    
    status_raw = mcp_ticket.get("status", "new")
    status = status_raw.replace("_", " ").title() if status_raw else "New"
    
    # Derive escalationNeeded from priority
    escalation_needed = priority in ("Critical", "High")
    
    return {
        "id": str(mcp_ticket.get("id", "")),
        "title": mcp_ticket.get("summary", ""),
        "description": mcp_ticket.get("description", ""),
        "status": status,
        "priority": priority,
        "assignee": mcp_ticket.get("assignee"),
        "reporter": mcp_ticket.get("requester_name", ""),
        "createdAt": mcp_ticket.get("created_at", ""),
        "updatedAt": mcp_ticket.get("updated_at", ""),
        "escalationNeeded": escalation_needed,
    }


def _is_unassigned_ticket(ticket: dict) -> bool:
    """Pure function: Check if ticket is assigned to group but has no individual assignee."""
    has_group = ticket.get("assigned_group") is not None
    no_assignee = ticket.get("assignee") is None
    status = ticket.get("status", "")
    is_open_status = status in ("new", "assigned")
    return has_group and no_assignee and is_open_status


@app.route("/api/qa-tickets", methods=["GET"])
async def get_qa_tickets():
    """
    Get QA tickets that need escalation.
    
    Calls the external Ticket MCP server and maps results to frontend format.
    Filters for unassigned tickets (assigned to group but no individual assignee).
    """
    try:
        # Call MCP server to get all tickets
        results = await _call_ticket_mcp_tool("list_tickets", {})
        
        # Extract tickets from MCP response
        mcp_tickets = []
        if results and len(results) > 0:
            response_data = results[0]
            if isinstance(response_data, dict) and "tickets" in response_data:
                mcp_tickets = response_data["tickets"]
            elif isinstance(response_data, list):
                mcp_tickets = response_data
        
        # Filter for unassigned tickets and map to frontend format
        frontend_tickets = [
            _map_mcp_ticket_to_frontend(ticket)
            for ticket in mcp_tickets
            if _is_unassigned_ticket(ticket)
        ]
        
        return jsonify({"tickets": frontend_tickets})
    except Exception as e:
        return jsonify({"error": str(e), "tickets": []}), 500


# ============================================================================
# REMINDER ENDPOINTS - Ticket reminder functionality
# ============================================================================

def _parse_mcp_ticket_to_model(mcp_ticket: dict) -> Ticket:
    """Pure function: Parse MCP ticket dict to Pydantic Ticket model."""
    from datetime import timezone

    # Parse timestamps - ensure timezone-aware
    created_at = mcp_ticket.get("created_at", "")
    updated_at = mcp_ticket.get("updated_at", "")
    
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    
    # Ensure timezone-aware
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    
    return Ticket(
        id=mcp_ticket.get("id"),
        summary=mcp_ticket.get("summary", ""),
        description=mcp_ticket.get("description", ""),
        status=mcp_ticket.get("status", "new"),
        priority=mcp_ticket.get("priority", "medium"),
        assignee=mcp_ticket.get("assignee"),
        assigned_group=mcp_ticket.get("assigned_group"),
        requester_name=mcp_ticket.get("requester_name", "Unknown"),
        requester_email=mcp_ticket.get("requester_email", "unknown@example.com"),
        city=mcp_ticket.get("city"),
        service=mcp_ticket.get("service"),
        created_at=created_at,
        updated_at=updated_at,
    )


def _parse_mcp_worklog_to_model(mcp_log: dict, ticket_id: str) -> WorkLog:
    """Pure function: Parse MCP worklog dict to Pydantic WorkLog model."""
    from uuid import uuid4
    
    created_at = mcp_log.get("created_at", "")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    
    return WorkLog(
        id=mcp_log.get("id", uuid4()),
        ticket_id=ticket_id,
        created_at=created_at,
        log_type=mcp_log.get("log_type", "note"),
        summary=mcp_log.get("summary", ""),
        details=mcp_log.get("details"),
        author=mcp_log.get("author", "Unknown"),
        time_spent_minutes=mcp_log.get("time_spent_minutes", 0),
    )


@app.route("/api/reminder/candidates", methods=["GET"])
async def rest_get_reminder_candidates():
    """
    Get tickets that need reminders (Assigned without Assignee + overdue).
    
    Filters tickets based on SLA rules:
    - Critical: overdue after 30 min
    - High: overdue after 2 hours
    - Medium: overdue after 4 hours
    - Low: overdue after 8 hours
    
    Query params:
        - include_all: If "true", include non-overdue tickets too
    """
    try:
        include_all = request.args.get("include_all", "false").lower() == "true"
        
        # Fetch all tickets from MCP
        results = await _call_ticket_mcp_tool("list_tickets", {"page_size": 100})
        
        mcp_tickets = []
        if results and len(results) > 0:
            response_data = results[0]
            if isinstance(response_data, dict) and "tickets" in response_data:
                mcp_tickets = response_data["tickets"]
            elif isinstance(response_data, list):
                mcp_tickets = response_data
        
        candidates = []
        now = datetime.now(tz=__import__('datetime').timezone.utc)
        
        for mcp_ticket in mcp_tickets:
            # Check if ticket is "assigned without assignee"
            if not _is_unassigned_ticket(mcp_ticket):
                continue
            
            # Parse to Pydantic model
            try:
                ticket = _parse_mcp_ticket_to_model(mcp_ticket)
            except Exception:
                continue  # Skip malformed tickets
            
            # Build reminder candidate (worklogs empty for now - can enhance later)
            candidate = build_reminder_candidate(ticket, work_logs=[], now=now)
            
            # Filter by overdue status unless include_all
            if include_all or candidate.is_overdue:
                candidates.append(candidate)
        
        # Sort by most overdue first
        candidates.sort(key=lambda c: c.minutes_since_creation - c.sla_deadline_minutes, reverse=True)
        
        return jsonify({
            "candidates": [c.model_dump() for c in candidates],
            "total": len(candidates),
            "overdue_count": sum(1 for c in candidates if c.is_overdue),
        })
    except Exception as e:
        return jsonify({"error": str(e), "candidates": []}), 500


@app.route("/api/reminder/send", methods=["POST"])
async def rest_send_reminders():
    """
    Send reminders for selected tickets.
    
    Body JSON:
        - ticket_ids: List of ticket UUIDs to remind
        - reminded_by: Who is sending the reminders
        - message: Optional custom message (markdown supported)
    
    Returns:
        - successful: List of ticket IDs reminded
        - failed: List of ticket IDs that failed
        - errors: Dict of ticket_id -> error message
    """
    try:
        data = await request.get_json()
        reminder_request = ReminderRequest(**data)
        
        # For now, simulate sending reminders (actual email integration later)
        # In real implementation, this would:
        # 1. Look up Support Group Lead for each ticket's assigned_group
        # 2. Send email via Remedy email system or SMTP
        # 3. Add worklog entry of type "reminder" to ticket
        
        successful = []
        failed = []
        errors = {}
        
        for ticket_id in reminder_request.ticket_ids:
            try:
                # Verify ticket exists
                ticket_results = await _call_ticket_mcp_tool("get_ticket", {"ticket_id": str(ticket_id)})
                
                if not ticket_results:
                    failed.append(ticket_id)
                    errors[str(ticket_id)] = "Ticket not found"
                    continue
                
                # TODO: Actually send reminder email here
                # TODO: Add worklog entry via MCP add_modification or similar
                
                successful.append(ticket_id)
                
            except Exception as e:
                failed.append(ticket_id)
                errors[str(ticket_id)] = str(e)
        
        result = ReminderResult(
            successful=successful,
            failed=failed,
            errors=errors,
        )
        
        return jsonify(result.model_dump())
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
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
    print("   REST API:     http://localhost:5001/api/*")
    print("   MCP JSON-RPC: http://localhost:5001/mcp")
    print()
    print("💡 Port 5001 (macOS AirPlay uses 5000)")
    print("=" * 70)

    app.run(debug=True, host="0.0.0.0", port=5001)

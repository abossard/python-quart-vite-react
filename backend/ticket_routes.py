"""
Ticket and Reminder Routes

Blueprint for all ticket-related endpoints:
- Ticket CRUD via external MCP server
- QA tickets (unassigned)
- Reminder candidates and sending

Extracted from app.py for better separation of concerns.
"""

import json
from datetime import datetime, timezone
from uuid import UUID

from fastmcp import Client as MCPClient
from pydantic import ValidationError
from quart import Blueprint, jsonify, request
from reminder import ReminderRequest, ReminderResult, build_reminder_candidate
from reminder_outbox import (
    get_entries_for_ticket,
    get_outbox_entries,
    save_sent_reminder,
)
from tickets import Ticket, WorkLog

# ============================================================================
# BLUEPRINT SETUP
# ============================================================================

ticket_bp = Blueprint("tickets", __name__)

# Ticket MCP server URL
TICKET_MCP_SERVER_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/mcp/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"


# ============================================================================
# MCP CLIENT HELPER
# ============================================================================

async def call_ticket_mcp_tool(tool_name: str, args: dict | None = None) -> list[dict]:
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


# ============================================================================
# PURE FUNCTIONS - Calculations and Mappings
# ============================================================================

def map_mcp_ticket_to_frontend(mcp_ticket: dict) -> dict:
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


def is_unassigned_ticket(ticket: dict) -> bool:
    """Pure function: Check if ticket is assigned to group but has no individual assignee."""
    has_group = ticket.get("assigned_group") is not None
    no_assignee = ticket.get("assignee") is None
    status = ticket.get("status", "")
    is_open_status = status in ("new", "assigned")
    return has_group and no_assignee and is_open_status


def parse_mcp_ticket_to_model(mcp_ticket: dict) -> Ticket:
    """Pure function: Parse MCP ticket dict to Pydantic Ticket model."""
    # Parse ID as UUID (required field)
    raw_id = mcp_ticket.get("id")
    if raw_id is None:
        raise ValueError("Ticket missing required 'id' field")
    ticket_id = UUID(raw_id) if isinstance(raw_id, str) else raw_id

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
        id=ticket_id,
        summary=mcp_ticket.get("summary", ""),
        description=mcp_ticket.get("description", ""),
        status=mcp_ticket.get("status", "new"),
        priority=mcp_ticket.get("priority", "medium"),
        impact=mcp_ticket.get("impact"),
        urgency=mcp_ticket.get("urgency"),
        assignee=mcp_ticket.get("assignee"),
        assigned_group=mcp_ticket.get("assigned_group"),
        support_organization=mcp_ticket.get("support_organization"),
        requester_name=mcp_ticket.get("requester_name", "Unknown"),
        requester_email=mcp_ticket.get("requester_email", "unknown@example.com"),
        requester_phone=mcp_ticket.get("requester_phone"),
        requester_company=mcp_ticket.get("requester_company"),
        requester_department=mcp_ticket.get("requester_department"),
        city=mcp_ticket.get("city"),
        country=mcp_ticket.get("country"),
        site=mcp_ticket.get("site"),
        desk_location=mcp_ticket.get("desk_location"),
        service=mcp_ticket.get("service"),
        incident_type=mcp_ticket.get("incident_type"),
        reported_source=mcp_ticket.get("reported_source"),
        product_name=mcp_ticket.get("product_name"),
        manufacturer=mcp_ticket.get("manufacturer"),
        model_version=mcp_ticket.get("model_version"),
        ci_name=mcp_ticket.get("ci_name"),
        operational_category_tier1=mcp_ticket.get("operational_category_tier1"),
        operational_category_tier2=mcp_ticket.get("operational_category_tier2"),
        operational_category_tier3=mcp_ticket.get("operational_category_tier3"),
        product_category_tier1=mcp_ticket.get("product_category_tier1"),
        product_category_tier2=mcp_ticket.get("product_category_tier2"),
        product_category_tier3=mcp_ticket.get("product_category_tier3"),
        resolution=mcp_ticket.get("resolution"),
        notes=mcp_ticket.get("notes"),
        event_id=mcp_ticket.get("event_id"),
        correlation_key=mcp_ticket.get("correlation_key"),
        created_at=created_at,
        updated_at=updated_at,
    )


def parse_mcp_worklog_to_model(mcp_log: dict, ticket_id: str) -> WorkLog:
    """Pure function: Parse MCP worklog dict to Pydantic WorkLog model."""
    from uuid import uuid4

    # Parse IDs as UUIDs
    log_id = mcp_log.get("id", uuid4())
    if isinstance(log_id, str):
        log_id = UUID(log_id)
    parsed_ticket_id = UUID(ticket_id) if isinstance(ticket_id, str) else ticket_id
    
    created_at = mcp_log.get("created_at", "")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    
    return WorkLog(
        id=log_id,
        ticket_id=parsed_ticket_id,
        created_at=created_at,
        log_type=mcp_log.get("log_type", "note"),
        summary=mcp_log.get("summary", ""),
        details=mcp_log.get("details"),
        author=mcp_log.get("author", "Unknown"),
        time_spent_minutes=mcp_log.get("time_spent_minutes", 0),
    )


def extract_tickets_from_mcp_response(results: list[dict]) -> list[dict]:
    """Pure function: Extract ticket list from MCP response structure."""
    mcp_tickets = []
    if results and len(results) > 0:
        response_data = results[0]
        if isinstance(response_data, dict) and "tickets" in response_data:
            mcp_tickets = response_data["tickets"]
        elif isinstance(response_data, list):
            mcp_tickets = response_data
    return mcp_tickets


# ============================================================================
# TICKET ROUTES
# ============================================================================

@ticket_bp.route("/api/tickets", methods=["GET"])
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
        
        results = await call_ticket_mcp_tool("list_tickets", args)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ticket_bp.route("/api/tickets/<ticket_id>", methods=["GET"])
async def rest_get_ticket(ticket_id: str):
    """
    Get a single ticket by ID from the Ticket MCP server.
    
    Demonstrates calling MCP tool with path parameter.
    """
    try:
        results = await call_ticket_mcp_tool("get_ticket", {"ticket_id": ticket_id})
        if not results:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(results[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ticket_bp.route("/api/tickets/stats", methods=["GET"])
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
            
        results = await call_ticket_mcp_tool("get_ticket_stats", args)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ticket_bp.route("/api/tickets/search", methods=["POST"])
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
        results = await call_ticket_mcp_tool("search_tickets", data)
        return jsonify(results[0] if len(results) == 1 else results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# QA TICKETS ENDPOINT
# ============================================================================

@ticket_bp.route("/api/qa-tickets", methods=["GET"])
async def get_qa_tickets():
    """
    Get QA tickets that need escalation.
    
    Calls the external Ticket MCP server and maps results to frontend format.
    Filters for unassigned tickets (assigned to group but no individual assignee).
    """
    try:
        # Call MCP server to get all tickets
        results = await call_ticket_mcp_tool("list_tickets", {})
        
        # Extract tickets from MCP response
        mcp_tickets = extract_tickets_from_mcp_response(results)
        
        # Filter for unassigned tickets and map to frontend format
        frontend_tickets = [
            map_mcp_ticket_to_frontend(ticket)
            for ticket in mcp_tickets
            if is_unassigned_ticket(ticket)
        ]
        
        return jsonify({"tickets": frontend_tickets})
    except Exception as e:
        return jsonify({"error": str(e), "tickets": []}), 500


# ============================================================================
# REMINDER ENDPOINTS
# ============================================================================

@ticket_bp.route("/api/reminder/candidates", methods=["GET"])
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
        results = await call_ticket_mcp_tool("list_tickets", {"page_size": 100})
        
        mcp_tickets = extract_tickets_from_mcp_response(results)
        
        candidates = []
        now = datetime.now(tz=timezone.utc)
        
        for mcp_ticket in mcp_tickets:
            # Check if ticket is "assigned without assignee"
            if not is_unassigned_ticket(mcp_ticket):
                continue
            
            # Parse to Pydantic model
            try:
                ticket = parse_mcp_ticket_to_model(mcp_ticket)
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


@ticket_bp.route("/api/reminder/send", methods=["POST"])
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
        
        successful = []
        failed = []
        errors = {}
        
        for ticket_id in reminder_request.ticket_ids:
            try:
                # Verify ticket exists and get details
                ticket_results = await call_ticket_mcp_tool("get_ticket", {"ticket_id": str(ticket_id)})
                
                if not ticket_results:
                    failed.append(ticket_id)
                    errors[str(ticket_id)] = "Ticket not found"
                    continue
                
                ticket_data = ticket_results[0] if ticket_results else {}
                assigned_group = ticket_data.get("assigned_group", "Unknown Group")
                
                # Build reminder message
                reminder_message = reminder_request.message or f"Reminder: Ticket still unassigned in group '{assigned_group}'"
                
                # Save to outbox FIRST (audit trail even if MCP fails)
                recipient = f"{assigned_group}@company.com"  # TODO: lookup actual group lead email
                save_sent_reminder(
                    ticket_id=ticket_id,
                    recipient=recipient,
                    markdown_content=reminder_message,
                )
                
                # Add worklog entry via MCP (non-blocking failure)
                try:
                    await call_ticket_mcp_tool("add_work_log", {
                        "ticket_id": str(ticket_id),
                        "log_type": "reminder",
                        "summary": f"SLA reminder sent: {reminder_message}",
                        "details": f"Ticket unassigned in group '{assigned_group}'. Reminder sent by {reminder_request.reminded_by}.",
                        "author": reminder_request.reminded_by,
                    })
                except Exception:
                    pass  # MCP failure shouldn't block reminder
                
                # TODO: Actually send reminder email here (SMTP integration)
                
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
# REMINDER OUTBOX ENDPOINTS
# ============================================================================


@ticket_bp.route("/api/reminder/outbox", methods=["GET"])
async def rest_get_outbox_entries():
    """
    Get recent sent reminders from the outbox.
    
    Query params:
        - limit: Maximum entries to return (default: 50)
    
    Returns:
        - entries: List of OutboxEntry objects
        - total: Number of entries returned
    """
    try:
        limit = int(request.args.get("limit", 50))
        entries = get_outbox_entries(limit=limit)
        
        return jsonify({
            "entries": [e.model_dump() for e in entries],
            "total": len(entries),
        })
    except Exception as e:
        return jsonify({"error": str(e), "entries": []}), 500


@ticket_bp.route("/api/reminder/outbox/<ticket_id>", methods=["GET"])
async def rest_get_outbox_for_ticket(ticket_id: str):
    """
    Get all sent reminders for a specific ticket.
    
    Returns:
        - entries: List of OutboxEntry objects for this ticket
        - total: Number of entries
    """
    try:
        from uuid import UUID
        
        parsed_id = UUID(ticket_id)
        entries = get_entries_for_ticket(parsed_id)
        
        return jsonify({
            "entries": [e.model_dump() for e in entries],
            "total": len(entries),
        })
    except ValueError:
        return jsonify({"error": "Invalid ticket ID format"}), 400
    except Exception as e:
        return jsonify({"error": str(e), "entries": []}), 500

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
from uuid import UUID

# Load environment variables from .env file
from dotenv import load_dotenv

load_dotenv()


# Import unified operation system

# Agent Fabric
from agent_workbench import (
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentRunCreate,
    CriteriaType,
    RunStatus,
)

# Agent service for OpenAI LangGraph agents
from agents import AgentRequest, AgentResponse, agent_service
from api_decorators import get_operation, operation

# CSV ticket service
from csv_data import Ticket, get_csv_ticket_service

# KBA Drafter
from kba_exceptions import (
    DraftNotFoundError,
    DuplicateKBADraftError,
    InvalidLLMOutputError,
    InvalidStatusError,
    PublishFailedError,
    TicketNotFoundError,
)
from kba_models import (
    KBADraft,
    KBADraftCreate,
    KBADraftFilter,
    KBADraftUpdate,
    KBAPublishRequest,
)
from kba_exceptions import (
    LLMTimeoutError,
    LLMUnavailableError,
    LLMRateLimitError,
    LLMAuthenticationError,
)

# FastMCP client for direct ticket MCP calls (no AI)
from fastmcp import Client as MCPClient
from mcp_handler import handle_mcp_request
from operations import (
    CSV_TICKET_FIELDS,
    op_create_task,
    op_delete_task,
    op_get_task,
    op_get_task_stats,
    op_list_tasks,
    op_update_task,
    task_service,
)
from usecase_demo import UsecaseDemoRunCreate, usecase_demo_run_service
from workbench_integration import _tool_registry, workbench_service

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


# ============================================================================
# ERROR HANDLERS - KBA Drafter Custom Exceptions
# ============================================================================

@app.errorhandler(TicketNotFoundError)
async def handle_ticket_not_found(error: TicketNotFoundError):
    """Handle ticket not found errors."""
    return jsonify({"error": str(error), "type": "ticket_not_found"}), 404


@app.errorhandler(DraftNotFoundError)
async def handle_draft_not_found(error: DraftNotFoundError):
    """Handle draft not found errors."""
    return jsonify({"error": str(error), "type": "draft_not_found"}), 404


@app.errorhandler(LLMUnavailableError)
async def handle_llm_unavailable(error: LLMUnavailableError):
    """Handle LLM service unavailable errors."""
    return jsonify({
        "error": str(error),
        "type": "llm_unavailable",
        "suggestion": "Check OPENAI_API_KEY configuration and OpenAI API status"
    }), 503


@app.errorhandler(LLMTimeoutError)
async def handle_llm_timeout(error: LLMTimeoutError):
    """Handle LLM timeout errors."""
    return jsonify({
        "error": str(error),
        "type": "llm_timeout"
    }), 504


@app.errorhandler(LLMRateLimitError)
async def handle_llm_rate_limit(error: LLMRateLimitError):
    """Handle LLM rate limit errors."""
    return jsonify({
        "error": str(error),
        "type": "llm_rate_limit",
        "suggestion": "Wait and retry, or check OpenAI account limits"
    }), 429


@app.errorhandler(LLMAuthenticationError)
async def handle_llm_authentication(error: LLMAuthenticationError):
    """Handle LLM authentication errors."""
    return jsonify({
        "error": str(error),
        "type": "llm_authentication",
        "suggestion": "Check OPENAI_API_KEY in .env file"
    }), 401


@app.errorhandler(InvalidLLMOutputError)
async def handle_invalid_llm_output(error: InvalidLLMOutputError):
    """Handle invalid LLM output errors."""
    return jsonify({
        "error": str(error),
        "type": "invalid_llm_output"
    }), 500


@app.errorhandler(PublishFailedError)
async def handle_publish_failed(error: PublishFailedError):
    """Handle publishing failure errors."""
    return jsonify({
        "error": str(error),
        "type": "publish_failed"
    }), 500


@app.errorhandler(InvalidStatusError)
async def handle_invalid_status(error: InvalidStatusError):
    """Handle invalid status errors."""
    return jsonify({
        "error": str(error),
        "type": "invalid_status"
    }), 409


@app.errorhandler(DuplicateKBADraftError)
async def handle_duplicate_kba_draft(error: DuplicateKBADraftError):
    """Handle duplicate KBA draft errors."""
    return jsonify({
        "error": str(error),
        "type": "duplicate_kba_draft",
        "existing_drafts": error.existing_drafts
    }), 409


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
# AGENT ENDPOINT - OpenAI LangGraph Agent
# ============================================================================

@app.route("/api/agents/run", methods=["POST"])
async def rest_run_agent():
    """REST wrapper: run AI agent with OpenAI.
    
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
# AGENT FABRIC ENDPOINTS
# ============================================================================

_WORKBENCH_UI_OPERATION_NAMES = [
    "workbench_list_tools",
    "workbench_list_agents",
    "workbench_create_agent",
    "workbench_get_agent",
    "workbench_update_agent",
    "workbench_delete_agent",
    "workbench_run_agent",
    "workbench_list_agent_runs",
    "workbench_list_runs",
    "workbench_get_run",
    "workbench_evaluate_run",
    "workbench_get_evaluation",
]


@app.route("/api/workbench/ui-config", methods=["GET"])
async def workbench_ui_config():
    """Expose UI-friendly endpoint metadata and enums for Agent Fabric."""
    endpoints: list[dict] = []
    for op_name in _WORKBENCH_UI_OPERATION_NAMES:
        op = get_operation(op_name)
        if op is None:
            continue
        endpoints.append({
            "name": op.name,
            "method": op.http_method,
            "path": op.http_path,
            "description": op.description,
            "input_schema": op.get_mcp_input_schema(),
        })

    return jsonify({
        "module": "agent_fabric",
        "version": "1",
        "criteria_types": [criteria.value for criteria in CriteriaType],
        "run_statuses": [status.value for status in RunStatus],
        "defaults": {
            "run_list_limit": 50,
            "max_run_list_limit": 500,
        },
        "endpoints": endpoints,
    })


@app.route("/api/workbench/tools", methods=["GET"])
async def workbench_list_tools():
    """List all tools available for use in agent definitions."""
    return jsonify({"tools": workbench_service.list_tools()})


@app.route("/api/workbench/agents", methods=["GET"])
async def workbench_list_agents():
    """List all agent definitions."""
    agents = workbench_service.list_agents()
    return jsonify({"agents": [a.to_dict() for a in agents]})


@app.route("/api/workbench/agents", methods=["POST"])
async def workbench_create_agent():
    """Create a new agent definition."""
    try:
        data = await request.get_json()
        agent_def = workbench_service.create_agent(AgentDefinitionCreate(**data))
        return jsonify(agent_def.to_dict()), 201
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/workbench/agents/<agent_id>", methods=["GET"])
async def workbench_get_agent(agent_id: str):
    """Get a single agent definition."""
    agent_def = workbench_service.get_agent(agent_id)
    if agent_def is None:
        return jsonify({"error": "Agent not found"}), 404
    return jsonify(agent_def.to_dict())


@app.route("/api/workbench/agents/<agent_id>", methods=["PUT"])
async def workbench_update_agent(agent_id: str):
    """Update an agent definition."""
    try:
        data = await request.get_json()
        agent_def = workbench_service.update_agent(agent_id, AgentDefinitionUpdate(**data))
        if agent_def is None:
            return jsonify({"error": "Agent not found"}), 404
        return jsonify(agent_def.to_dict())
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/workbench/agents/<agent_id>", methods=["DELETE"])
async def workbench_delete_agent(agent_id: str):
    """Delete an agent definition."""
    if not workbench_service.delete_agent(agent_id):
        return jsonify({"error": "Agent not found"}), 404
    return jsonify({"message": "Deleted"}), 200


@app.route("/api/workbench/agents/<agent_id>/runs", methods=["POST"])
async def workbench_run_agent(agent_id: str):
    """Run an agent against a prompt and return the completed AgentRun."""
    try:
        data = await request.get_json()
        run = await workbench_service.run_agent(agent_id, AgentRunCreate(**data))
        return jsonify(run.to_dict()), 200
    except ValueError as exc:
        message = str(exc)
        status = 404 if "not found" in message.lower() else 400
        return jsonify({"error": message}), status
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/workbench/agents/<agent_id>/runs", methods=["GET"])
async def workbench_list_agent_runs(agent_id: str):
    """List all runs for an agent."""
    limit = request.args.get("limit", 50, type=int)
    runs = workbench_service.list_runs(agent_id=agent_id, limit=limit)
    return jsonify({"runs": [r.to_dict() for r in runs]})


@app.route("/api/workbench/runs", methods=["GET"])
async def workbench_list_all_runs():
    """List all runs across all agents."""
    limit = request.args.get("limit", 50, type=int)
    runs = workbench_service.list_runs(limit=limit)
    return jsonify({"runs": [r.to_dict() for r in runs]})


@app.route("/api/workbench/runs/<run_id>", methods=["GET"])
async def workbench_get_run(run_id: str):
    """Get a single run."""
    run = workbench_service.get_run(run_id)
    if run is None:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(run.to_dict())


@app.route("/api/workbench/runs/<run_id>/evaluate", methods=["POST"])
async def workbench_evaluate_run(run_id: str):
    """Evaluate a completed run against its agent's success criteria."""
    try:
        evaluation = await workbench_service.evaluate_run(run_id)
        return jsonify(evaluation.to_dict()), 200
    except ValueError as exc:
        message = str(exc)
        status = 404 if "not found" in message.lower() else 400
        return jsonify({"error": message}), status
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/workbench/runs/<run_id>/evaluation", methods=["GET"])
async def workbench_get_evaluation(run_id: str):
    """Get the evaluation result for a run (if it exists)."""
    evaluation = workbench_service.get_evaluation(run_id)
    if evaluation is None:
        return jsonify({"error": "No evaluation found for this run"}), 404
    return jsonify(evaluation.to_dict())


# ============================================================================
# USECASE DEMO AGENT RUN ENDPOINTS
# ============================================================================

@app.route("/api/usecase-demo/agent-runs", methods=["POST"])
async def create_usecase_demo_agent_run():
    """Queue a background agent run using the provided prompt."""
    try:
        data = await request.get_json() or {}
        payload = UsecaseDemoRunCreate(**data)
        run = await usecase_demo_run_service.create_run(payload)
        return jsonify(run.model_dump(mode="json")), 202
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/usecase-demo/agent-runs", methods=["GET"])
async def list_usecase_demo_agent_runs():
    """List recent background agent runs."""
    try:
        limit = request.args.get("limit", default=20, type=int)
        runs = await usecase_demo_run_service.list_runs(limit=limit or 20)
        return jsonify({"runs": [run.model_dump(mode="json") for run in runs]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/usecase-demo/agent-runs/<run_id>", methods=["GET"])
async def get_usecase_demo_agent_run(run_id: str):
    """Fetch one background run by ID."""
    try:
        run = await usecase_demo_run_service.get_run(run_id)
        if run is None:
            return jsonify({"error": "Run not found"}), 404
        return jsonify(run.model_dump(mode="json")), 200
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
        "incident_id": mcp_ticket.get("incident_id"),
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
# NON-TASK ENDPOINTS
# ============================================================================

# ============================================================================
# CSV TICKET ENDPOINTS
# ============================================================================

# Initialize CSV ticket service
_csv_ticket_service = get_csv_ticket_service()

# Load CSV data on startup (using relative path from backend folder)
_csv_data_path = Path(__file__).parent.parent / "CSV" / "data.csv"
if _csv_data_path.exists():
    _csv_loaded = _csv_ticket_service.load_csv(_csv_data_path)
    print(f"📊 Loaded {_csv_loaded} tickets from CSV")


@app.route("/api/csv-tickets/fields", methods=["GET"])
async def get_csv_ticket_fields():
    """Get metadata about available CSV ticket fields."""
    return jsonify({
        "fields": CSV_TICKET_FIELDS,
        "total_tickets": _csv_ticket_service.total_count,
    })


@app.route("/api/csv-tickets", methods=["GET"])
async def get_csv_tickets():
    """
    Get CSV tickets with optional filtering, sorting, and field selection.
    
    Query params:
    - fields: comma-separated list of field names to include
    - status: filter by status (new, assigned, in_progress, pending, resolved, closed)
    - has_assignee: filter by assignee presence (true/false)
    - assigned_group: filter by group name
    - sort: field name to sort by
    - sort_dir: asc or desc (default: asc)
    - limit: max number of results
    - offset: number of results to skip
    """
    from tickets import TicketStatus

    # Parse query params
    fields_param = request.args.get("fields", "")
    status_param = request.args.get("status")
    has_assignee_param = request.args.get("has_assignee")
    assigned_group_param = request.args.get("assigned_group")
    sort_param = request.args.get("sort", "created_at")
    sort_dir = request.args.get("sort_dir", "desc")
    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", 0, type=int)
    
    # Determine which fields to include
    if fields_param:
        selected_fields = [f.strip() for f in fields_param.split(",")]
    else:
        # Default fields for table display
        selected_fields = ["summary", "status", "priority", "assignee", "assigned_group", "requester_name", "city", "created_at"]
    
    # Parse filters
    status_filter = None
    if status_param:
        try:
            status_filter = TicketStatus(status_param)
        except ValueError:
            pass
    
    has_assignee_filter = None
    if has_assignee_param is not None:
        has_assignee_filter = has_assignee_param.lower() == "true"
    
    # Get tickets with filters
    tickets = _csv_ticket_service.list_tickets(
        status=status_filter,
        assigned_group=assigned_group_param,
        has_assignee=has_assignee_filter,
    )
    
    # Sort tickets
    def get_sort_key(ticket: Ticket):
        val = getattr(ticket, sort_param, None)
        if val is None:
            return ""
        if hasattr(val, "value"):  # Enum
            return val.value
        return val
    
    try:
        tickets = sorted(tickets, key=get_sort_key, reverse=(sort_dir == "desc"))
    except TypeError:
        pass  # Skip sorting if types are incompatible
    
    total_count = len(tickets)
    
    # Apply pagination
    if limit:
        tickets = tickets[offset:offset + limit]
    elif offset:
        tickets = tickets[offset:]
    
    # Build response with selected fields only
    result = []
    for ticket in tickets:
        row = {}
        for field in selected_fields:
            val = getattr(ticket, field, None)
            if val is None:
                row[field] = None
            elif hasattr(val, "value"):  # Enum
                row[field] = val.value
            elif hasattr(val, "isoformat"):  # datetime
                row[field] = val.isoformat()
            elif hasattr(val, "hex"):  # UUID
                row[field] = str(val)
            else:
                row[field] = val
        result.append(row)
    
    return jsonify({
        "tickets": result,
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "fields": selected_fields,
    })


@app.route("/api/csv-tickets/<ticket_id>", methods=["GET"])
async def get_csv_ticket(ticket_id: str):
    """
    Get one CSV ticket by ID.

    Query params:
    - fields: optional comma-separated list of fields to include
    """
    try:
        parsed_id = UUID(ticket_id)
    except ValueError:
        return jsonify({"error": "Invalid ticket ID"}), 400

    ticket = _csv_ticket_service.get_ticket(parsed_id)
    if ticket is None:
        return jsonify({"error": "Ticket not found"}), 404

    fields_param = request.args.get("fields", "")
    if fields_param:
        selected_fields = [f.strip() for f in fields_param.split(",") if f.strip()]
    else:
        selected_fields = list(ticket.model_fields.keys())

    result = {}
    for field in selected_fields:
        val = getattr(ticket, field, None)
        if val is None:
            result[field] = None
        elif hasattr(val, "value"):
            result[field] = val.value
        elif hasattr(val, "isoformat"):
            result[field] = val.isoformat()
        elif hasattr(val, "hex"):
            result[field] = str(val)
        else:
            result[field] = val

    return jsonify(result), 200


@app.route("/api/csv-tickets/stats", methods=["GET"])
async def get_csv_ticket_stats():
    """Get statistics about CSV tickets."""
    from collections import Counter
    
    tickets = _csv_ticket_service.list_tickets()
    
    statuses = Counter(t.status.value for t in tickets)
    priorities = Counter(t.priority.value for t in tickets)
    groups = Counter(t.assigned_group for t in tickets if t.assigned_group)
    cities = Counter(t.city for t in tickets if t.city)
    
    unassigned_count = sum(1 for t in tickets if t.assignee is None and t.assigned_group is not None)
    
    return jsonify({
        "total": len(tickets),
        "unassigned": unassigned_count,
        "by_status": dict(statuses),
        "by_priority": dict(priorities),
        "by_group": dict(groups.most_common(10)),
        "by_city": dict(cities.most_common(10)),
    })


@app.route("/api/csv-tickets/sla-breach", methods=["GET"])
async def get_csv_tickets_sla_breach():
    """
    Return unassigned tickets grouped by SLA breach status (breached → at_risk),
    sorted by age_hours descending within each group.

    Query params:
    - unassigned_only: true/false (default: true)
    - include_ok: true/false (default: false) — include non-breached tickets too
    """
    from tickets import get_sla_breach_report

    unassigned_only = request.args.get("unassigned_only", "true").lower() != "false"
    include_ok = request.args.get("include_ok", "false").lower() == "true"

    tickets = _csv_ticket_service.list_tickets(
        has_assignee=False if unassigned_only else None,
    )
    report = get_sla_breach_report(tickets, reference_time=None, include_ok=include_ok)
    return jsonify(report.model_dump(mode="json"))


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
# KBA DRAFTER ENDPOINTS
# ============================================================================

@app.route("/api/kba/drafts", methods=["POST"])
async def rest_kba_generate_draft():
    """REST wrapper: generate KBA draft from ticket."""
    try:
        from operations import op_kba_generate_draft
        data = await request.get_json()
        draft_data = KBADraftCreate(**data)
        draft = await op_kba_generate_draft(draft_data)
        return jsonify(draft.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/kba/drafts/<draft_id>", methods=["GET"])
async def rest_kba_get_draft(draft_id: str):
    """REST wrapper: get KBA draft by ID."""
    from operations import op_kba_get_draft
    draft = await op_kba_get_draft(draft_id)
    return jsonify(draft.model_dump())


@app.route("/api/kba/drafts/<draft_id>", methods=["PATCH"])
async def rest_kba_update_draft(draft_id: str):
    """REST wrapper: update KBA draft."""
    try:
        from operations import op_kba_update_draft
        data = await request.get_json()
        user_id = data.pop("user_id", "anonymous")
        update_data = KBADraftUpdate(**data)
        draft = await op_kba_update_draft(draft_id, update_data, user_id)
        return jsonify(draft.model_dump())
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/kba/drafts/<draft_id>", methods=["DELETE"])
async def rest_kba_delete_draft(draft_id: str):
    """REST wrapper: delete KBA draft."""
    from operations import op_kba_delete_draft
    data = await request.get_json() if await request.data else {}
    user_id = data.get("user_id", "anonymous")
    success = await op_kba_delete_draft(draft_id, user_id)
    if success:
        return jsonify({"success": True, "message": "Draft deleted"})
    else:
        return jsonify({"error": "Draft not found"}), 404


@app.route("/api/kba/drafts/<draft_id>/publish", methods=["POST"])
async def rest_kba_publish_draft(draft_id: str):
    """REST wrapper: publish KBA draft."""
    try:
        from operations import op_kba_publish_draft
        data = await request.get_json()
        publish_data = KBAPublishRequest(**data)
        result = await op_kba_publish_draft(draft_id, publish_data)
        return jsonify(result.model_dump())
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/kba/drafts", methods=["GET"])
async def rest_kba_list_drafts():
    """REST wrapper: list KBA drafts with filtering."""
    from operations import op_kba_list_drafts
    # Parse query parameters
    filters = KBADraftFilter(
        status=request.args.get("status"),
        created_by=request.args.get("created_by"),
        ticket_id=request.args.get("ticket_id"),
        incident_id=request.args.get("incident_id"),
        limit=int(request.args.get("limit", 20)),
        offset=int(request.args.get("offset", 0))
    )
    response = await op_kba_list_drafts(filters)
    return jsonify(response.model_dump())


@app.route("/api/kba/drafts/<draft_id>/audit", methods=["GET"])
async def rest_kba_get_audit_trail(draft_id: str):
    """REST wrapper: get audit trail for KBA draft."""
    from operations import op_kba_get_audit_trail
    events = await op_kba_get_audit_trail(draft_id)
    return jsonify({"draft_id": draft_id, "events": events})


@app.route("/api/kba/guidelines", methods=["GET"])
async def rest_kba_list_guidelines():
    """REST wrapper: list available guidelines."""
    from operations import op_kba_list_guidelines
    result = await op_kba_list_guidelines()
    return jsonify(result)


@app.route("/api/kba/guidelines/<category>", methods=["GET"])
async def rest_kba_get_guideline(category: str):
    """REST wrapper: get guideline content."""
    from operations import op_kba_get_guideline
    result = await op_kba_get_guideline(category)
    return jsonify(result)


@app.route("/api/kba/health", methods=["GET"])
async def rest_kba_health():
    """Check LLM service health status."""
    from llm_service import get_llm_service
    llm = get_llm_service()
    available = await llm.health_check()
    return jsonify({
        "llm_available": available,
        "llm_provider": "openai",
        "model": llm.model
    })


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

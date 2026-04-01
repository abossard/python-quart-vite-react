"""
Agent Builder — Quart Blueprint

All HTTP routes for the agent builder (/api/workbench/* and /api/agents/run).
Register with: app.register_blueprint(agent_builder_bp)

Action layer: marshals HTTP ↔ service, no business logic.
"""

import asyncio
import json

from pydantic import ValidationError
from quart import Blueprint, jsonify, request

from .engine.event_bus import agent_event_bus
from .engine.prompt_builder import DEFAULT_OUTPUT_SCHEMA
from .models import (
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentRunCreate,
    CriteriaType,
    RunStatus,
)

agent_builder_bp = Blueprint("agent_builder", __name__)

# These will be set by configure_blueprint() at startup.
_workbench_service = None
_chat_service = None
_get_operation = None


def configure_blueprint(
    *,
    workbench_service,
    chat_service=None,
    get_operation_fn=None,
):
    """
    Wire services into the blueprint at startup.

    Called once from app.py or workbench_integration.py before the app starts.
    """
    global _workbench_service, _chat_service, _get_operation
    _workbench_service = workbench_service
    _chat_service = chat_service
    _get_operation = get_operation_fn


# ---------------------------------------------------------------------------
# Helpers to reduce boilerplate (DRY error handling)
# ---------------------------------------------------------------------------

def _error_response(exc, status=500):
    msg = str(exc)
    if isinstance(exc, ValueError) and "not found" in msg.lower():
        status = 404
    elif isinstance(exc, (ValueError, ValidationError)):
        status = 400
    return jsonify({"error": msg}), status


# ---------------------------------------------------------------------------
# Chat agent endpoint
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/agents/run", methods=["POST"])
async def rest_run_agent():
    """Run AI agent with OpenAI (simple chat interface)."""
    if _chat_service is None:
        return jsonify({"error": "Chat service not configured"}), 503
    try:
        from .models.chat import AgentRequest
        data = await request.get_json()
        agent_request = AgentRequest(**data)
        response = await _chat_service.run_agent(agent_request)
        return jsonify(response.model_dump()), 200
    except ValidationError as e:
        return _error_response(e, 400)
    except Exception as e:
        return _error_response(e)


# ---------------------------------------------------------------------------
# Workbench UI config
# ---------------------------------------------------------------------------

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


@agent_builder_bp.route("/api/workbench/ui-config", methods=["GET"])
async def workbench_ui_config():
    """Expose UI-friendly endpoint metadata and enums for Agent Fabric."""
    endpoints: list[dict] = []
    if _get_operation:
        for op_name in _WORKBENCH_UI_OPERATION_NAMES:
            op = _get_operation(op_name)
            if op is None:
                continue
            endpoints.append({
                "name": op.name,
                "method": op.http_method,
                "path": op.http_path,
                "description": op.description,
                "input_schema": op.get_mcp_input_schema(),
            })

    llm_catalog = {
        "backend": "unknown",
        "provider": None,
        "default_model": "",
        "fallback_models": [],
        "available_models": [],
        "source": "unavailable",
    }
    try:
        from llm_service import get_llm_service

        llm_catalog = get_llm_service().get_model_catalog()
    except Exception:
        pass

    return jsonify({
        "module": "agent_fabric",
        "version": "2",
        "criteria_types": [c.value for c in CriteriaType],
        "run_statuses": [s.value for s in RunStatus],
        "defaults": {
            "run_list_limit": 50,
            "max_run_list_limit": 500,
            "temperature": 0.0,
            "recursion_limit": 3,
            "max_tokens": 4096,
        },
        "llm_config_fields": ["model", "temperature", "recursion_limit", "max_tokens", "output_instructions", "output_schema"],
        "llm": llm_catalog,
        "default_output_schema": DEFAULT_OUTPUT_SCHEMA,
        "endpoints": endpoints,
    })


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/tools", methods=["GET"])
async def workbench_list_tools():
    """List all tools available for use in agent definitions."""
    return jsonify({"tools": _workbench_service.list_tools()})


# ---------------------------------------------------------------------------
# Schema suggestion
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/suggest-schema", methods=["POST"])
async def workbench_suggest_schema():
    """Suggest a JSON Schema and tool selection based on agent definition."""
    try:
        data = await request.get_json()
        result = await _workbench_service.suggest_schema(
            name=data.get("name", ""),
            description=data.get("description", ""),
            system_prompt=data.get("system_prompt", ""),
        )
        return jsonify(result), 200
    except Exception as exc:
        return _error_response(exc)


@agent_builder_bp.route("/api/workbench/improve-prompt", methods=["POST"])
async def workbench_improve_prompt():
    """Improve a system prompt using LLM best practices."""
    try:
        data = await request.get_json()
        result = await _workbench_service.improve_prompt(
            name=data.get("name", ""),
            description=data.get("description", ""),
            system_prompt=data.get("system_prompt", ""),
            tool_names=data.get("tool_names"),
        )
        return jsonify(result), 200
    except Exception as exc:
        return _error_response(exc)


# ---------------------------------------------------------------------------
# Agent CRUD
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/agents", methods=["GET"])
async def workbench_list_agents():
    agents = _workbench_service.list_agents()
    return jsonify({"agents": [a.to_dict() for a in agents]})


@agent_builder_bp.route("/api/workbench/agents", methods=["POST"])
async def workbench_create_agent():
    try:
        data = await request.get_json()
        agent_def = _workbench_service.create_agent(AgentDefinitionCreate(**data))
        return jsonify(agent_def.to_dict()), 201
    except (ValidationError, ValueError) as exc:
        return _error_response(exc, 400)
    except Exception as exc:
        return _error_response(exc)


@agent_builder_bp.route("/api/workbench/agents/<agent_id>", methods=["GET"])
async def workbench_get_agent(agent_id: str):
    agent_def = _workbench_service.get_agent(agent_id)
    if agent_def is None:
        return jsonify({"error": "Agent not found"}), 404
    return jsonify(agent_def.to_dict())


@agent_builder_bp.route("/api/workbench/agents/<agent_id>", methods=["PUT"])
async def workbench_update_agent(agent_id: str):
    try:
        data = await request.get_json()
        agent_def = _workbench_service.update_agent(agent_id, AgentDefinitionUpdate(**data))
        if agent_def is None:
            return jsonify({"error": "Agent not found"}), 404
        return jsonify(agent_def.to_dict())
    except (ValidationError, ValueError) as exc:
        return _error_response(exc, 400)
    except Exception as exc:
        return _error_response(exc)


@agent_builder_bp.route("/api/workbench/agents/<agent_id>", methods=["DELETE"])
async def workbench_delete_agent(agent_id: str):
    if not _workbench_service.delete_agent(agent_id):
        return jsonify({"error": "Agent not found"}), 404
    return jsonify({"message": "Deleted"}), 200


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/agents/<agent_id>/runs", methods=["POST"])
async def workbench_run_agent(agent_id: str):
    try:
        data = await request.get_json()
        run = await _workbench_service.run_agent(agent_id, AgentRunCreate(**data))
        return jsonify(run.to_dict()), 202
    except (ValidationError, ValueError) as exc:
        return _error_response(exc)
    except Exception as exc:
        return _error_response(exc)


@agent_builder_bp.route("/api/workbench/agents/<agent_id>/runs", methods=["GET"])
async def workbench_list_agent_runs(agent_id: str):
    limit = request.args.get("limit", 50, type=int)
    runs = _workbench_service.list_runs(agent_id=agent_id, limit=limit)
    return jsonify({"runs": [r.to_dict() for r in runs]})


@agent_builder_bp.route("/api/workbench/runs", methods=["GET"])
async def workbench_list_all_runs():
    limit = request.args.get("limit", 50, type=int)
    runs = _workbench_service.list_runs(limit=limit)
    return jsonify({"runs": [r.to_dict() for r in runs]})


@agent_builder_bp.route("/api/workbench/runs", methods=["DELETE"])
async def workbench_delete_all_runs():
    count = _workbench_service.delete_all_runs()
    return jsonify({"deleted": count})


@agent_builder_bp.route("/api/workbench/runs/<run_id>", methods=["GET"])
async def workbench_get_run(run_id: str):
    run = _workbench_service.get_run(run_id)
    if run is None:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(run.to_dict())


# ---------------------------------------------------------------------------
# SSE: Agent Activity Stream
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/events", methods=["GET"])
async def workbench_event_stream():
    """Server-Sent Events endpoint for real-time agent activity.

    Supports optional ?run_id=X to filter events for a specific run.
    Sends periodic heartbeat comments to keep the connection alive
    through proxies and prevent browser timeouts.
    """
    from quart import make_response

    run_id_filter = request.args.get("run_id")
    queue = agent_event_bus.subscribe()

    async def generate():
        try:
            # Send initial SSE comment so the connection is established immediately
            yield ": connected\n\n"

            # Send history buffer as catch-up
            for event in agent_event_bus.get_history():
                if run_id_filter and event.run_id != run_id_filter:
                    continue
                yield f"data: {json.dumps(event.to_sse_dict())}\n\n"

            # Stream new events with periodic heartbeat
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    if run_id_filter and event.run_id != run_id_filter:
                        continue
                    yield f"data: {json.dumps(event.to_sse_dict())}\n\n"
                except asyncio.TimeoutError:
                    # Send SSE comment as keepalive to prevent proxy/browser timeout
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            agent_event_bus.unsubscribe(queue)

    response = await make_response(generate(), {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })
    response.timeout = None
    return response


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/runs/<run_id>/evaluate", methods=["POST"])
async def workbench_evaluate_run(run_id: str):
    try:
        evaluation = await _workbench_service.evaluate_run(run_id)
        return jsonify(evaluation.to_dict()), 200
    except (ValueError,) as exc:
        return _error_response(exc)
    except Exception as exc:
        return _error_response(exc)


@agent_builder_bp.route("/api/workbench/runs/<run_id>/evaluation", methods=["GET"])
async def workbench_get_evaluation(run_id: str):
    evaluation = _workbench_service.get_evaluation(run_id)
    if evaluation is None:
        return jsonify({"error": "No evaluation found for this run"}), 404
    return jsonify(evaluation.to_dict())


# ---------------------------------------------------------------------------
# AG-UI: Conversational Agent Endpoint
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/ag-ui", methods=["POST"])
async def workbench_ag_ui():
    """AG-UI protocol endpoint — SSE stream of typed events for conversational agent interaction."""
    try:
        data = await request.get_json()
        agent_id = data.get("agent_id")
        thread_id = data.get("thread_id")
        message = data.get("message", "").strip()

        if not agent_id and not thread_id:
            return jsonify({"error": "agent_id or thread_id required"}), 400
        if not message:
            return jsonify({"error": "message required"}), 400

        # Create or resume thread
        if not thread_id:
            thread = _workbench_service.create_thread(agent_id)
            thread_id = thread.id

        async def generate():
            async for event_data in _workbench_service.continue_thread(thread_id, message):
                yield event_data

        return generate(), {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    except (ValueError,) as exc:
        return _error_response(exc)
    except Exception as exc:
        return _error_response(exc)


# ---------------------------------------------------------------------------
# Thread Management
# ---------------------------------------------------------------------------

@agent_builder_bp.route("/api/workbench/threads", methods=["GET"])
async def workbench_list_threads():
    """List conversation threads, optionally filtered by agent_id."""
    agent_id = request.args.get("agent_id")
    limit = request.args.get("limit", 50, type=int)
    threads = _workbench_service.list_threads(agent_id=agent_id, limit=limit)
    return jsonify({"threads": [t.to_dict() for t in threads]})


@agent_builder_bp.route("/api/workbench/threads/<thread_id>", methods=["GET"])
async def workbench_get_thread(thread_id: str):
    """Get thread details with messages."""
    thread = _workbench_service.get_thread(thread_id)
    if thread is None:
        return jsonify({"error": "Thread not found"}), 404
    messages = _workbench_service.get_thread_messages(thread_id)
    result = thread.to_dict()
    result["messages"] = [m.to_dict() for m in messages]
    return jsonify(result)


@agent_builder_bp.route("/api/workbench/threads/<thread_id>", methods=["DELETE"])
async def workbench_delete_thread(thread_id: str):
    if not _workbench_service.delete_thread(thread_id):
        return jsonify({"error": "Thread not found"}), 404
    return jsonify({"message": "Deleted"}), 200


@agent_builder_bp.route("/api/workbench/threads/<thread_id>/messages", methods=["GET"])
async def workbench_get_thread_messages(thread_id: str):
    """Get messages for a thread."""
    messages = _workbench_service.get_thread_messages(thread_id)
    return jsonify({"messages": [m.to_dict() for m in messages]})


@agent_builder_bp.route("/api/workbench/threads/from-run/<run_id>", methods=["POST"])
async def workbench_thread_from_run(run_id: str):
    """Create a conversation thread seeded from a completed run."""
    try:
        thread = _workbench_service.start_thread_from_run(run_id)
        messages = _workbench_service.get_thread_messages(thread.id)
        result = thread.to_dict()
        result["messages"] = [m.to_dict() for m in messages]
        return jsonify(result), 201
    except ValueError as exc:
        return _error_response(exc)
    except Exception as exc:
        return _error_response(exc)

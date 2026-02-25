"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

import json
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from agent_workbench import AgentDefinitionCreate, AgentDefinitionUpdate, AgentRunCreate
from api_decorators import operation
from csv_data import get_csv_ticket_service
from openai import AzureOpenAI
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate
from tickets import (
    KBAArticle,
    SlaBreachReport,
    Ticket,
    TicketSlaInfo,
    TicketStatus,
    get_sla_breach_report,
)

# Service instances shared across interfaces
_task_service = TaskService()
_csv_service = get_csv_ticket_service()
_csv_loaded = False


CSV_TICKET_FIELDS = [
    {"name": "incident_id", "label": "Incident ID", "type": "string"},
    {"name": "id", "label": "ID", "type": "uuid"},
    {"name": "summary", "label": "Summary", "type": "string"},
    {"name": "status", "label": "Status", "type": "enum"},
    {"name": "priority", "label": "Priority", "type": "enum"},
    {"name": "assignee", "label": "Assignee", "type": "string"},
    {"name": "assigned_group", "label": "Assigned Group", "type": "string"},
    {"name": "requester_name", "label": "Requester", "type": "string"},
    {"name": "requester_email", "label": "Email", "type": "string"},
    {"name": "city", "label": "City", "type": "string"},
    {"name": "country", "label": "Country", "type": "string"},
    {"name": "service", "label": "Service", "type": "string"},
    {"name": "incident_type", "label": "Incident Type", "type": "string"},
    {"name": "product_name", "label": "Product", "type": "string"},
    {"name": "manufacturer", "label": "Manufacturer", "type": "string"},
    {"name": "created_at", "label": "Created", "type": "datetime"},
    {"name": "updated_at", "label": "Updated", "type": "datetime"},
    {"name": "urgency", "label": "Urgency", "type": "string"},
    {"name": "impact", "label": "Impact", "type": "string"},
    {"name": "resolution", "label": "Resolution", "type": "string"},
    {"name": "notes", "label": "Notes", "type": "string"},
]


def _ensure_csv_loaded() -> None:
    """Load the default CSV file once so MCP tools are immediately usable."""
    global _csv_loaded
    if _csv_loaded:
        return

    default_csv_path = Path(__file__).resolve().parents[1] / "csv" / "data.csv"
    if default_csv_path.exists():
        try:
            _csv_service.load_csv(default_csv_path)
        except Exception:
            pass
    _csv_loaded = True


def _parse_status(status: str | None) -> TicketStatus | None:
    """Convert status string to enum, returning None for unknown values."""
    if not status:
        return None
    try:
        return TicketStatus(status.lower())
    except ValueError:
        return None


def _sorted_tickets(tickets: list[Ticket], sort: str, sort_dir: str) -> list[Ticket]:
    """Sort tickets while handling nullable and enum fields."""
    reverse = sort_dir.lower() == "desc"

    def sort_key(ticket: Ticket):
        value = getattr(ticket, sort, None)
        if value is None:
            return ""
        if hasattr(value, "value"):
            return value.value
        return value

    try:
        return sorted(tickets, key=sort_key, reverse=reverse)
    except TypeError:
        return tickets


def _get_workbench_service():
    """Lazy import avoids circular import during module bootstrap."""
    from workbench_integration import workbench_service
    return workbench_service


@operation(
    name="list_tasks",
    description="List all tasks with optional filtering by completion status",
    http_method="GET",
    http_path="/api/tasks",
)
async def op_list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
    """List tasks with optional filtering."""
    return _task_service.list_tasks(filter)


@operation(
    name="create_task",
    description="Create a new task with validation",
    http_method="POST",
    http_path="/api/tasks",
)
async def op_create_task(data: TaskCreate) -> Task:
    """Create a new task with validation."""
    return _task_service.create_task(data)


@operation(
    name="get_task",
    description="Retrieve a specific task by its unique identifier",
    http_method="GET",
    http_path="/api/tasks/{task_id}",
)
async def op_get_task(task_id: str) -> Task | None:
    """Get a task by ID."""
    return _task_service.get_task(task_id)


@operation(
    name="update_task",
    description="Update an existing task's properties",
    http_method="PUT",
    http_path="/api/tasks/{task_id}",
)
async def op_update_task(task_id: str, data: TaskUpdate) -> Task | None:
    """Update a task by ID."""
    return _task_service.update_task(task_id, data)


@operation(
    name="delete_task",
    description="Delete a task permanently by its identifier",
    http_method="DELETE",
    http_path="/api/tasks/{task_id}",
)
async def op_delete_task(task_id: str) -> bool:
    """Delete a task by ID."""
    return _task_service.delete_task(task_id)


@operation(
    name="get_task_stats",
    description="Get summary statistics for all tasks",
    http_method="GET",
    http_path="/api/tasks/stats",
)
async def op_get_task_stats() -> TaskStats:
    """Get task statistics."""
    return _task_service.get_stats()


@operation(
    name="csv_list_tickets",
    description="List tickets loaded from CSV with optional filters and pagination",
    http_method="GET",
)
async def op_csv_list_tickets(
    status: str | None = None,
    assigned_group: str | None = None,
    has_assignee: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "created_at",
    sort_dir: str = "desc",
) -> list[Ticket]:
    """List CSV tickets for MCP/agent consumers."""
    _ensure_csv_loaded()
    parsed_status = _parse_status(status)
    tickets = _csv_service.list_tickets(
        status=parsed_status,
        assigned_group=assigned_group,
        has_assignee=has_assignee,
    )
    tickets = _sorted_tickets(tickets, sort, sort_dir)

    normalized_offset = max(offset, 0)
    normalized_limit = min(max(limit, 1), 500)
    return tickets[normalized_offset: normalized_offset + normalized_limit]


@operation(
    name="csv_get_ticket",
    description="Get a single CSV ticket by INC number (e.g. INC000016349327) or UUID",
    http_method="GET",
)
async def op_csv_get_ticket(ticket_id: str) -> Ticket | None:
    """Get one CSV ticket by INC number or UUID."""
    _ensure_csv_loaded()
    # Try INC number first (primary identifier)
    if ticket_id.upper().startswith("INC"):
        return _csv_service.get_ticket_by_incident_id(ticket_id)
    # Fall back to UUID for internal use
    try:
        parsed_id = UUID(ticket_id)
    except ValueError:
        return None
    return _csv_service.get_ticket(parsed_id)


@operation(
    name="csv_search_tickets",
    description="Search CSV tickets by text across incident ID, summary, description, notes, requester and location fields",
    http_method="GET",
)
async def op_csv_search_tickets(query: str, limit: int = 50) -> list[Ticket]:
    """Search CSV tickets with a simple case-insensitive contains check."""
    _ensure_csv_loaded()
    q = query.strip().lower()
    if not q:
        return []

    normalized_limit = min(max(limit, 1), 500)
    matches: list[Ticket] = []
    for ticket in _csv_service.list_tickets():
        haystack = " ".join(
            [
                ticket.incident_id or "",
                ticket.summary or "",
                ticket.description or "",
                ticket.notes or "",
                ticket.resolution or "",
                ticket.requester_name or "",
                ticket.requester_email or "",
                ticket.assigned_group or "",
                ticket.city or "",
                ticket.service or "",
            ]
        ).lower()

        if q in haystack:
            matches.append(ticket)
            if len(matches) >= normalized_limit:
                break

    return matches


@operation(
    name="csv_ticket_stats",
    description="Get aggregated statistics for tickets loaded from CSV",
    http_method="GET",
)
async def op_csv_ticket_stats() -> dict[str, Any]:
    """Return counts by status, priority, group, and city."""
    _ensure_csv_loaded()
    tickets = _csv_service.list_tickets()

    by_status = Counter(t.status.value for t in tickets)
    by_priority = Counter(t.priority.value for t in tickets)
    by_group = Counter(t.assigned_group for t in tickets if t.assigned_group)
    by_city = Counter(t.city for t in tickets if t.city)
    unassigned = sum(1 for t in tickets if t.assignee is None and t.assigned_group is not None)

    return {
        "total": len(tickets),
        "unassigned": unassigned,
        "by_status": dict(by_status),
        "by_priority": dict(by_priority),
        "by_group": dict(by_group.most_common(10)),
        "by_city": dict(by_city.most_common(10)),
    }


@operation(
    name="csv_ticket_fields",
    description="List the curated CSV ticket fields exposed to UI and agent tools",
    http_method="GET",
)
async def op_csv_ticket_fields() -> list[dict[str, str]]:
    """Return field metadata for CSV ticket projections."""
    _ensure_csv_loaded()
    return CSV_TICKET_FIELDS


@operation(
    name="generate_kba_article",
    description="Generate a Knowledge Base Article from a ticket ID using Azure OpenAI. Returns a structured KBA with title, question, and answer in German.",
    http_method="POST",
    http_path="/api/kba/generate",
)
async def op_generate_kba_article(ticket_id: str) -> KBAArticle:
    """Generate a KBA article from a ticket using Azure OpenAI."""
    _ensure_csv_loaded()

    ticket = await op_csv_get_ticket(ticket_id)
    if not ticket:
        raise ValueError(f"Ticket '{ticket_id}' not found in CSV data")

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")

    if not all([endpoint, api_key, deployment]):
        raise ValueError(
            "Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in .env file."
        )

    prompt = f"""Basierend auf diesem Support-Ticket, erstelle einen Knowledge Base Artikel.

Ticket Information:
Ticket-ID: {ticket.id}
Zusammenfassung: {ticket.summary or 'Keine Zusammenfassung'}
Beschreibung: {ticket.description or 'Keine Beschreibung'}
Notizen: {ticket.notes or 'Keine Notizen'}
Lösung: {ticket.resolution or 'Keine Lösung vorhanden'}
Status: {ticket.status.value if ticket.status else 'Unbekannt'}
Priorität: {ticket.priority.value if ticket.priority else 'Unbekannt'}

Erstelle einen strukturierten Knowledge Base Artikel mit:
1. Einem prägnanten Titel (max. 100 Zeichen)
2. Einer klaren Frage, die das Problem beschreibt
3. Einer detaillierten Antwort/Lösung

Antworte NUR im folgenden JSON-Format (ohne Markdown-Formatierung):
{{
  "title": "Titel des Artikels",
  "question": "Die Frage/Problem",
  "answer": "Die detaillierte Antwort/Lösung"
}}"""

    try:
        if '/openai/responses' in endpoint:
            async with httpx.AsyncClient(timeout=120.0) as http_client:
                payload = {
                    "model": deployment,
                    "input": prompt,
                    "temperature": 0.7,
                    "max_output_tokens": 4000,
                }
                response = await http_client.post(
                    endpoint,
                    headers={"api-key": api_key, "Content-Type": "application/json"},
                    json=payload,
                )
                if response.status_code != 200:
                    raise ValueError(f"Azure API error {response.status_code}: {response.text}")
                data = response.json()
                if 'output' in data:
                    output = data['output']
                    if isinstance(output, list) and len(output) > 0:
                        message = output[0]
                        if 'content' in message:
                            content_list = message['content']
                            if isinstance(content_list, list) and len(content_list) > 0 and 'text' in content_list[0]:
                                content = content_list[0]['text'].strip()
                            else:
                                raise ValueError("Content is not a valid list")
                        else:
                            raise ValueError("No 'content' field in message")
                    else:
                        raise ValueError("Output is not a valid list")
                elif 'text' in data:
                    content = data['text'].strip()
                elif 'choices' in data and len(data['choices']) > 0:
                    choice = data['choices'][0]
                    content = (choice.get('text') or choice.get('message', {}).get('content', '')).strip()
                else:
                    raise ValueError(f"Unexpected response format: {data}")
        else:
            azure_client = AzureOpenAI(
                azure_endpoint=endpoint, api_key=api_key, api_version=api_version
            )
            response = azure_client.chat.completions.create(
                model=deployment,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4000,
            )
            content = response.choices[0].message.content.strip()

        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
            content = content.strip()

        kba_data = json.loads(content)
        return KBAArticle(
            title=kba_data.get('title', 'Kein Titel'),
            question=kba_data.get('question', 'Keine Frage'),
            answer=kba_data.get('answer', 'Keine Antwort'),
            ticket_id=str(ticket.id),
            generated_at=datetime.now(),
        )

    except httpx.TimeoutException as e:
        raise ValueError(f"Azure API request timeout: {str(e)}") from e
    except httpx.HTTPError as e:
        raise ValueError(f"Azure API HTTP error: {str(e)}") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse Azure OpenAI response as JSON: {str(e)}") from e
    except Exception as e:
        raise ValueError(f"Failed to generate KBA: {str(e)}") from e


@operation(
    name="csv_sla_breach_tickets",
    description=(
        "Return tickets at SLA breach risk from the CSV dataset. "
        "By default only unassigned tickets (assigned to a group but no individual) are included. "
        "Results contain pre-computed age_hours, sla_threshold_hours, and breach_status. "
        "Grouped: 'breached' first, then 'at_risk'. Within each group sorted by age_hours descending. "
        "The reference timestamp is the maximum created_at date found in the selected tickets "
        "(not the current system time), making results deterministic for historical datasets. "
        "SLA thresholds: critical=4h, high=24h, medium=72h, low=120h."
    ),
    http_method="GET",
)
async def op_csv_sla_breach_tickets(
    unassigned_only: bool = True,
    include_ok: bool = False,
) -> SlaBreachReport:
    """
    Pre-compute SLA breach status for CSV tickets.

    Args:
        unassigned_only: When True (default), only return tickets that are assigned
            to a group but have no individual assignee — the primary use case for
            proactive SLA monitoring.
        include_ok: When True, also include tickets that are within their SLA window.
            Default False keeps the result focused on actionable items.

    Returns:
        SlaBreachReport with reference_timestamp, counts, and a sorted list of
        TicketSlaInfo objects ready for display or further AI commentary.
    """
    _ensure_csv_loaded()
    tickets = _csv_service.list_tickets(
        has_assignee=False if unassigned_only else None,
    )
    return get_sla_breach_report(tickets, reference_time=None, include_ok=include_ok)


@operation(
    name="workbench_list_tools",
    description="List tools available for Agent Fabric definitions",
    http_method="GET",
    http_path="/api/workbench/tools",
)
async def op_workbench_list_tools() -> list[dict[str, Any]]:
    """Return all registered tool metadata from the workbench registry."""
    return _get_workbench_service().list_tools()


@operation(
    name="workbench_list_agents",
    description="List all Agent Fabric agent definitions",
    http_method="GET",
    http_path="/api/workbench/agents",
)
async def op_workbench_list_agents() -> list[dict[str, Any]]:
    """List all persisted workbench agent definitions."""
    agents = _get_workbench_service().list_agents()
    return [agent.to_dict() for agent in agents]


@operation(
    name="workbench_create_agent",
    description="Create a new Agent Fabric agent definition",
    http_method="POST",
    http_path="/api/workbench/agents",
)
async def op_workbench_create_agent(data: AgentDefinitionCreate) -> dict[str, Any]:
    """Create and persist a workbench agent definition."""
    agent = _get_workbench_service().create_agent(data)
    return agent.to_dict()


@operation(
    name="workbench_get_agent",
    description="Get one Agent Fabric agent definition by id",
    http_method="GET",
    http_path="/api/workbench/agents/{agent_id}",
)
async def op_workbench_get_agent(agent_id: str) -> dict[str, Any] | None:
    """Fetch one workbench agent definition by id."""
    agent = _get_workbench_service().get_agent(agent_id)
    return agent.to_dict() if agent else None


@operation(
    name="workbench_update_agent",
    description="Update an Agent Fabric agent definition",
    http_method="PUT",
    http_path="/api/workbench/agents/{agent_id}",
)
async def op_workbench_update_agent(
    agent_id: str,
    data: AgentDefinitionUpdate,
) -> dict[str, Any] | None:
    """Update and return one workbench agent definition."""
    agent = _get_workbench_service().update_agent(agent_id, data)
    return agent.to_dict() if agent else None


@operation(
    name="workbench_delete_agent",
    description="Delete an Agent Fabric agent definition",
    http_method="DELETE",
    http_path="/api/workbench/agents/{agent_id}",
)
async def op_workbench_delete_agent(agent_id: str) -> bool:
    """Delete one workbench agent definition by id."""
    return _get_workbench_service().delete_agent(agent_id)


@operation(
    name="workbench_run_agent",
    description="Run an Agent Fabric agent with a prompt",
    http_method="POST",
    http_path="/api/workbench/agents/{agent_id}/runs",
)
async def op_workbench_run_agent(agent_id: str, data: AgentRunCreate) -> dict[str, Any]:
    """Execute an existing workbench agent definition and persist the run."""
    run = await _get_workbench_service().run_agent(agent_id, data)
    return run.to_dict()


@operation(
    name="workbench_list_agent_runs",
    description="List Agent Fabric runs for a specific agent",
    http_method="GET",
    http_path="/api/workbench/agents/{agent_id}/runs",
)
async def op_workbench_list_agent_runs(
    agent_id: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return recent runs for a single workbench agent."""
    normalized_limit = min(max(limit, 1), 500)
    runs = _get_workbench_service().list_runs(agent_id=agent_id, limit=normalized_limit)
    return [run.to_dict() for run in runs]


@operation(
    name="workbench_list_runs",
    description="List Agent Fabric runs, optionally filtered by agent id",
    http_method="GET",
    http_path="/api/workbench/runs",
)
async def op_workbench_list_runs(
    agent_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return recent workbench runs."""
    normalized_limit = min(max(limit, 1), 500)
    runs = _get_workbench_service().list_runs(agent_id=agent_id, limit=normalized_limit)
    return [run.to_dict() for run in runs]


@operation(
    name="workbench_get_run",
    description="Get one Agent Fabric run by id",
    http_method="GET",
    http_path="/api/workbench/runs/{run_id}",
)
async def op_workbench_get_run(run_id: str) -> dict[str, Any] | None:
    """Fetch one persisted run by id."""
    run = _get_workbench_service().get_run(run_id)
    return run.to_dict() if run else None


@operation(
    name="workbench_evaluate_run",
    description="Evaluate an Agent Fabric run against its success criteria",
    http_method="POST",
    http_path="/api/workbench/runs/{run_id}/evaluate",
)
async def op_workbench_evaluate_run(run_id: str) -> dict[str, Any]:
    """Evaluate one run and upsert its evaluation record."""
    evaluation = await _get_workbench_service().evaluate_run(run_id)
    return evaluation.to_dict()


@operation(
    name="workbench_get_evaluation",
    description="Get evaluation for an Agent Fabric run",
    http_method="GET",
    http_path="/api/workbench/runs/{run_id}/evaluation",
)
async def op_workbench_get_evaluation(run_id: str) -> dict[str, Any] | None:
    """Get existing evaluation result for one run."""
    evaluation = _get_workbench_service().get_evaluation(run_id)
    return evaluation.to_dict() if evaluation else None


# Export shared services for callers (REST app, CLI tools, etc.)
task_service = _task_service
csv_ticket_service = _csv_service

__all__ = [
    "task_service",
    "csv_ticket_service",
    "op_list_tasks",
    "op_create_task",
    "op_get_task",
    "op_update_task",
    "op_delete_task",
    "op_get_task_stats",
    "op_csv_list_tickets",
    "op_csv_get_ticket",
    "op_csv_search_tickets",
    "op_csv_ticket_stats",
    "op_csv_ticket_fields",
    "op_csv_sla_breach_tickets",
    "op_generate_kba_article",
    "op_workbench_list_tools",
    "op_workbench_list_agents",
    "op_workbench_create_agent",
    "op_workbench_get_agent",
    "op_workbench_update_agent",
    "op_workbench_delete_agent",
    "op_workbench_run_agent",
    "op_workbench_list_agent_runs",
    "op_workbench_list_runs",
    "op_workbench_get_run",
    "op_workbench_evaluate_run",
    "op_workbench_get_evaluation",
    "CSV_TICKET_FIELDS",
]

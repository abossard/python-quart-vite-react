"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

import json
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import httpx
from api_decorators import operation
from csv_data import get_csv_ticket_service
from openai import AzureOpenAI
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate
from tickets import KBAArticle, Ticket, TicketStatus

# Service instances shared across interfaces
_task_service = TaskService()
_csv_service = get_csv_ticket_service()
_csv_loaded = False


CSV_TICKET_FIELDS = [
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
    description="Get a single CSV ticket by UUID or incident ID (e.g., INC000012345)",
    http_method="GET",
)
async def op_csv_get_ticket(ticket_id: str) -> Ticket | None:
    """Get one CSV ticket by UUID or incident_id."""
    _ensure_csv_loaded()
    
    # Try UUID lookup first
    try:
        parsed_id = UUID(ticket_id)
        return _csv_service.get_ticket(parsed_id)
    except ValueError:
        # Not a UUID, try incident_id lookup (case-insensitive)
        return _csv_service.get_ticket_by_incident_id(ticket_id)


@operation(
    name="csv_search_tickets",
    description="Search CSV tickets by text across summary, description, notes, requester and location fields",
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
    """
    Generate a KBA article from a ticket using Azure OpenAI.
    
    Searches for the ticket in CSV data, then uses Azure OpenAI to generate
    a structured Knowledge Base Article with Title, Question, and Answer
    based on the ticket information.
    
    Args:
        ticket_id: The ticket ID to search for and generate KBA from
    
    Returns:
        Generated KBA article with title, question, answer, and ticket_id
        
    Raises:
        ValueError: If ticket not found or Azure OpenAI configuration missing
    """
    _ensure_csv_loaded()
    
    # Search for ticket
    ticket = await op_csv_get_ticket(ticket_id)
    if not ticket:
        raise ValueError(f"Ticket '{ticket_id}' not found in CSV data")
    
    # Check Azure OpenAI configuration
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")
    
    if not all([endpoint, api_key, deployment]):
        raise ValueError(
            "Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in .env file."
        )
    
    # Create German prompt for LLM
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
        # Check if this is a Responses API endpoint (new preview API format)
        if '/openai/responses' in endpoint:
            # Use Responses API format with httpx
            async with httpx.AsyncClient(timeout=120.0) as http_client:
                payload = {
                    "model": deployment,
                    "input": prompt,
                    "temperature": 0.7,
                    "max_output_tokens": 4000
                }
                
                response = await http_client.post(
                    endpoint,
                    headers={
                        "api-key": api_key,
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code != 200:
                    error_text = response.text
                    raise ValueError(f"Azure API error {response.status_code}: {error_text}")
                
                data = response.json()
                
                # Extract content from Responses API format
                if 'output' in data:
                    output = data['output']
                    if isinstance(output, list) and len(output) > 0:
                        message = output[0]
                        if 'content' in message:
                            content_list = message['content']
                            if isinstance(content_list, list) and len(content_list) > 0:
                                content_item = content_list[0]
                                if 'text' in content_item:
                                    content = content_item['text'].strip()
                                else:
                                    raise ValueError(f"No 'text' field in content item")
                            else:
                                raise ValueError(f"Content is not a valid list")
                        else:
                            raise ValueError(f"No 'content' field in message")
                    else:
                        raise ValueError(f"Output is not a valid list")
                elif 'text' in data:
                    content = data['text'].strip()
                elif 'choices' in data and len(data['choices']) > 0:
                    choice = data['choices'][0]
                    if 'text' in choice:
                        content = choice['text'].strip()
                    elif 'message' in choice:
                        content = choice['message'].get('content', '').strip()
                    else:
                        raise ValueError(f"Unexpected choice format")
                else:
                    raise ValueError(f"Unexpected response format: {data}")
        else:
            # Standard Chat Completions API
            azure_client = AzureOpenAI(
                azure_endpoint=endpoint,
                api_key=api_key,
                api_version=api_version
            )
            
            response = azure_client.chat.completions.create(
                model=deployment,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content.strip()
        
        # Parse JSON response
        # Remove markdown code blocks if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
            content = content.strip()
        
        kba_data = json.loads(content)
        
        # Create KBA article with ticket ID and timestamp
        return KBAArticle(
            title=kba_data.get('title', 'Kein Titel'),
            question=kba_data.get('question', 'Keine Frage'),
            answer=kba_data.get('answer', 'Keine Antwort'),
            ticket_id=str(ticket.id),
            generated_at=datetime.now()
        )
        
    except httpx.TimeoutException as e:
        raise ValueError(f"Azure API request timeout: {str(e)}") from e
    except httpx.HTTPError as e:
        raise ValueError(f"Azure API HTTP error: {str(e)}") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse Azure OpenAI response as JSON: {str(e)}") from e
    except Exception as e:
        raise ValueError(f"Failed to generate KBA: {str(e)}") from e


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
    "op_generate_kba_article",
    "CSV_TICKET_FIELDS",
]

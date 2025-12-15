"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

from api_decorators import operation
from ollama_service import (ChatRequest, ChatResponse, ModelListResponse,
                            OllamaService)
from tasks import (Task, TaskCreate, TaskFilter, TaskService, TaskStats,
                   TaskUpdate)

# Service instances shared across interfaces
_task_service = TaskService()
_ollama_service = OllamaService()


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
    name="ollama_chat",
    description="Generate a chat completion using local Ollama LLM",
    http_method="POST",
    http_path="/api/ollama/chat",
)
async def op_ollama_chat(request: ChatRequest) -> ChatResponse:
    """Chat with the local Ollama LLM."""
    return await _ollama_service.chat(request)


@operation(
    name="list_ollama_models",
    description="List all available Ollama models on the local system",
    http_method="GET",
    http_path="/api/ollama/models",
)
async def op_list_ollama_models() -> ModelListResponse:
    """List available Ollama models."""
    return await _ollama_service.list_models()


# Export shared services for callers (REST app, CLI tools, etc.)
task_service = _task_service
ollama_service = _ollama_service

__all__ = [
    "task_service",
    "ollama_service",
    "op_list_tasks",
    "op_create_task",
    "op_get_task",
    "op_update_task",
    "op_delete_task",
    "op_get_task_stats",
    "op_ollama_chat",
    "op_list_ollama_models",
]

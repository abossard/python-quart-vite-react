"""
Task Registry — Central index of all 20 DSPy playground tasks.

Pure DATA: imports all task definitions and builds lookup structures.
"""
from .tier1_basics import TIER_1_TASKS, PlaygroundTask
from .tier2_reasoning import TIER_2_TASKS
from .tier3_composition import TIER_3_TASKS
from .tier4_agentic import TIER_4_TASKS

ALL_TASKS: list[PlaygroundTask] = (
    TIER_1_TASKS + TIER_2_TASKS + TIER_3_TASKS + TIER_4_TASKS
)

TASK_REGISTRY: dict[str, PlaygroundTask] = {t.id: t for t in ALL_TASKS}


def get_task(task_id: str) -> PlaygroundTask:
    """Look up a task by id. Raises KeyError if not found."""
    return TASK_REGISTRY[task_id]


def list_tasks() -> list[PlaygroundTask]:
    """Return all tasks in order."""
    return list(ALL_TASKS)


def list_by_tier(tier: int) -> list[PlaygroundTask]:
    """Return all tasks for a given tier (1-4)."""
    return [t for t in ALL_TASKS if t.tier == tier]


def task_summary() -> list[dict]:
    """Return lightweight task metadata for UI widgets."""
    return [
        {
            "id": t.id,
            "name": t.name,
            "tier": t.tier,
            "difficulty": t.difficulty,
            "description": t.description,
            "teaching_point": t.teaching_point,
            "module_type": t.module_type,
        }
        for t in ALL_TASKS
    ]
"""
Agent Builder — Run Status Finite State Machine

Pure calculation: validates state transitions for agent runs.
No I/O, no side effects — the FSM computes the next valid state
from (current_status, event) and raises on invalid transitions.

Valid transitions:
    PENDING  + START    → RUNNING
    RUNNING  + COMPLETE → COMPLETED
    RUNNING  + FAIL     → FAILED
    RUNNING  + TRUNCATE → TRUNCATED
"""

from __future__ import annotations

from enum import Enum

from .models.run import RunStatus


class RunEvent(str, Enum):
    """Events that can trigger a RunStatus transition."""
    START = "start"
    COMPLETE = "complete"
    FAIL = "fail"
    TRUNCATE = "truncate"


class InvalidTransition(Exception):
    """Raised when an event cannot be applied to the current status."""

    def __init__(self, status: RunStatus, event: RunEvent) -> None:
        self.status = status
        self.event = event
        super().__init__(
            f"Invalid transition: cannot apply {event.value!r} "
            f"to run in {status.value!r} state"
        )


# Transition table: (current_status, event) → next_status
_TRANSITIONS: dict[tuple[RunStatus, RunEvent], RunStatus] = {
    (RunStatus.PENDING, RunEvent.START): RunStatus.RUNNING,
    (RunStatus.RUNNING, RunEvent.COMPLETE): RunStatus.COMPLETED,
    (RunStatus.RUNNING, RunEvent.FAIL): RunStatus.FAILED,
    (RunStatus.RUNNING, RunEvent.TRUNCATE): RunStatus.TRUNCATED,
}


def transition(status: RunStatus, event: RunEvent) -> RunStatus:
    """Compute the next status from (current_status, event).

    Pure calculation — returns a new RunStatus or raises InvalidTransition.

    Example::

        next_status = transition(RunStatus.PENDING, RunEvent.START)
        assert next_status == RunStatus.RUNNING
    """
    key = (status, event)
    next_status = _TRANSITIONS.get(key)
    if next_status is None:
        raise InvalidTransition(status, event)
    return next_status

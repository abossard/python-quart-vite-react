"""Tests for the RunStatus finite state machine."""

import pytest

from agent_builder.fsm import InvalidTransition, RunEvent, transition
from agent_builder.models.run import RunStatus


VALID_TRANSITIONS = [
    (RunStatus.PENDING, RunEvent.START, RunStatus.RUNNING),
    (RunStatus.RUNNING, RunEvent.COMPLETE, RunStatus.COMPLETED),
    (RunStatus.RUNNING, RunEvent.FAIL, RunStatus.FAILED),
    (RunStatus.RUNNING, RunEvent.TRUNCATE, RunStatus.TRUNCATED),
]

INVALID_TRANSITIONS = [
    (RunStatus.PENDING, RunEvent.COMPLETE),
    (RunStatus.PENDING, RunEvent.FAIL),
    (RunStatus.COMPLETED, RunEvent.START),
    (RunStatus.COMPLETED, RunEvent.COMPLETE),
    (RunStatus.FAILED, RunEvent.START),
    (RunStatus.TRUNCATED, RunEvent.START),
    (RunStatus.RUNNING, RunEvent.START),
]


class TestRunStatusFSM:
    @pytest.mark.parametrize("status, event, expected", VALID_TRANSITIONS,
        ids=[f"{s.value}+{e.value}" for s, e, _ in VALID_TRANSITIONS])
    def test_valid_transition(self, status, event, expected):
        assert transition(status, event) == expected

    @pytest.mark.parametrize("status, event", INVALID_TRANSITIONS,
        ids=[f"{s.value}+{e.value}" for s, e in INVALID_TRANSITIONS])
    def test_invalid_transition_raises(self, status, event):
        with pytest.raises(InvalidTransition) as exc_info:
            transition(status, event)
        assert exc_info.value.status == status
        assert exc_info.value.event == event

    def test_full_lifecycle_success(self):
        status = transition(RunStatus.PENDING, RunEvent.START)
        status = transition(status, RunEvent.COMPLETE)
        assert status == RunStatus.COMPLETED

    def test_full_lifecycle_failure(self):
        status = transition(RunStatus.PENDING, RunEvent.START)
        status = transition(status, RunEvent.FAIL)
        assert status == RunStatus.FAILED

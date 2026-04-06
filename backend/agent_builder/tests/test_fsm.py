"""Tests for the RunStatus finite state machine."""

import pytest

from agent_builder.fsm import InvalidTransition, RunEvent, transition
from agent_builder.models.run import RunStatus


class TestRunStatusFSM:
    """Valid transitions."""

    def test_pending_start_running(self):
        assert transition(RunStatus.PENDING, RunEvent.START) == RunStatus.RUNNING

    def test_running_complete_completed(self):
        assert transition(RunStatus.RUNNING, RunEvent.COMPLETE) == RunStatus.COMPLETED

    def test_running_fail_failed(self):
        assert transition(RunStatus.RUNNING, RunEvent.FAIL) == RunStatus.FAILED

    def test_running_truncate_truncated(self):
        assert transition(RunStatus.RUNNING, RunEvent.TRUNCATE) == RunStatus.TRUNCATED

    def test_full_lifecycle_success(self):
        status = transition(RunStatus.PENDING, RunEvent.START)
        assert status == RunStatus.RUNNING
        status = transition(status, RunEvent.COMPLETE)
        assert status == RunStatus.COMPLETED

    def test_full_lifecycle_failure(self):
        status = transition(RunStatus.PENDING, RunEvent.START)
        status = transition(status, RunEvent.FAIL)
        assert status == RunStatus.FAILED


class TestRunStatusFSMInvalid:
    """Invalid transitions should raise InvalidTransition."""

    def test_pending_complete_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.PENDING, RunEvent.COMPLETE)

    def test_pending_fail_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.PENDING, RunEvent.FAIL)

    def test_completed_start_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.COMPLETED, RunEvent.START)

    def test_completed_complete_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.COMPLETED, RunEvent.COMPLETE)

    def test_failed_start_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.FAILED, RunEvent.START)

    def test_truncated_start_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.TRUNCATED, RunEvent.START)

    def test_running_start_invalid(self):
        with pytest.raises(InvalidTransition):
            transition(RunStatus.RUNNING, RunEvent.START)

    def test_error_contains_details(self):
        with pytest.raises(InvalidTransition) as exc_info:
            transition(RunStatus.COMPLETED, RunEvent.FAIL)
        err = exc_info.value
        assert err.status == RunStatus.COMPLETED
        assert err.event == RunEvent.FAIL
        assert "completed" in str(err).lower()
        assert "fail" in str(err).lower()

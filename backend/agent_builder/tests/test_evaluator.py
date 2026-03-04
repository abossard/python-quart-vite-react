"""Tests for evaluator — mostly pure calculations, no I/O needed."""

import pytest

from agent_builder.evaluator import compute_score, evaluate_run
from agent_builder.models import (
    AgentRun,
    CriteriaResult,
    CriteriaType,
    SuccessCriteria,
)


def _make_run(*, status="completed", output="Hello world", tools_used=None, error=None):
    """Helper to create a minimal AgentRun for testing."""
    run = AgentRun(agent_id="test", input_prompt="test")
    run.status = status
    run.output = output
    if tools_used:
        run.tools_used = tools_used
    run.error = error
    return run


# ---------------------------------------------------------------------------
# compute_score (pure calculation)
# ---------------------------------------------------------------------------

class TestComputeScore:
    def test_empty_criteria_returns_one(self):
        assert compute_score([]) == 1.0

    def test_all_passed(self):
        c = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        results = [
            CriteriaResult(criteria=c, passed=True),
            CriteriaResult(criteria=c, passed=True),
        ]
        assert compute_score(results) == 1.0

    def test_none_passed(self):
        c = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        results = [
            CriteriaResult(criteria=c, passed=False),
            CriteriaResult(criteria=c, passed=False),
        ]
        assert compute_score(results) == 0.0

    def test_partial(self):
        c = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        results = [
            CriteriaResult(criteria=c, passed=True),
            CriteriaResult(criteria=c, passed=False),
        ]
        assert compute_score(results) == 0.5


# ---------------------------------------------------------------------------
# evaluate_run (async, but no real I/O for non-LLM criteria)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestEvaluateRun:
    async def test_no_error_passes_for_completed_run(self):
        run = _make_run(status="completed")
        criteria = [SuccessCriteria(type=CriteriaType.NO_ERROR, value="")]
        results = await evaluate_run(run, criteria)
        assert len(results) == 1
        assert results[0].passed is True

    async def test_no_error_fails_for_failed_run(self):
        run = _make_run(status="failed", error="boom")
        criteria = [SuccessCriteria(type=CriteriaType.NO_ERROR, value="")]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is False
        assert "boom" in results[0].detail

    async def test_tool_called_passes(self):
        run = _make_run(tools_used=["csv_ticket_stats", "csv_list_tickets"])
        criteria = [SuccessCriteria(type=CriteriaType.TOOL_CALLED, value="csv_ticket_stats")]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is True

    async def test_tool_called_fails(self):
        run = _make_run(tools_used=["csv_list_tickets"])
        criteria = [SuccessCriteria(type=CriteriaType.TOOL_CALLED, value="csv_ticket_stats")]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is False

    async def test_output_contains_case_insensitive(self):
        run = _make_run(output="Total tickets: 42")
        criteria = [SuccessCriteria(type=CriteriaType.OUTPUT_CONTAINS, value="total tickets")]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is True

    async def test_output_contains_fails(self):
        run = _make_run(output="No data found")
        criteria = [SuccessCriteria(type=CriteriaType.OUTPUT_CONTAINS, value="total tickets")]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is False

    async def test_llm_judge_requires_llm(self):
        run = _make_run()
        criteria = [SuccessCriteria(type=CriteriaType.LLM_JUDGE, value="Is this good?")]
        with pytest.raises(ValueError, match="llm_judge criteria require an LLM"):
            await evaluate_run(run, criteria, llm=None)

    async def test_multiple_criteria(self):
        run = _make_run(
            status="completed",
            output="total=42",
            tools_used=["csv_ticket_stats"],
        )
        criteria = [
            SuccessCriteria(type=CriteriaType.NO_ERROR, value=""),
            SuccessCriteria(type=CriteriaType.TOOL_CALLED, value="csv_ticket_stats"),
            SuccessCriteria(type=CriteriaType.OUTPUT_CONTAINS, value="total="),
        ]
        results = await evaluate_run(run, criteria)
        assert all(r.passed for r in results)
        assert compute_score(results) == 1.0

    async def test_unknown_criteria_type_fails(self):
        run = _make_run()
        criteria = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        criteria.type = "unknown_type"  # type: ignore
        results = await evaluate_run(run, [criteria])
        assert results[0].passed is False
        assert "Unknown" in results[0].detail

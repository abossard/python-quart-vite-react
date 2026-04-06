"""Tests for evaluator — the evaluate_run action and compute_score calculation."""

import pytest

from agent_builder.evaluator import compute_score, evaluate_run
from agent_builder.models import (
    AgentRun,
    CriteriaResult,
    CriteriaType,
    SuccessCriteria,
)


def _make_run(*, status="completed", output="Hello world", tools_used=None, error=None):
    run = AgentRun(agent_id="test", input_prompt="test")
    run.status = status
    run.output = output
    if tools_used:
        run.tools_used = tools_used
    run.error = error
    return run


# ---------------------------------------------------------------------------
# evaluate_run — criteria evaluation (the valuable tests)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestEvaluateRun:
    @pytest.mark.parametrize("criteria_type, value, run_kwargs, expected_pass", [
        # no_error
        (CriteriaType.NO_ERROR, "", {"status": "completed"}, True),
        (CriteriaType.NO_ERROR, "", {"status": "failed", "error": "boom"}, False),
        # tool_called
        (CriteriaType.TOOL_CALLED, "csv_ticket_stats", {"tools_used": ["csv_ticket_stats"]}, True),
        (CriteriaType.TOOL_CALLED, "csv_ticket_stats", {"tools_used": ["csv_list_tickets"]}, False),
        # output_contains (case-insensitive)
        (CriteriaType.OUTPUT_CONTAINS, "total tickets", {"output": "Total tickets: 42"}, True),
        (CriteriaType.OUTPUT_CONTAINS, "total tickets", {"output": "No data found"}, False),
    ])
    async def test_single_criterion(self, criteria_type, value, run_kwargs, expected_pass):
        run = _make_run(**run_kwargs)
        criteria = [SuccessCriteria(type=criteria_type, value=value)]
        results = await evaluate_run(run, criteria)
        assert results[0].passed is expected_pass

    async def test_multiple_criteria_all_pass(self):
        run = _make_run(status="completed", output="total=42", tools_used=["csv_ticket_stats"])
        criteria = [
            SuccessCriteria(type=CriteriaType.NO_ERROR, value=""),
            SuccessCriteria(type=CriteriaType.TOOL_CALLED, value="csv_ticket_stats"),
            SuccessCriteria(type=CriteriaType.OUTPUT_CONTAINS, value="total="),
        ]
        results = await evaluate_run(run, criteria)
        assert all(r.passed for r in results)
        assert compute_score(results) == 1.0

    async def test_llm_judge_requires_llm(self):
        run = _make_run()
        criteria = [SuccessCriteria(type=CriteriaType.LLM_JUDGE, value="Is this good?")]
        with pytest.raises(ValueError, match="llm_judge criteria require an LLM"):
            await evaluate_run(run, criteria, llm=None)

"""
Agent Workbench - Evaluator

Applies SuccessCriteria to a completed AgentRun and produces CriteriaResult list.

Supported criteria types:
  no_error      - run completed without an error
  tool_called   - a specific tool name appears in tools_used
  output_contains - final output contains the substring (case-insensitive)
  llm_judge     - the LLM grades the output via a judge prompt (requires LLM configuration)
"""

from typing import Any

from .models import AgentRun, CriteriaResult, CriteriaType, SuccessCriteria

# ============================================================================
# ASYNC LLM JUDGE (I/O)
# ============================================================================

async def _eval_llm_judge(
    run: AgentRun,
    criteria: SuccessCriteria,
    llm: Any,  # ChatOpenAI or compatible
) -> CriteriaResult:
    """
    Ask an LLM to evaluate whether the run output satisfies the judge prompt.

    The criteria.value is a judge prompt that is appended with the run's
    output. The LLM must respond with PASS or FAIL (case-insensitive) as
    the first word.
    """
    if llm is None:
        raise ValueError("llm_judge criteria require an LLM instance")

    judge_prompt = (
        f"{criteria.value}\n\n"
        f"--- Agent Output ---\n{run.output or '(empty)'}\n\n"
        "Reply with a single word: PASS or FAIL, followed by an optional explanation."
    )

    try:
        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([HumanMessage(content=judge_prompt)])
        answer = (response.content or "").strip()
        passed = answer.upper().startswith("PASS")
        return CriteriaResult(
            criteria=criteria,
            passed=passed,
            detail=answer[:500],
        )
    except Exception as exc:
        return CriteriaResult(
            criteria=criteria,
            passed=False,
            detail=f"LLM judge error: {exc}",
        )


# ============================================================================
# PUBLIC EVALUATOR
# ============================================================================

async def evaluate_run(
    run: AgentRun,
    criteria_list: list[SuccessCriteria],
    llm: Any = None,
) -> list[CriteriaResult]:
    """
    Evaluate all criteria for a run.

    Args:
        run: Completed AgentRun (status = completed | failed).
        criteria_list: List of SuccessCriteria from the AgentDefinition.
        llm: Optional LLM instance; required when criteria include llm_judge.

    Returns:
        Ordered list of CriteriaResult, one per criterion.
    """
    results: list[CriteriaResult] = []

    for criteria in criteria_list:
        if criteria.type == CriteriaType.NO_ERROR:
            passed = run.error is None and run.status == "completed"
            results.append(
                CriteriaResult(
                    criteria=criteria,
                    passed=passed,
                    detail="" if passed else f"Run error: {run.error or 'unexpected status ' + run.status}",
                )
            )
        elif criteria.type == CriteriaType.TOOL_CALLED:
            tool_name = criteria.value.strip()
            results.append(
                CriteriaResult(
                    criteria=criteria,
                    passed=tool_name in run.tools_used,
                    detail=f"tools_used={run.tools_used}",
                )
            )
        elif criteria.type == CriteriaType.OUTPUT_CONTAINS:
            needle = criteria.value
            haystack = (run.output or "").lower()
            results.append(
                CriteriaResult(
                    criteria=criteria,
                    passed=needle.lower() in haystack,
                    detail=f"searched for '{needle}' in output ({len(run.output or '')} chars)",
                )
            )
        elif criteria.type == CriteriaType.LLM_JUDGE:
            results.append(await _eval_llm_judge(run, criteria, llm))
        else:
            results.append(CriteriaResult(
                criteria=criteria,
                passed=False,
                detail=f"Unknown criteria type: {criteria.type}",
            ))

    return results


def compute_score(results: list[CriteriaResult]) -> float:
    """Returns the fraction of passed criteria (0.0 when no criteria)."""
    if not results:
        return 1.0  # vacuously true
    passed = sum(1 for r in results if r.passed)
    return round(passed / len(results), 4)

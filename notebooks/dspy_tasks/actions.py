"""
ACTIONS — Run DSPy tasks, evaluate, and optimize.

Uses whatever LM is already configured via dspy.configure() at notebook level.
Action functions never reconfigure the model — that happens once at startup.
"""
import time
import dspy
from typing import Optional

from .tasks import get_task, list_tasks, PlaygroundTask
from .visualize import RunResult, OptimizationResult, ComparisonResult


# ============================================================================
# ACTIONS: Run tasks
# ============================================================================

def run_baseline(task_id: str, *, max_eval: Optional[int] = None) -> RunResult:
    """Run a task with zero-shot on the currently configured model."""
    task = get_task(task_id)
    module = task.make_module()
    _, devset = task.split_examples()
    if max_eval:
        devset = devset[:max_eval]

    start = time.time()
    individual = _evaluate_examples(module, devset, task.metric_fn)
    elapsed = time.time() - start

    return RunResult(
        task_id=task_id,
        model=_current_model(),
        score=_mean([r["score"] for r in individual]),
        individual_scores=individual,
        prompt_used="",
        elapsed_seconds=round(elapsed, 2),
        llm_calls=len(individual),
    )


def run_with_prompt(task_id: str, instructions: str, *, max_eval: Optional[int] = None) -> RunResult:
    """Run a task with custom user-written instructions."""
    task = get_task(task_id)
    CustomSig = _make_signature(task.signature_class, instructions)

    module = dspy.Predict(CustomSig)
    _, devset = task.split_examples()
    if max_eval:
        devset = devset[:max_eval]

    start = time.time()
    individual = _evaluate_examples(module, devset, task.metric_fn)
    elapsed = time.time() - start

    return RunResult(
        task_id=task_id,
        model=_current_model(),
        score=_mean([r["score"] for r in individual]),
        individual_scores=individual,
        prompt_used=instructions,
        elapsed_seconds=round(elapsed, 2),
        llm_calls=len(individual),
    )


def run_on_examples(examples, instructions: str, signature_class, metric_fn) -> RunResult:
    """Run custom instructions on a specific set of examples (e.g. benchmarks)."""
    CustomSig = _make_signature(signature_class, instructions)
    module = dspy.Predict(CustomSig)

    start = time.time()
    individual = _evaluate_examples(module, examples, metric_fn)
    elapsed = time.time() - start

    return RunResult(
        task_id="custom",
        model=_current_model(),
        score=_mean([r["score"] for r in individual]),
        individual_scores=individual,
        prompt_used=instructions,
        elapsed_seconds=round(elapsed, 2),
        llm_calls=len(individual),
    )


def run_optimization(task_id: str, optimizer: str = "BootstrapFewShot", *, max_eval: Optional[int] = None) -> OptimizationResult:
    """Optimize a task's prompt, then evaluate. Takes 10-60 seconds."""
    task = get_task(task_id)
    trainset, devset = task.split_examples()
    if max_eval:
        devset = devset[:max_eval]

    # Baseline
    module = task.make_module()
    baseline_results = _evaluate_examples(module, devset, task.metric_fn)
    baseline_score = _mean([r["score"] for r in baseline_results])

    # Optimize
    module_fresh = task.make_module()
    start = time.time()
    if optimizer == "MIPROv2":
        opt = dspy.MIPROv2(metric=task.metric_fn, auto="light")
    else:
        opt = dspy.BootstrapFewShot(metric=task.metric_fn, max_bootstrapped_demos=4, max_labeled_demos=8)
    optimized_module = opt.compile(module_fresh, trainset=trainset)
    opt_elapsed = time.time() - start

    # Evaluate optimized
    opt_results = _evaluate_examples(optimized_module, devset, task.metric_fn)
    opt_score = _mean([r["score"] for r in opt_results])
    improvement = opt_score - baseline_score

    return OptimizationResult(
        task_id=task_id,
        model=_current_model(),
        optimizer=optimizer,
        baseline_score=baseline_score,
        optimized_score=opt_score,
        improvement=improvement,
        improvement_pct=(improvement / max(baseline_score, 0.01)) * 100,
        prompt_before="(zero-shot)",
        prompt_after=str(optimized_module.dump_state()) if hasattr(optimized_module, 'dump_state') else "(optimized)",
        trial_scores=[baseline_score, opt_score],
        elapsed_seconds=round(opt_elapsed, 2),
        llm_calls=len(baseline_results) + len(opt_results),
    )


# ============================================================================
# INTERNAL HELPERS
# ============================================================================

def _current_model() -> str:
    lm = dspy.settings.lm
    return str(getattr(lm, 'model', '?')) if lm else '?'


def _make_signature(base_sig, instructions: str):
    fields = {}
    for name, field_info in base_sig.model_fields.items():
        fields[name] = (field_info.annotation, field_info)
    return type("CustomSig", (dspy.Signature,), {
        "__doc__": instructions,
        "__annotations__": {n: f[0] for n, f in fields.items()},
        **{n: f[1] for n, f in fields.items()},
    })


def _evaluate_examples(module, examples, metric_fn) -> list[dict]:
    results = []
    for ex in examples:
        try:
            input_kwargs = {k: ex[k] for k in ex.inputs().keys()}
            prediction = module(**input_kwargs)
            score = float(metric_fn(ex, prediction) or 0.0)
            input_str = " | ".join(f"{k}={str(v)}" for k, v in input_kwargs.items())
            expected_fields = {k: str(ex[k]) for k in ex.keys() if k not in ex.inputs()}
            predicted_fields = {k: str(getattr(prediction, k, "")) for k in expected_fields}
            results.append({"input": input_str, "expected": expected_fields, "predicted": predicted_fields, "score": score})
        except Exception as e:
            results.append({"input": str({k: str(ex[k])[:50] for k in ex.inputs().keys()}), "expected": "N/A", "predicted": f"ERROR: {e}", "score": 0.0})
    return results


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0

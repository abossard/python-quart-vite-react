"""
ACTIONS — Run DSPy tasks, evaluate, and optimize.

Following Grokking Simplicity: these are ACTIONS (I/O / side effects).
They call LLMs, measure time, and produce results with observable effects.

Pure data flows in (tasks, model names) → results flow out (RunResult, etc.)
"""
import time
import dspy
from dataclasses import asdict
from typing import Optional

from .config import configure_dspy
from .tasks import get_task, list_tasks, PlaygroundTask
from .visualize import RunResult, OptimizationResult, ComparisonResult


# ============================================================================
# ACTIONS: Run tasks on models
# ============================================================================

def run_baseline(
    task_id: str,
    model: str,
    *,
    train_ratio: float = 0.7,
    max_eval: Optional[int] = None,
) -> RunResult:
    """Run a task with zero-shot (no optimization) on a specific model.

    ACTION: makes LLM API calls, measures wall-clock time.
    """
    task = get_task(task_id)

    lm = configure_dspy(model)

    module = task.make_module()
    _, devset = task.split_examples(train_ratio)
    if max_eval:
        devset = devset[:max_eval]

    start = time.time()
    individual = _evaluate_examples(module, devset, task.metric_fn)
    elapsed = time.time() - start

    score = _mean([r["score"] for r in individual])

    prompt_used = ""
    if hasattr(lm, "history") and lm.history:
        last = lm.history[-1]
        if isinstance(last, dict):
            prompt_used = str(last.get("prompt", last.get("messages", "")))
        else:
            prompt_used = str(last)

    return RunResult(
        task_id=task_id,
        model=model,
        score=score,
        individual_scores=individual,
        prompt_used=prompt_used,
        elapsed_seconds=round(elapsed, 2),
        llm_calls=len(lm.history) if hasattr(lm, "history") else 0,
    )


def run_optimization(
    task_id: str,
    model: str,
    optimizer: str = "BootstrapFewShot",
    *,
    train_ratio: float = 0.7,
    max_eval: Optional[int] = None,
    on_progress: Optional[callable] = None,
) -> OptimizationResult:
    """Optimize a task's prompt using DSPy, then evaluate.

    ACTION: makes many LLM API calls, takes 10-60 seconds.

    Args:
        on_progress: optional callback(trial_index, score) for live updates
    """
    task = get_task(task_id)

    lm = configure_dspy(model)

    # --- Baseline ---
    module_baseline = task.make_module()
    trainset, devset = task.split_examples(train_ratio)
    if max_eval:
        devset = devset[:max_eval]

    baseline_results = _evaluate_examples(module_baseline, devset, task.metric_fn)
    baseline_score = _mean([r["score"] for r in baseline_results])

    prompt_before = ""
    if hasattr(lm, "history") and lm.history:
        last = lm.history[-1]
        prompt_before = str(last.get("prompt", last.get("messages", ""))) if isinstance(last, dict) else str(last)

    # --- Optimize ---
    module_fresh = task.make_module()
    start = time.time()

    if optimizer == "MIPROv2":
        opt = dspy.MIPROv2(
            metric=task.metric_fn,
            auto="light",
        )
    else:
        opt = dspy.BootstrapFewShot(
            metric=task.metric_fn,
            max_bootstrapped_demos=4,
            max_labeled_demos=8,
        )

    optimized_module = opt.compile(module_fresh, trainset=trainset)
    opt_elapsed = time.time() - start

    # --- Evaluate optimized ---
    lm_before_eval = len(lm.history) if hasattr(lm, "history") else 0
    opt_results = _evaluate_examples(optimized_module, devset, task.metric_fn)
    opt_score = _mean([r["score"] for r in opt_results])

    prompt_after = ""
    if hasattr(lm, "history") and lm.history:
        last = lm.history[-1]
        prompt_after = str(last.get("prompt", last.get("messages", ""))) if isinstance(last, dict) else str(last)

    total_calls = len(lm.history) if hasattr(lm, "history") else 0
    improvement = opt_score - baseline_score

    return OptimizationResult(
        task_id=task_id,
        model=model,
        optimizer=optimizer,
        baseline_score=baseline_score,
        optimized_score=opt_score,
        improvement=improvement,
        improvement_pct=(improvement / max(baseline_score, 0.01)) * 100,
        prompt_before=prompt_before,
        prompt_after=prompt_after,
        trial_scores=[baseline_score, opt_score],
        elapsed_seconds=round(opt_elapsed, 2),
        llm_calls=total_calls,
    )


def compare_models(
    task_id: str,
    models: list[str],
    *,
    optimize: bool = True,
    train_ratio: float = 0.7,
    max_eval: Optional[int] = None,
) -> ComparisonResult:
    """Run the same task across multiple models, optionally with optimization.

    ACTION: makes LLM calls for each model. Can be slow with many models.
    """
    task = get_task(task_id)
    baselines = {}
    optimized_scores = {}
    improvements = {}

    for model_name in models:
        lm = configure_dspy(model_name)

        module = task.make_module()
        trainset, devset = task.split_examples(train_ratio)
        if max_eval:
            devset = devset[:max_eval]

        # Baseline
        base_results = _evaluate_examples(module, devset, task.metric_fn)
        base_score = _mean([r["score"] for r in base_results])
        baselines[model_name] = base_score

        if optimize:
            module_fresh = task.make_module()
            opt = dspy.BootstrapFewShot(
                metric=task.metric_fn,
                max_bootstrapped_demos=4,
                max_labeled_demos=8,
            )
            opt_module = opt.compile(module_fresh, trainset=trainset)
            opt_results = _evaluate_examples(opt_module, devset, task.metric_fn)
            opt_score = _mean([r["score"] for r in opt_results])
            optimized_scores[model_name] = opt_score
            improvements[model_name] = opt_score - base_score
        else:
            optimized_scores[model_name] = base_score
            improvements[model_name] = 0.0

    return ComparisonResult(
        task_id=task_id,
        models=models,
        baseline_scores=baselines,
        optimized_scores=optimized_scores,
        improvements=improvements,
    )


# ============================================================================
# INTERNAL HELPERS
# ============================================================================

def _evaluate_examples(
    module: dspy.Module,
    examples: list[dspy.Example],
    metric_fn: callable,
) -> list[dict]:
    """Run module on each example and score with metric. Returns per-example results."""
    results = []
    for ex in examples:
        try:
            input_kwargs = {k: ex[k] for k in ex.inputs().keys()}
            prediction = module(**input_kwargs)

            score = metric_fn(ex, prediction)
            score = float(score) if score is not None else 0.0

            # Extract fields for display
            input_str = " | ".join(f"{k}={str(v)[:80]}" for k, v in input_kwargs.items())
            expected_fields = {k: str(ex[k])[:80] for k in ex.keys() if k not in ex.inputs()}
            predicted_fields = {k: str(getattr(prediction, k, ""))[:80] for k in expected_fields}

            results.append({
                "input": input_str,
                "expected": str(expected_fields),
                "predicted": str(predicted_fields),
                "score": score,
            })
        except Exception as e:
            input_str = str({k: str(ex[k])[:50] for k in ex.inputs().keys()})
            results.append({
                "input": input_str,
                "expected": "N/A",
                "predicted": f"ERROR: {e}",
                "score": 0.0,
            })
    return results


def _mean(values: list[float]) -> float:
    """Safe mean calculation."""
    return sum(values) / len(values) if values else 0.0

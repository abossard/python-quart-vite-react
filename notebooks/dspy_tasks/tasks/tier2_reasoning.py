"""
Tier 2: Reasoning — "Can the model think?"

Tasks 6-10: Tasks requiring multi-step reasoning, logic, and code generation.
ChainOfThought modules are used here to enable step-by-step reasoning.
"""
from .tier1_basics import PlaygroundTask
from ..data import (
    SolveMath, LogicalDeduction, GenerateCode, CompleteAnalogy, VerifyFact,
)


# ---------------------------------------------------------------------------
# Tier 2 task definitions
# ---------------------------------------------------------------------------

TIER_2_TASKS = [
    PlaygroundTask(
        id="math_word",
        name="Math Word Problems",
        tier=2,
        difficulty="medium",
        description="Solve math word problems with numeric answers.",
        teaching_point="ChainOfThought dramatically improves reasoning — DSPy adds it automatically.",
        signature_class=SolveMath,
        dataset_file="math_word_problems.json",
        input_fields=("question",),
        metric_id="math_word",
        module_type="ChainOfThought",
        default_prompt="Solve this math problem.",
    ),
    PlaygroundTask(
        id="logical_deduction",
        name="Logical Deduction",
        tier=2,
        difficulty="medium",
        description="Derive logical conclusions from a set of premises.",
        teaching_point="Requires reasoning chains; prompt structure matters enormously.",
        signature_class=LogicalDeduction,
        dataset_file="logical_deduction.json",
        input_fields=("premises", "question"),
        metric_id="logical_deduction",
        module_type="ChainOfThought",
        default_prompt="What can you conclude from these premises?",
    ),
    PlaygroundTask(
        id="code_generation",
        name="Code Generation",
        tier=2,
        difficulty="medium",
        description="Generate working Python code from natural-language descriptions.",
        teaching_point="Functional correctness is testable — optimization finds better instructions.",
        signature_class=GenerateCode,
        dataset_file="code_generation.json",
        input_fields=("description",),
        metric_id="code_generation",
        module_type="ChainOfThought",
        default_prompt="Write Python code for this.",
    ),
    PlaygroundTask(
        id="analogy",
        name="Analogy Completion",
        tier=2,
        difficulty="medium",
        description="Complete analogies of the form 'A is to B as C is to ___'.",
        teaching_point="Abstract reasoning reveals true model capability gaps.",
        signature_class=CompleteAnalogy,
        dataset_file="analogy.json",
        input_fields=("analogy_prompt",),
        metric_id="analogy",
        module_type="Predict",
        default_prompt="Complete this analogy.",
    ),
    PlaygroundTask(
        id="fact_verification",
        name="Fact Verification",
        tier=2,
        difficulty="medium",
        description="Verify whether a factual claim is supported, refuted, or has insufficient evidence.",
        teaching_point="Evaluation = trustworthiness. Without metrics, you're guessing.",
        signature_class=VerifyFact,
        dataset_file="fact_verification.json",
        input_fields=("claim", "context"),
        metric_id="fact_verification",
        module_type="ChainOfThought",
        default_prompt="Is this claim true based on the context?",
    ),
]

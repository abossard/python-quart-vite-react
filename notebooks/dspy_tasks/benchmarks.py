"""
Benchmark dataset loaders — validated industry-standard datasets.

These are real benchmarks used by the AI research community to evaluate LLMs.
They prove that evaluation gaps aren't made up — they're measurable and well-documented.

Available datasets:
- HotPotQA: Multi-hop factual questions (requires combining multiple facts)
- MATH/PreAlgebra: Grade-school math reasoning
- TruthfulQA: Questions designed to catch hallucinations (bundled JSON)
"""
import json
from pathlib import Path
from typing import Optional

import dspy

DATASETS_DIR = Path(__file__).parent.parent / "datasets"


def load_hotpotqa(n: int = 20) -> list[dspy.Example]:
    """Load HotPotQA multi-hop QA examples from HuggingFace.

    These questions require combining information from multiple sources.
    A great demo of where LLMs struggle with complex reasoning.
    """
    from dspy.datasets import HotPotQA
    ds = HotPotQA(train_size=0, dev_size=min(n, 200), test_size=0)
    return [ex.with_inputs("question") for ex in ds.dev[:n]]


def load_math(n: int = 20) -> list[dspy.Example]:
    """Load PreAlgebra math problems from the MATH benchmark.

    Grade-school level math — but LLMs still get many wrong!
    """
    from dspy.datasets import MATH
    ds = MATH(subset="prealgebra")
    examples = ds.dev[:n]
    return [ex.with_inputs("question") for ex in examples]


def load_truthfulqa(n: Optional[int] = None) -> list[dspy.Example]:
    """Load TruthfulQA examples from bundled JSON.

    Questions specifically designed to catch common LLM hallucinations
    and misconceptions. No internet download needed.
    """
    path = DATASETS_DIR / "truthfulqa_sample.json"
    with open(path) as f:
        raw = json.load(f)
    examples = [
        dspy.Example(question=item["question"], answer=item["answer"]).with_inputs("question")
        for item in raw
    ]
    return examples[:n] if n else examples


# Simple metrics for benchmark evaluation
def exact_match(example, prediction, trace=None) -> float:
    """Exact string match (normalized)."""
    gold = str(example.answer).strip().lower()
    pred = str(prediction.answer).strip().lower()
    return float(gold == pred)


def contains_match(example, prediction, trace=None) -> float:
    """Check if gold answer is contained in prediction."""
    gold = str(example.answer).strip().lower()
    pred = str(prediction.answer).strip().lower()
    return float(gold in pred or pred in gold)

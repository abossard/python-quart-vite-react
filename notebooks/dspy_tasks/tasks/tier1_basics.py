"""
Tier 1: Fundamentals — "Can the model follow instructions?"

Tasks 1-5: Simple classification, extraction, and formatting tasks.
These are DATA declarations following Grokking Simplicity.
"""
from dataclasses import dataclass, field
from typing import Callable, Optional
import dspy

from ..data import (
    ClassifySentiment, ExtractEntities, SummarizeText, TranslateEnDe, FormatData,
    load_dataset, split_dataset,
)
from ..calculations import METRIC_REGISTRY


@dataclass(frozen=True)
class PlaygroundTask:
    """A single DSPy playground task definition. Pure data, no behavior."""
    id: str
    name: str
    tier: int
    difficulty: str  # "easy", "medium", "hard", "agentic"
    description: str
    teaching_point: str
    signature_class: type  # dspy.Signature subclass
    dataset_file: str  # filename in datasets/
    input_fields: tuple[str, ...]  # which fields are inputs
    metric_id: str  # key in METRIC_REGISTRY
    module_type: str = "Predict"  # "Predict", "ChainOfThought", "ReAct"
    tools: tuple[str, ...] = ()  # tool function names for ReAct
    default_prompt: str = ""  # naive hand-written prompt for comparison

    @property
    def metric_fn(self) -> Callable:
        return METRIC_REGISTRY[self.metric_id]

    def make_module(self) -> dspy.Module:
        """Create a fresh DSPy module for this task."""
        if self.module_type == "ChainOfThought":
            return dspy.ChainOfThought(self.signature_class)
        elif self.module_type == "ReAct":
            from ..tools import TOOL_REGISTRY
            tool_fns = [TOOL_REGISTRY[t] for t in self.tools]
            return dspy.ReAct(self.signature_class, tools=tool_fns)
        else:
            return dspy.Predict(self.signature_class)

    def load_examples(self) -> list:
        return load_dataset(self.dataset_file, list(self.input_fields))

    def split_examples(self, train_ratio=0.7):
        return split_dataset(self.load_examples(), train_ratio)


# ---------------------------------------------------------------------------
# Tier 1 task definitions
# ---------------------------------------------------------------------------

TIER_1_TASKS = [
    PlaygroundTask(
        id="sentiment",
        name="Sentiment Classification",
        tier=1,
        difficulty="easy",
        description="Classify product reviews as positive, negative, or neutral.",
        teaching_point="Even simple classification benefits from tuned examples and instructions.",
        signature_class=ClassifySentiment,
        dataset_file="sentiment.json",
        input_fields=("review",),
        metric_id="sentiment",
        module_type="Predict",
        default_prompt="Tell me if this review is positive or negative.",
    ),
    PlaygroundTask(
        id="entities",
        name="Entity Extraction",
        tier=1,
        difficulty="easy",
        description="Extract named entities (people, organizations, locations) from text.",
        teaching_point="Structured output parsing is where smaller models struggle most — tuning helps enormously.",
        signature_class=ExtractEntities,
        dataset_file="entities.json",
        input_fields=("sentence",),
        metric_id="entities",
        module_type="Predict",
        default_prompt="List the entities in this sentence.",
    ),
    PlaygroundTask(
        id="summarization",
        name="Text Summarization",
        tier=1,
        difficulty="easy",
        description="Summarize articles into concise 1-2 sentence summaries.",
        teaching_point="Quality vs. verbosity is a tradeoff that metrics can capture but humans often miss.",
        signature_class=SummarizeText,
        dataset_file="summarization.json",
        input_fields=("article",),
        metric_id="summarization",
        module_type="Predict",
        default_prompt="Summarize this text.",
    ),
    PlaygroundTask(
        id="translation",
        name="English → German Translation",
        tier=1,
        difficulty="easy",
        description="Translate English text to German.",
        teaching_point="Model differences are starkest in translation — tuning helps smaller models catch up.",
        signature_class=TranslateEnDe,
        dataset_file="translation_en_de.json",
        input_fields=("english_text",),
        metric_id="translation",
        module_type="Predict",
        default_prompt="Translate this to German.",
    ),
    PlaygroundTask(
        id="format_compliance",
        name="Format Compliance",
        tier=1,
        difficulty="easy",
        description="Convert raw data into specific formats (ISO date, JSON, CSV, etc.).",
        teaching_point="Reliability matters more than 'good enough' — format compliance is binary.",
        signature_class=FormatData,
        dataset_file="format_compliance.json",
        input_fields=("raw_data", "target_format"),
        metric_id="format_compliance",
        module_type="Predict",
        default_prompt="Format this data as requested.",
    ),
]

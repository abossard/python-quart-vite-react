"""DSPy task signatures and dataset utilities.

DATA layer following Grokking Simplicity — pure data declarations,
no I/O beyond file reads.
"""

import dspy
from pathlib import Path
import json
from typing import Optional


# ---------------------------------------------------------------------------
# Tier 1 — Basics
# ---------------------------------------------------------------------------

class ClassifySentiment(dspy.Signature):
    """Classify the sentiment of a product review."""

    review: str = dspy.InputField(desc="A product review to classify")
    sentiment: str = dspy.OutputField(desc="Sentiment: positive, negative, or neutral")


class ExtractEntities(dspy.Signature):
    """Extract named entities from a sentence."""

    sentence: str = dspy.InputField(desc="A sentence containing named entities")
    entities: str = dspy.OutputField(desc="Comma-separated list of entities found in the sentence")


class SummarizeText(dspy.Signature):
    """Produce a concise summary of an article."""

    article: str = dspy.InputField(desc="The full article text to summarize")
    summary: str = dspy.OutputField(desc="Concise summary, max 2 sentences")


class TranslateEnDe(dspy.Signature):
    """Translate English text to German."""

    english_text: str = dspy.InputField(desc="English text to translate")
    german_text: str = dspy.OutputField(desc="German translation of the input text")


class FormatData(dspy.Signature):
    """Reformat raw data into a specified target format."""

    raw_data: str = dspy.InputField(desc="Raw unstructured or semi-structured data")
    target_format: str = dspy.InputField(desc="Desired output format (e.g. JSON, CSV, Markdown table)")
    formatted_output: str = dspy.OutputField(desc="Data reformatted into the target format")


# ---------------------------------------------------------------------------
# Tier 2 — Reasoning
# ---------------------------------------------------------------------------

class SolveMath(dspy.Signature):
    """Solve a math word problem and return the numeric answer."""

    question: str = dspy.InputField(desc="A math word problem")
    answer: str = dspy.OutputField(desc="Just the number — no units or explanation")


class LogicalDeduction(dspy.Signature):
    """Derive a logical conclusion from given premises."""

    premises: str = dspy.InputField(desc="One or more logical premises")
    question: str = dspy.InputField(desc="The question to answer based on the premises")
    conclusion: str = dspy.OutputField(desc="The derived conclusion")
    is_valid: str = dspy.OutputField(desc="Whether the deduction is logically valid: true or false")


class GenerateCode(dspy.Signature):
    """Generate working Python code from a natural-language description."""

    description: str = dspy.InputField(desc="Natural-language description of the desired program")
    python_code: str = dspy.OutputField(desc="Working Python code that implements the description")


class CompleteAnalogy(dspy.Signature):
    """Complete an analogy of the form A is to B as C is to ___."""

    analogy_prompt: str = dspy.InputField(desc="An analogy prompt with a blank to fill")
    answer: str = dspy.OutputField(desc="Single word or short phrase that completes the analogy")


class VerifyFact(dspy.Signature):
    """Verify whether a factual claim is supported by the given context."""

    claim: str = dspy.InputField(desc="A factual claim to verify")
    context: str = dspy.InputField(desc="Reference text to check the claim against")
    verdict: str = dspy.OutputField(desc="Verdict: supported, refuted, or insufficient")
    reasoning: str = dspy.OutputField(desc="Explanation of why the verdict was reached")


# ---------------------------------------------------------------------------
# Tier 3 — Composition
# ---------------------------------------------------------------------------

class MultiHopQA(dspy.Signature):
    """Answer a question that requires reasoning over multiple pieces of evidence."""

    question: str = dspy.InputField(desc="A question requiring multi-hop reasoning")
    context: str = dspy.InputField(desc="Supporting passages or evidence")
    answer: str = dspy.OutputField(desc="The final answer")
    reasoning_chain: str = dspy.OutputField(desc="Step-by-step reasoning connecting evidence to the answer")


class ClassifyTicket(dspy.Signature):
    """Classify an IT support ticket by category, priority, and assignment."""

    summary: str = dspy.InputField(desc="Short summary of the support ticket")
    category: str = dspy.OutputField(desc="Ticket category (e.g. Hardware, Software, Network, Access)")
    priority: str = dspy.OutputField(desc="Priority level: Critical, High, Medium, or Low")
    assigned_group: str = dspy.OutputField(desc="Support group the ticket should be assigned to")


class GenerateReport(dspy.Signature):
    """Generate a structured report from data points."""

    data_points: str = dspy.InputField(desc="Raw data points to include in the report")
    report_type: str = dspy.InputField(desc="Type of report to generate (e.g. executive summary, detailed analysis)")
    report: str = dspy.OutputField(desc="Structured report text")


class ComparativeAnalysis(dspy.Signature):
    """Compare two items along given criteria and make a recommendation."""

    item_a: str = dspy.InputField(desc="Description of the first item to compare")
    item_b: str = dspy.InputField(desc="Description of the second item to compare")
    criteria: str = dspy.InputField(desc="Criteria to evaluate (e.g. cost, performance, ease of use)")
    comparison: str = dspy.OutputField(desc="Detailed comparison of the two items across the criteria")
    recommendation: str = dspy.OutputField(desc="Which item is recommended and why")


class FollowInstructions(dspy.Signature):
    """Complete a task while satisfying a set of explicit constraints."""

    task: str = dspy.InputField(desc="The task to complete")
    constraints: str = dspy.InputField(desc="Constraints that must be satisfied")
    output: str = dspy.OutputField(desc="Task output that adheres to the constraints")
    constraints_met: str = dspy.OutputField(desc="Comma-separated list of met constraints")


# ---------------------------------------------------------------------------
# Tier 4 — Agentic
# ---------------------------------------------------------------------------

class SolveWithCalculator(dspy.Signature):
    """Solve a numeric question using a calculator tool."""

    question: str = dspy.InputField(desc="A question requiring numeric calculation")
    answer: str = dspy.OutputField(desc="Numeric answer obtained via calculator tool")


class SearchAndSynthesize(dspy.Signature):
    """Answer a question by searching for information and synthesizing results."""

    question: str = dspy.InputField(desc="A question that requires external search")
    answer: str = dspy.OutputField(desc="Synthesized answer from search results")
    sources: str = dspy.OutputField(desc="Sources used to construct the answer")


class MultiToolTask(dspy.Signature):
    """Answer a query that may require multiple tools."""

    question: str = dspy.InputField(desc="A query that may need multiple tools to answer")
    answer: str = dspy.OutputField(desc="Final answer after using necessary tools")
    tools_used: str = dspy.OutputField(desc="Comma-separated list of tools that were used")


class PlanAndExecute(dspy.Signature):
    """Create a plan to achieve a goal, then execute it."""

    question: str = dspy.InputField(desc="The question or goal to achieve")
    answer: str = dspy.OutputField(desc="Result of executing the plan")
    plan: str = dspy.OutputField(desc="Step-by-step plan that was followed")


class SelfCorrectingTask(dspy.Signature):
    """Complete a task with built-in self-verification and correction."""

    question: str = dspy.InputField(desc="The question to answer with self-correction")
    answer: str = dspy.OutputField(desc="Verified answer after self-correction")
    confidence: str = dspy.OutputField(desc="Confidence level in the output (low, medium, high)")


# ---------------------------------------------------------------------------
# Dataset utilities
# ---------------------------------------------------------------------------

DATASETS_DIR = Path(__file__).parent.parent / "datasets"


def load_dataset(filename: str, input_fields: list[str]) -> list[dspy.Example]:
    """Load a JSON dataset file and return list of dspy.Example objects.

    Args:
        filename: JSON file name in datasets/ directory
        input_fields: Which fields are inputs (rest are outputs)
    """
    path = DATASETS_DIR / filename
    with open(path) as f:
        raw = json.load(f)
    return [dspy.Example(**item).with_inputs(*input_fields) for item in raw]


def split_dataset(
    examples: list[dspy.Example], train_ratio: float = 0.7
) -> tuple[list, list]:
    """Split dataset into train/dev sets."""
    split_idx = int(len(examples) * train_ratio)
    return examples[:split_idx], examples[split_idx:]

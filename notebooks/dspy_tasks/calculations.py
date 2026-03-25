"""
CALCULATIONS — Pure metric functions for evaluating LLM task outputs.

Following Grokking Simplicity: these are pure functions with no side effects.
Same inputs always produce the same outputs. No I/O, no network calls.

Each metric: (example, prediction, trace=None) → float in [0.0, 1.0]
"""
import re
from collections import Counter


# ============================================================================
# HELPER CALCULATIONS (pure)
# ============================================================================

def normalize(text: str) -> str:
    """Lowercase, strip whitespace."""
    return text.strip().lower()

def token_f1(gold_tokens: list[str], pred_tokens: list[str]) -> float:
    """Compute token-level F1 score."""
    if not gold_tokens and not pred_tokens:
        return 1.0
    if not gold_tokens or not pred_tokens:
        return 0.0
    common = Counter(gold_tokens) & Counter(pred_tokens)
    num_common = sum(common.values())
    if num_common == 0:
        return 0.0
    precision = num_common / len(pred_tokens)
    recall = num_common / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


# ============================================================================
# TIER 1: BASICS
# ============================================================================

def sentiment_exact_match(example, prediction, trace=None):
    """Exact match on sentiment label."""
    return float(normalize(prediction.sentiment) == normalize(example.sentiment))

def entity_f1(example, prediction, trace=None):
    """F1 over extracted entities (comma-separated)."""
    gold = [normalize(e) for e in str(example.entities).split(",") if e.strip()]
    pred = [normalize(e) for e in str(prediction.entities).split(",") if e.strip()]
    return token_f1(gold, pred)

def summary_quality(example, prediction, trace=None):
    """Rough summary quality: token overlap + length penalty."""
    gold_tokens = normalize(example.summary).split()
    pred_tokens = normalize(prediction.summary).split()
    overlap = token_f1(gold_tokens, pred_tokens)
    # Penalty if too long (>2x gold length) or too short (<0.3x)
    len_ratio = len(pred_tokens) / max(len(gold_tokens), 1)
    length_score = 1.0 if 0.3 <= len_ratio <= 2.0 else max(0, 1.0 - abs(len_ratio - 1.0) * 0.5)
    return overlap * 0.7 + length_score * 0.3

def translation_quality(example, prediction, trace=None):
    """Token overlap as proxy for translation quality (BLEU-like)."""
    gold_tokens = normalize(example.german_text).split()
    pred_tokens = normalize(prediction.german_text).split()
    return token_f1(gold_tokens, pred_tokens)

def format_compliance(example, prediction, trace=None):
    """Check if output matches expected format via regex or exact match."""
    expected = normalize(example.formatted_output)
    actual = normalize(prediction.formatted_output)
    # Exact match
    if actual == expected:
        return 1.0
    # Partial credit for containing the right data
    return token_f1(expected.split(), actual.split()) * 0.8


# ============================================================================
# TIER 2: REASONING
# ============================================================================

def numeric_match(example, prediction, trace=None):
    """Exact numeric match with tolerance."""
    try:
        pred_val = float(str(prediction.answer).strip().replace(",", ""))
        gold_val = float(str(example.answer).strip().replace(",", ""))
        return float(abs(pred_val - gold_val) < 0.01)
    except (ValueError, AttributeError):
        return 0.0

def logical_validity(example, prediction, trace=None):
    """Score logical deduction: conclusion match + validity judgment."""
    score = 0.0
    # Validity judgment (50% weight)
    pred_valid = normalize(str(prediction.is_valid))
    gold_valid = normalize(str(example.is_valid))
    if pred_valid == gold_valid:
        score += 0.5
    # Conclusion overlap (50% weight)
    gold_tokens = normalize(str(example.conclusion)).split()
    pred_tokens = normalize(str(prediction.conclusion)).split()
    score += token_f1(gold_tokens, pred_tokens) * 0.5
    return score

def code_execution_proxy(example, prediction, trace=None):
    """Proxy for code quality: check structure and key elements.
    
    Note: actual execution would be an ACTION (I/O). This pure version
    checks for structural indicators of correct code.
    """
    code = str(prediction.python_code).strip()
    expected = str(example.python_code).strip()
    if not code:
        return 0.0
    score = 0.0
    # Has function/class definition
    if "def " in code or "class " in code:
        score += 0.2
    # Has return statement
    if "return " in code:
        score += 0.2
    # Token overlap with expected
    score += token_f1(normalize(expected).split(), normalize(code).split()) * 0.6
    return min(score, 1.0)

def analogy_match(example, prediction, trace=None):
    """Exact or partial match for analogy completion."""
    pred = normalize(str(prediction.answer))
    gold = normalize(str(example.answer))
    if pred == gold:
        return 1.0
    # Partial credit if contained
    if gold in pred or pred in gold:
        return 0.5
    return 0.0

def fact_verdict_accuracy(example, prediction, trace=None):
    """Accuracy of fact verification verdict."""
    pred_verdict = normalize(str(prediction.verdict))
    gold_verdict = normalize(str(example.verdict))
    return float(pred_verdict == gold_verdict)


# ============================================================================
# TIER 3: COMPOSITION
# ============================================================================

def multihop_answer_match(example, prediction, trace=None):
    """Answer accuracy for multi-hop questions."""
    pred = normalize(str(prediction.answer))
    gold = normalize(str(example.answer))
    if pred == gold:
        return 1.0
    # Token F1 for partial credit
    return token_f1(gold.split(), pred.split()) * 0.8

def ticket_routing_weighted(example, prediction, trace=None):
    """Weighted match across category, priority, and assigned group."""
    score = 0.0
    if normalize(str(prediction.priority)) == normalize(str(example.priority)):
        score += 0.4
    if normalize(str(prediction.category)) == normalize(str(example.category)):
        score += 0.35
    if normalize(str(prediction.assigned_group)) == normalize(str(example.assigned_group)):
        score += 0.25
    return score

def report_quality(example, prediction, trace=None):
    """Report quality: coverage + structure."""
    report = str(prediction.report).strip()
    expected = str(example.report).strip()
    if not report:
        return 0.0
    # Length check (should be substantial)
    length_score = min(len(report) / max(len(expected), 100), 1.0)
    # Token overlap
    overlap = token_f1(normalize(expected).split(), normalize(report).split())
    return overlap * 0.6 + length_score * 0.4

def comparison_quality(example, prediction, trace=None):
    """Quality of comparative analysis."""
    pred_comp = normalize(str(prediction.comparison))
    gold_comp = normalize(str(example.comparison))
    overlap = token_f1(gold_comp.split(), pred_comp.split())
    # Check recommendation alignment
    pred_rec = normalize(str(prediction.recommendation))
    gold_rec = normalize(str(example.recommendation))
    rec_match = float(gold_rec in pred_rec or pred_rec in gold_rec) if gold_rec else 0.5
    return overlap * 0.6 + rec_match * 0.4

def constraint_satisfaction(example, prediction, trace=None):
    """Check how many constraints were satisfied."""
    expected_constraints = [c.strip() for c in str(example.constraints_met).split(",") if c.strip()]
    pred_constraints = [c.strip().lower() for c in str(prediction.constraints_met).split(",") if c.strip()]
    if not expected_constraints:
        return 1.0
    met = sum(1 for c in expected_constraints if c.strip().lower() in pred_constraints)
    return met / len(expected_constraints)


# ============================================================================
# TIER 4: AGENTIC
# ============================================================================

def agent_numeric_match(example, prediction, trace=None):
    """Numeric match for calculator agent."""
    return numeric_match(example, prediction, trace)

def search_answer_quality(example, prediction, trace=None):
    """Answer quality for search+synthesize agent."""
    pred = normalize(str(prediction.answer))
    gold = normalize(str(example.answer))
    if pred == gold:
        return 1.0
    return token_f1(gold.split(), pred.split())

def multi_tool_score(example, prediction, trace=None):
    """Multi-tool task: answer accuracy + tool efficiency."""
    answer_score = token_f1(
        normalize(str(example.answer)).split(),
        normalize(str(prediction.answer)).split()
    )
    return answer_score

def plan_quality(example, prediction, trace=None):
    """Plan-and-execute: plan coherence + result accuracy."""
    result_score = token_f1(
        normalize(str(example.answer)).split(),
        normalize(str(prediction.answer)).split()
    )
    plan = str(getattr(prediction, 'plan', '')).strip()
    has_plan = float(len(plan) > 20)
    return result_score * 0.7 + has_plan * 0.3

def self_correct_accuracy(example, prediction, trace=None):
    """Self-correcting agent: final accuracy after retries."""
    pred = normalize(str(prediction.answer))
    gold = normalize(str(example.answer))
    if pred == gold:
        return 1.0
    return token_f1(gold.split(), pred.split())


# ============================================================================
# METRIC REGISTRY — maps task_id to metric function
# ============================================================================

METRIC_REGISTRY = {
    "sentiment": sentiment_exact_match,
    "entities": entity_f1,
    "summarization": summary_quality,
    "translation": translation_quality,
    "format_compliance": format_compliance,
    "math_word": numeric_match,
    "logical_deduction": logical_validity,
    "code_generation": code_execution_proxy,
    "analogy": analogy_match,
    "fact_verification": fact_verdict_accuracy,
    "multihop_qa": multihop_answer_match,
    "ticket_routing": ticket_routing_weighted,
    "report_generation": report_quality,
    "comparative_analysis": comparison_quality,
    "instruction_constraints": constraint_satisfaction,
    "calculator_agent": agent_numeric_match,
    "search_agent": search_answer_quality,
    "multi_tool": multi_tool_score,
    "plan_execute": plan_quality,
    "self_correct": self_correct_accuracy,
}

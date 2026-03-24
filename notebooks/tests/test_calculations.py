"""Tests for the CALCULATIONS layer — metric functions (pure, no I/O)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from dspy_tasks.calculations import METRIC_REGISTRY, normalize, token_f1


class FakeObj:
    """Lightweight object to simulate dspy.Example / Prediction."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestHelpers:
    def test_normalize(self):
        assert normalize("  HELLO  ") == "hello"

    def test_token_f1_perfect(self):
        assert token_f1(["a", "b"], ["a", "b"]) == 1.0

    def test_token_f1_empty(self):
        assert token_f1([], []) == 1.0
        assert token_f1(["a"], []) == 0.0

    def test_token_f1_partial(self):
        score = token_f1(["a", "b", "c"], ["a", "d"])
        assert 0.0 < score < 1.0


class TestMetricRegistry:
    def test_has_20_metrics(self):
        assert len(METRIC_REGISTRY) == 20

    @pytest.mark.parametrize("task_id", list(METRIC_REGISTRY.keys()))
    def test_metric_is_callable(self, task_id):
        assert callable(METRIC_REGISTRY[task_id])


class TestTier1Metrics:
    def test_sentiment_exact_match(self):
        metric = METRIC_REGISTRY["sentiment"]
        assert metric(FakeObj(sentiment="positive"), FakeObj(sentiment="positive")) == 1.0
        assert metric(FakeObj(sentiment="positive"), FakeObj(sentiment="negative")) == 0.0
        assert metric(FakeObj(sentiment="POSITIVE"), FakeObj(sentiment="positive")) == 1.0

    def test_entity_f1(self):
        metric = METRIC_REGISTRY["entities"]
        score = metric(
            FakeObj(entities="Apple, Google"),
            FakeObj(entities="Apple, Microsoft"),
        )
        assert 0.0 < score < 1.0


class TestTier2Metrics:
    def test_numeric_match_exact(self):
        metric = METRIC_REGISTRY["math_word"]
        assert metric(FakeObj(answer="42"), FakeObj(answer="42")) == 1.0
        assert metric(FakeObj(answer="42"), FakeObj(answer="43")) == 0.0

    def test_numeric_match_tolerance(self):
        metric = METRIC_REGISTRY["math_word"]
        assert metric(FakeObj(answer="3.14"), FakeObj(answer="3.14001")) == 1.0

    def test_numeric_match_invalid(self):
        metric = METRIC_REGISTRY["math_word"]
        assert metric(FakeObj(answer="42"), FakeObj(answer="not a number")) == 0.0


class TestTier3Metrics:
    def test_ticket_routing_full_match(self):
        metric = METRIC_REGISTRY["ticket_routing"]
        score = metric(
            FakeObj(priority="High", category="Network", assigned_group="Team A"),
            FakeObj(priority="High", category="Network", assigned_group="Team A"),
        )
        assert score == 1.0

    def test_ticket_routing_partial(self):
        metric = METRIC_REGISTRY["ticket_routing"]
        score = metric(
            FakeObj(priority="High", category="Network", assigned_group="Team A"),
            FakeObj(priority="High", category="Software", assigned_group="Team B"),
        )
        assert 0.0 < score < 1.0


class TestMetricRange:
    """All metrics should return float in [0.0, 1.0]."""

    @pytest.mark.parametrize("task_id", list(METRIC_REGISTRY.keys()))
    def test_returns_float_in_range(self, task_id):
        metric = METRIC_REGISTRY[task_id]
        # Build generic fake objects with all possible fields
        fields = dict(
            sentiment="positive", entities="A, B", summary="test",
            german_text="test", formatted_output="test",
            answer="42", conclusion="yes", is_valid="true",
            python_code="def f(): return 1", verdict="supported",
            reasoning="step1", category="Network", priority="High",
            assigned_group="Team A", report="Report text here",
            comparison="A is better", recommendation="Use A",
            constraints_met="c1, c2", sources="db",
            tools_used="calc", result="done", plan="step1",
            verified_output="42", confidence="0.9",
            reasoning_chain="step1, step2",
        )
        ex = FakeObj(**fields)
        pred = FakeObj(**fields)
        score = metric(ex, pred)
        assert isinstance(score, (int, float)), f"{task_id} metric should return number"
        assert 0.0 <= float(score) <= 1.0, f"{task_id} metric returned {score}, expected [0,1]"

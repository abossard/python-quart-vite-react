"""
End-to-end tests for the DSPy Playground — runs real LLM calls via LiteLLM.

These tests hit the actual Copilot/LiteLLM backend. They verify the full
pipeline: config → DSPy module → LiteLLM → model API → metric scoring.

Run:  cd notebooks && python -m pytest tests/ -v
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import dspy
from dspy_tasks.config import configure_dspy, get_available_models, get_default_model
from dspy_tasks.tasks import get_task, list_by_tier
from dspy_tasks.actions import run_baseline, run_optimization


# ============================================================================
# Config + model discovery (live)
# ============================================================================

class TestLiveConfig:
    def test_discovers_models_from_litellm(self):
        """Model discovery should return real models from the configured provider."""
        models = get_available_models()
        assert len(models) >= 3, f"Expected at least 3 models, got {models}"

    def test_configure_dspy_creates_working_lm(self):
        """configure_dspy should produce an LM that can make a real API call."""
        lm = configure_dspy()
        result = lm("Say 'hello' and nothing else.")
        assert len(result) > 0


# ============================================================================
# Tier 1: Basic tasks — live predictions
# ============================================================================

class TestTier1Live:
    def test_sentiment_prediction(self):
        """Sentiment classifier should return a valid label on a clear review."""
        configure_dspy()
        task = get_task("sentiment")
        module = task.make_module()
        result = module(review="This product is absolutely wonderful!")
        assert result.sentiment.strip().lower() in ("positive", "negative", "neutral")

    def test_entity_extraction(self):
        """Entity extractor should find at least one entity."""
        configure_dspy()
        task = get_task("entities")
        module = task.make_module()
        result = module(sentence="Apple CEO Tim Cook announced the new iPhone in Cupertino.")
        assert len(result.entities.strip()) > 0

    def test_sentiment_baseline_scores(self):
        """Full baseline run on sentiment should produce a score > 0."""
        result = run_baseline("sentiment", get_default_model(), max_eval=5)
        assert result.score > 0.0
        assert len(result.individual_scores) == 5
        assert result.elapsed_seconds > 0


# ============================================================================
# Tier 2: Reasoning — ChainOfThought makes a difference
# ============================================================================

class TestTier2Live:
    def test_math_chain_of_thought(self):
        """ChainOfThought should produce a numeric answer for a math problem."""
        configure_dspy()
        task = get_task("math_word")
        module = task.make_module()  # ChainOfThought
        result = module(question="What is 15 * 4 + 10?")
        # Should contain a number somewhere in the answer
        assert any(c.isdigit() for c in result.answer)

    def test_math_baseline_scores(self):
        """Math baseline should run and score without errors."""
        result = run_baseline("math_word", get_default_model(), max_eval=3)
        assert result.score >= 0.0
        assert result.llm_calls > 0


# ============================================================================
# Tier 3: Composition — domain data
# ============================================================================

class TestTier3Live:
    def test_ticket_routing_prediction(self):
        """Ticket router should return category, priority, and group."""
        configure_dspy()
        task = get_task("ticket_routing")
        module = task.make_module()
        result = module(summary="VPN connection drops every 10 minutes for remote users")
        assert len(result.category.strip()) > 0
        assert len(result.priority.strip()) > 0
        assert len(result.assigned_group.strip()) > 0

    def test_ticket_routing_baseline(self):
        """Ticket routing baseline on real CSV-derived data."""
        result = run_baseline("ticket_routing", get_default_model(), max_eval=3)
        assert result.score >= 0.0
        assert len(result.individual_scores) == 3


# ============================================================================
# Optimization — the core value proposition
# ============================================================================

class TestOptimizationLive:
    def test_bootstrap_fewshot_runs(self):
        """BootstrapFewShot optimization should complete and return scores."""
        result = run_optimization(
            "sentiment",
            get_default_model(),
            "BootstrapFewShot",
            max_eval=5,
        )
        assert result.baseline_score >= 0.0
        assert result.optimized_score >= 0.0
        assert result.elapsed_seconds > 0
        assert len(result.prompt_after) > 0


# ============================================================================
# Cross-model — if multiple models available
# ============================================================================

class TestCrossModel:
    def test_same_task_different_models(self):
        """Same task should run on at least 2 different models."""
        models = get_available_models()
        # Pick two models that aren't embeddings
        chat_models = [m for m in models if "embedding" not in m.lower()][:2]
        if len(chat_models) < 2:
            pytest.skip("Need at least 2 chat models for cross-model test")

        scores = {}
        for model in chat_models:
            result = run_baseline("sentiment", model, max_eval=3)
            scores[model] = result.score

        assert len(scores) == 2
        # Both should produce some score (not crash)
        for model, score in scores.items():
            assert score >= 0.0, f"{model} produced invalid score"

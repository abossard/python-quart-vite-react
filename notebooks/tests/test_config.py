"""Tests for the CONFIG module — LiteLLM/DSPy configuration."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import dspy
from dspy_tasks.config import (
    _parse_fallback_models,
    _build_model_list,
    get_default_model,
    get_fallback_models,
    get_provider,
    get_available_models,
    get_config_summary,
    configure_dspy,
)


# ============================================================================
# Pure calculation tests
# ============================================================================

class TestParseFallbackModels:
    def test_comma_separated(self):
        assert _parse_fallback_models("a,b,c") == ["a", "b", "c"]

    def test_empty_string(self):
        assert _parse_fallback_models("") == []

    def test_whitespace_only(self):
        assert _parse_fallback_models("   ") == []

    def test_strips_whitespace(self):
        assert _parse_fallback_models(" a , b , c ") == ["a", "b", "c"]

    def test_skips_empty_segments(self):
        assert _parse_fallback_models("a,,b,,,c") == ["a", "b", "c"]

    def test_single_model(self):
        assert _parse_fallback_models("gpt-4o") == ["gpt-4o"]


class TestBuildModelList:
    def test_deduplicates(self):
        result = _build_model_list("a", ["b", "a"], ["c", "b"])
        assert result == ["a", "b", "c"]

    def test_preserves_order(self):
        result = _build_model_list("primary", ["fb1", "fb2"], ["disc1"])
        assert result == ["primary", "fb1", "fb2", "disc1"]

    def test_empty_fallbacks_and_discovered(self):
        result = _build_model_list("only", [], [])
        assert result == ["only"]

    def test_strips_whitespace(self):
        result = _build_model_list(" a ", [" b "], [" c "])
        assert result == ["a", "b", "c"]

    def test_skips_empty_strings(self):
        result = _build_model_list("a", ["", "  "], ["b"])
        assert result == ["a", "b"]

    def test_handles_non_string_gracefully(self):
        result = _build_model_list("a", [None, 123], ["b"])
        assert result == ["a", "b"]


# ============================================================================
# Config reading tests (env vars via monkeypatch)
# ============================================================================

class TestGetDefaultModel:
    def test_returns_env_var(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "openai/gpt-4")
        assert get_default_model() == "openai/gpt-4"

    def test_returns_default_when_unset(self, monkeypatch):
        monkeypatch.delenv("LITELLM_MODEL", raising=False)
        assert get_default_model() == "github_copilot/gpt-4o"


class TestGetFallbackModels:
    def test_parses_env_var(self, monkeypatch):
        monkeypatch.setenv("LITELLM_FALLBACK_MODELS", "m1,m2,m3")
        assert get_fallback_models() == ["m1", "m2", "m3"]

    def test_returns_defaults_when_unset(self, monkeypatch):
        monkeypatch.delenv("LITELLM_FALLBACK_MODELS", raising=False)
        result = get_fallback_models()
        assert len(result) == 3
        assert all("github_copilot/" in m for m in result)

    def test_handles_empty_env_var(self, monkeypatch):
        monkeypatch.setenv("LITELLM_FALLBACK_MODELS", "")
        assert get_fallback_models() == []


class TestGetProvider:
    def test_extracts_provider(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "openai/gpt-4")
        assert get_provider() == "openai"

    def test_no_slash_returns_none(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "gpt-4")
        assert get_provider() is None

    def test_github_copilot_provider(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "github_copilot/gpt-4o")
        assert get_provider() == "github_copilot"


# ============================================================================
# Integration tests
# ============================================================================

class TestGetAvailableModels:
    def test_returns_non_empty(self):
        models = get_available_models()
        assert isinstance(models, list)
        assert len(models) > 0

    def test_primary_model_is_first(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "test/primary")
        monkeypatch.setenv("LITELLM_FALLBACK_MODELS", "test/fb1,test/fb2")
        models = get_available_models()
        assert models[0] == "test/primary"


class TestGetConfigSummary:
    def test_has_expected_keys(self):
        summary = get_config_summary()
        expected_keys = {
            "default_model",
            "fallback_models",
            "provider",
            "available_models",
            "env_file",
            "env_file_exists",
        }
        assert set(summary.keys()) == expected_keys

    def test_values_have_correct_types(self):
        summary = get_config_summary()
        assert isinstance(summary["default_model"], str)
        assert isinstance(summary["fallback_models"], list)
        assert isinstance(summary["available_models"], list)
        assert isinstance(summary["env_file"], str)
        assert isinstance(summary["env_file_exists"], bool)


class TestConfigureDspy:
    def test_returns_lm_instance(self):
        lm = configure_dspy()
        assert isinstance(lm, dspy.LM)

    def test_uses_specified_model(self):
        lm = configure_dspy(model="test/custom-model")
        assert "test/custom-model" in str(lm.model)

    def test_uses_default_model_when_none(self, monkeypatch):
        monkeypatch.setenv("LITELLM_MODEL", "test/default-check")
        lm = configure_dspy()
        assert "test/default-check" in str(lm.model)

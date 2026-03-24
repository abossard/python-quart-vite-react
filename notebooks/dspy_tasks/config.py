"""
CONFIG — Shared LiteLLM configuration for DSPy notebooks.

Bridges the DSPy playground to the project's existing LiteLLM/Copilot setup
by reading the same .env file and env vars the backend uses.

Following Grokking Simplicity:
- CALCULATIONS: parse env vars, build model lists (pure)
- ACTIONS: load .env file, call litellm.get_valid_models() (I/O)
"""
import os
import logging
from pathlib import Path
from typing import Optional

import dspy

logger = logging.getLogger(__name__)

# Project root is two levels up from this file (notebooks/dspy_tasks/config.py → project root)
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


# ============================================================================
# ACTIONS: Load environment
# ============================================================================

def _load_env():
    """Load .env file from project root if it exists. ACTION: file I/O."""
    try:
        from dotenv import load_dotenv
        if ENV_FILE.exists():
            load_dotenv(ENV_FILE, override=False)
            logger.debug("Loaded .env from %s", ENV_FILE)
        else:
            logger.debug("No .env file at %s, using system environment", ENV_FILE)
    except ImportError:
        logger.debug("python-dotenv not installed, using system environment only")


# Load on import — same pattern as the backend
_load_env()


# ============================================================================
# CALCULATIONS: Parse configuration (pure)
# ============================================================================

def _parse_fallback_models(raw: str) -> list[str]:
    """Parse comma-separated model list. CALCULATION: pure function."""
    return [m.strip() for m in raw.split(",") if m.strip()]


def _build_model_list(
    primary: str,
    fallbacks: list[str],
    discovered: list[str],
) -> list[str]:
    """Merge configured + discovered models, deduplicating. CALCULATION: pure."""
    seen: set[str] = set()
    result: list[str] = []
    for model in [primary, *fallbacks, *discovered]:
        if not isinstance(model, str):
            continue
        normalized = model.strip()
        if normalized and normalized not in seen:
            result.append(normalized)
            seen.add(normalized)
    return result


# ============================================================================
# ACTIONS: Read config values
# ============================================================================

def get_default_model() -> str:
    """Return the configured default model. ACTION: reads env var."""
    return os.getenv("LITELLM_MODEL", "github_copilot/gpt-4o")


def get_fallback_models() -> list[str]:
    """Return the configured fallback model chain. ACTION: reads env var."""
    raw = os.getenv(
        "LITELLM_FALLBACK_MODELS",
        "github_copilot/claude-sonnet-4,github_copilot/gpt-4o,github_copilot/gpt-4o-mini",
    )
    return _parse_fallback_models(raw)


def get_provider() -> Optional[str]:
    """Infer the LiteLLM provider from the default model string."""
    model = get_default_model()
    return model.split("/", 1)[0] if "/" in model else None


def discover_models() -> list[str]:
    """Dynamically discover available models from LiteLLM. ACTION: may call provider API.

    Returns an empty list if discovery fails (graceful fallback).
    """
    provider = get_provider()
    try:
        import litellm
        discovered = litellm.get_valid_models(
            custom_llm_provider=provider,
            check_provider_endpoint=False,
        )
        if discovered:
            return [m for m in discovered if isinstance(m, str) and m.strip()]
    except Exception as exc:
        logger.debug("Model discovery failed (using configured models only): %s", exc)
    return []


def get_available_models() -> list[str]:
    """Return all available models: configured + discovered, deduplicated.

    This mirrors backend/llm_service.py's get_model_catalog() logic.
    """
    primary = get_default_model()
    fallbacks = get_fallback_models()
    discovered = discover_models()
    return _build_model_list(primary, fallbacks, discovered)


# ============================================================================
# ACTIONS: Configure DSPy
# ============================================================================

def configure_dspy(
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    cache: bool = True,
) -> dspy.LM:
    """Configure DSPy with a LiteLLM-backed model.

    Uses the project's .env configuration. If no model is specified,
    uses the default from LITELLM_MODEL env var.

    For github_copilot models, automatically adds the required
    Editor-Version and other headers that the Copilot API expects.

    Args:
        model: LiteLLM model string (e.g., 'github_copilot/gpt-4o').
               If None, uses get_default_model().
        temperature: Optional temperature override.
        max_tokens: Optional max tokens override.
        cache: Enable DSPy's built-in LLM call caching (default True).

    Returns:
        The configured dspy.LM instance.
    """
    model_name = model or get_default_model()

    kwargs = {}
    if temperature is not None:
        kwargs["temperature"] = temperature
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    # GitHub Copilot models require IDE-style headers that DSPy's
    # adapter code path may not forward automatically.
    if model_name.startswith("github_copilot/"):
        kwargs["extra_headers"] = _get_copilot_headers()

    lm = dspy.LM(model_name, cache=cache, **kwargs)
    try:
        dspy.configure(lm=lm)
    except RuntimeError:
        # Widget callbacks run on a different thread — dspy.configure()
        # only works from the thread that first called it.
        # Fall through: callers should use dspy.context(lm=lm) in callbacks.
        pass
    return lm


def _get_copilot_headers() -> dict:
    """Build the headers GitHub Copilot's API requires. ACTION: may read auth token."""
    headers = {
        "editor-version": "vscode/1.95.0",
        "copilot-integration-id": "vscode-chat",
        "editor-plugin-version": "copilot-chat/0.26.7",
        "user-agent": "GitHubCopilotChat/0.26.7",
        "openai-intent": "conversation-panel",
        "x-github-api-version": "2025-04-01",
    }
    # If LiteLLM's authenticator has a cached token, include it so the
    # header is present even on DSPy's fallback code paths.
    try:
        from litellm.llms.github_copilot.authenticator import Authenticator
        token = Authenticator().get_api_key()
        if token:
            headers["Authorization"] = f"Bearer {token}"
    except Exception:
        pass  # Authenticator will handle auth on its own in the normal path
    return headers


def get_config_summary() -> dict:
    """Return a summary of the current configuration for display."""
    return {
        "default_model": get_default_model(),
        "fallback_models": get_fallback_models(),
        "provider": get_provider(),
        "available_models": get_available_models(),
        "env_file": str(ENV_FILE),
        "env_file_exists": ENV_FILE.exists(),
    }

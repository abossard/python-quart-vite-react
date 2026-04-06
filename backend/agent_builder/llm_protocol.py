"""
Agent Builder — LLM Protocol

Type definitions for the LLM factory callback pattern.
The host application provides an LLM factory; the module never
imports any specific LLM provider.

Data: LLMConfig, ModelCatalog (pure data, no behavior)
Protocol: LLMFactory, ModelCatalogProvider (callable signatures)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Protocol, TypedDict, runtime_checkable

from langchain_core.language_models import BaseChatModel


# ---------------------------------------------------------------------------
# LLM Configuration (data — passed to the factory)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LLMConfig:
    """Immutable configuration bundle for building an LLM instance.

    The module builds this from per-agent overrides + service defaults,
    then hands it to the caller's factory function.
    """
    model: str = ""
    temperature: float = 0.0
    max_tokens: int = 0
    api_key: str = ""
    base_url: str = ""
    reasoning_effort: str = "low"
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# LLM Factory (callable protocol — the host implements this)
# ---------------------------------------------------------------------------

@runtime_checkable
class LLMFactory(Protocol):
    """Callable that builds a LangChain BaseChatModel from config.

    The host application implements this to wire in its own LLM provider
    (OpenAI, Copilot, Ollama, etc.).

    Example::

        def my_factory(config: LLMConfig) -> BaseChatModel:
            return ChatOpenAI(
                model=config.model or "gpt-4o-mini",
                temperature=config.temperature,
                api_key=config.api_key,
            )

        service = WorkbenchService(tool_registry=registry, llm_factory=my_factory)
    """
    def __call__(self, config: LLMConfig) -> BaseChatModel: ...


# ---------------------------------------------------------------------------
# Model Catalog (data — returned by the catalog provider)
# ---------------------------------------------------------------------------

class ModelCatalog(TypedDict, total=False):
    """Metadata about available LLM models for the UI config endpoint."""
    backend: str
    provider: str | None
    default_model: str
    fallback_models: list[str]
    available_models: list[str]
    source: str


@runtime_checkable
class ModelCatalogProvider(Protocol):
    """Callable that returns the current model catalog.

    Used by the UI config endpoint to tell the frontend which models
    are available. Optional — if not provided, a minimal catalog is returned.
    """
    def __call__(self) -> ModelCatalog: ...

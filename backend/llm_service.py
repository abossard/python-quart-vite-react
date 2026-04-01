"""
LLM Service - Dual Backend for KBA Draft Generation

Provides async interface for structured LLM output.
- Primary: OpenAI SDK when OPENAI_API_KEY is set
- Default: GitHub Copilot API via OpenAI SDK (copilot_auth handles tokens)

Following "Grokking Simplicity":
- Pure calculations: Pydantic parsing, error mapping
- Actions: HTTP requests to LLM API
- Clear error handling with custom exceptions
"""

import logging
import os
from typing import Any, Optional, Type

from kba_exceptions import (
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")
COPILOT_MODEL = os.getenv("COPILOT_MODEL", "gpt-4o")

COPILOT_FALLBACK_MODELS = [
    m.strip() for m in os.getenv(
        "COPILOT_FALLBACK_MODELS",
        "claude-sonnet-4,gpt-4o,gpt-4o-mini"
    ).split(",") if m.strip()
]


class LLMService:
    """LLM client with OpenAI primary and Copilot default backend."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 60,
        backend: Optional[str] = None,
    ):
        """
        Backend selection:
        - "openai": Force OpenAI SDK (requires api_key)
        - None (default): GitHub Copilot via copilot_auth
        """
        self.timeout = timeout

        resolved_api_key = api_key or OPENAI_API_KEY
        if backend == "openai":
            self._backend = "openai"
        else:
            self._backend = "copilot"

        if self._backend == "openai":
            self.api_key = resolved_api_key
            if not self.api_key:
                raise LLMAuthenticationError(
                    "OpenAI API key not set. Set OPENAI_API_KEY."
                )
            self.model = model or OPENAI_MODEL
            self.base_url = base_url or OPENAI_BASE_URL or None

            from openai import AsyncOpenAI
            client_kwargs: dict[str, Any] = {"api_key": self.api_key, "timeout": self.timeout}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self._client = AsyncOpenAI(**client_kwargs)
        else:
            from copilot_llm import build_copilot_async_client
            self.model = model or COPILOT_MODEL
            self.base_url = None
            self._client = build_copilot_async_client(timeout=self.timeout)
            self._fallback_models = [
                m for m in COPILOT_FALLBACK_MODELS
                if m != self.model
            ]

        logger.info(
            "LLMService initialized",
            extra={
                "backend": self._backend,
                "model": self.model,
                "fallback_models": getattr(self, '_fallback_models', []),
                "timeout": self.timeout,
            }
        )

    async def health_check(self) -> bool:
        """Check if LLM API is accessible."""
        try:
            await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
                timeout=min(self.timeout, 15),
            )
            return True
        except Exception as e:
            logger.warning("LLM health check failed (%s): %s", self._backend, e)
            return False

    def get_model_catalog(self) -> dict[str, Any]:
        """Return backend/model metadata for UI model selection."""
        fallback_models = list(getattr(self, '_fallback_models', []))
        all_models = [self.model, *fallback_models]

        # Deduplicate preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for m in all_models:
            if m not in seen:
                unique.append(m)
                seen.add(m)

        return {
            "backend": self._backend,
            "provider": "copilot" if self._backend == "copilot" else None,
            "default_model": self.model,
            "fallback_models": fallback_models,
            "available_models": unique,
            "source": "configured",
        }

    async def structured_chat(
        self,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel],
    ) -> BaseModel:
        """Generate structured output with model fallback chain."""
        if self._backend == "openai":
            return await self._structured_chat_parse(
                self.model, messages, output_schema
            )

        # Copilot backend: try primary then fallbacks
        models_to_try = [self.model] + getattr(self, '_fallback_models', [])
        last_error: Exception | None = None

        for i, model in enumerate(models_to_try):
            try:
                return await self._structured_chat_parse(
                    model, messages, output_schema
                )
            except Exception as e:
                last_error = e
                if i < len(models_to_try) - 1:
                    logger.warning("Model %s failed (%s), trying fallback...", model, e)
                    continue
                raise self._handle_openai_error(e)

        raise self._handle_openai_error(last_error or Exception("All models failed"))

    async def _structured_chat_parse(
        self,
        model: str,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel],
    ) -> BaseModel:
        """Structured output via OpenAI SDK (works for both OpenAI and Copilot)."""
        try:
            logger.debug(
                "Calling structured output",
                extra={"model": model, "schema": output_schema.__name__},
            )

            completion = await self._client.beta.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=output_schema,
            )

            msg = completion.choices[0].message
            if hasattr(msg, "refusal") and msg.refusal:
                raise LLMUnavailableError(f"Content policy violation: {msg.refusal}")

            parsed = msg.parsed
            if parsed is None:
                # Fallback: parse from content string
                content = msg.content
                if not content:
                    raise LLMUnavailableError(f"Empty content from {model}")
                parsed = output_schema.model_validate_json(content)

            usage = completion.usage
            logger.info(
                "Structured output generated",
                extra={
                    "model": completion.model or model,
                    "backend": self._backend,
                    "usage": {
                        "prompt_tokens": getattr(usage, "prompt_tokens", 0),
                        "completion_tokens": getattr(usage, "completion_tokens", 0),
                        "total_tokens": getattr(usage, "total_tokens", 0),
                    } if usage else {},
                },
            )
            return parsed

        except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError, LLMAuthenticationError):
            raise
        except Exception as e:
            raise self._handle_openai_error(e)

    def _handle_openai_error(self, error: Exception) -> Exception:
        """Map OpenAI SDK exceptions to custom LLM exceptions."""
        from openai import (
            APIConnectionError,
            APITimeoutError,
            AuthenticationError,
            BadRequestError,
            RateLimitError,
        )

        if isinstance(error, APITimeoutError):
            logger.error("Request timeout: %s", error)
            return LLMTimeoutError(f"Request timed out after {self.timeout}s: {error}")
        elif isinstance(error, APIConnectionError):
            logger.error("Connection failed: %s", error)
            return LLMUnavailableError(f"Failed to connect to LLM API: {error}")
        elif isinstance(error, RateLimitError):
            logger.error("Rate limit exceeded: %s", error)
            return LLMRateLimitError(f"Rate limit exceeded: {error}")
        elif isinstance(error, AuthenticationError):
            logger.error("Authentication failed: %s", error)
            return LLMAuthenticationError(f"API key invalid or expired: {error}")
        elif isinstance(error, BadRequestError):
            logger.error("Bad request: %s", error)
            return error
        else:
            logger.error("Unexpected LLM error: %s", error, exc_info=True)
            return error

    async def close(self):
        """Close the async HTTP client."""
        if self._client:
            await self._client.close()


# Singleton
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get singleton LLMService instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

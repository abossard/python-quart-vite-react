"""
LLM Service - Dual Backend for KBA Draft Generation

Provides async interface for structured LLM output.
- Primary: OpenAI SDK (beta.chat.completions.parse) when OPENAI_API_KEY is set
- Fallback: LiteLLM (litellm.acompletion) when OPENAI_API_KEY is missing

LiteLLM supports 100+ providers including GitHub Copilot (github_copilot/),
Ollama, Anthropic, etc. — configure via LITELLM_MODEL env var.

Following "Grokking Simplicity":
- Pure calculations: Pydantic parsing, error mapping
- Actions: HTTP requests to LLM API
- Clear error handling with custom exceptions

Example usage:
    service = LLMService()  # auto-selects backend
    
    # Check if available
    if await service.health_check():
        result = await service.structured_chat(
            messages=[{"role": "user", "content": "Generate KBA..."}],
            output_schema=KBAOutputSchema
        )
        # result is already a validated Pydantic object
"""

import json
import logging
import os
from typing import Any, Optional, Type

from pydantic import BaseModel

from kba_exceptions import (
    LLMUnavailableError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMAuthenticationError
)

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")  # optional override
LITELLM_MODEL = os.getenv("LITELLM_MODEL", "github_copilot/gpt-4o")

# Comma-separated fallback chain, fastest first. Used when LITELLM_MODEL fails.
# Example: "github_copilot/claude-sonnet-4,github_copilot/gpt-4o,github_copilot/gpt-4o-mini"
LITELLM_FALLBACK_MODELS = [
    m.strip() for m in os.getenv(
        "LITELLM_FALLBACK_MODELS",
        "github_copilot/claude-sonnet-4,github_copilot/gpt-4o,github_copilot/gpt-4o-mini"
    ).split(",") if m.strip()
]


class LLMService:
    """LLM client with OpenAI primary and LiteLLM fallback"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 60,
        backend: Optional[str] = None,
    ):
        """
        Initialize LLM service client.
        
        Backend selection:
        - "openai": Force OpenAI SDK (requires api_key)
        - "litellm": Force LiteLLM
        - None (default): LiteLLM always, unless backend="openai" is forced
        
        Args:
            api_key: OpenAI API key (default: from OPENAI_API_KEY env var)
            model: Model to use (default: from env vars based on backend)
            base_url: Optional base URL override
            timeout: Request timeout in seconds (default: 60)
            backend: Force backend selection ("openai", "litellm", or None for auto)
        """
        self.timeout = timeout
        
        # Determine backend: LiteLLM is the default, OpenAI only when forced
        resolved_api_key = api_key or OPENAI_API_KEY
        if backend == "openai":
            self._backend = "openai"
        else:
            self._backend = "litellm"
        
        if self._backend == "openai":
            self.api_key = resolved_api_key
            if not self.api_key:
                raise LLMAuthenticationError(
                    "OpenAI API key not set. "
                    "Please set OPENAI_API_KEY environment variable."
                )
            self.model = model or OPENAI_MODEL
            self.base_url = base_url or OPENAI_BASE_URL or None
            
            from openai import AsyncOpenAI
            client_kwargs = {"api_key": self.api_key, "timeout": self.timeout}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self._client = AsyncOpenAI(**client_kwargs)
        else:
            # LiteLLM backend
            self.api_key = resolved_api_key or None
            self.model = model or (OPENAI_MODEL if resolved_api_key else LITELLM_MODEL)
            self.base_url = base_url or OPENAI_BASE_URL or None
            self._client = None
            # Build fallback chain: primary model + configured fallbacks (deduplicated)
            self._fallback_models = []
            for m in LITELLM_FALLBACK_MODELS:
                if m != self.model and m not in self._fallback_models:
                    self._fallback_models.append(m)
        
        logger.info(
            "LLMService initialized",
            extra={
                "backend": self._backend,
                "model": self.model,
                "fallback_models": getattr(self, '_fallback_models', []),
                "base_url": self.base_url or "default",
                "timeout": self.timeout,
                "api_key_set": bool(self.api_key),
            }
        )
    
    async def health_check(self) -> bool:
        """Check if LLM API is accessible"""
        try:
            if self._backend == "openai":
                await self._client.models.list()
            else:
                import litellm
                await litellm.acompletion(
                    model=self.model,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=5,
                    timeout=min(self.timeout, 15),
                )
            return True
        except Exception as e:
            logger.warning(f"LLM health check failed ({self._backend}): {e}")
            return False
    
    async def structured_chat(
        self,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel]
    ) -> BaseModel:
        """
        Generate structured output using the active backend.
        
        - OpenAI: Uses beta.chat.completions.parse() for native structured output
        - LiteLLM: Uses acompletion() with response_format + model_validate_json()
        
        Args:
            messages: Chat messages [{"role": "...", "content": "..."}]
            output_schema: Pydantic BaseModel class for the expected output
            
        Returns:
            Validated Pydantic object of type output_schema
        """
        if self._backend == "openai":
            return await self._structured_chat_openai(messages, output_schema)
        else:
            return await self._structured_chat_litellm(messages, output_schema)
    
    async def _structured_chat_openai(
        self,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel]
    ) -> BaseModel:
        """OpenAI backend: native structured output via beta.parse()"""
        try:
            logger.debug(
                "Calling OpenAI structured output",
                extra={"model": self.model, "schema": output_schema.__name__}
            )
            
            completion = await self._client.beta.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=output_schema
            )
            
            if completion.choices[0].message.refusal:
                refusal_reason = completion.choices[0].message.refusal
                logger.warning(f"OpenAI refused to generate content: {refusal_reason}")
                raise LLMUnavailableError(
                    f"OpenAI content policy violation: {refusal_reason}"
                )
            
            parsed_output = completion.choices[0].message.parsed
            
            logger.info(
                "Structured output generated successfully",
                extra={
                    "model": completion.model,
                    "backend": "openai",
                    "usage": {
                        "prompt_tokens": completion.usage.prompt_tokens,
                        "completion_tokens": completion.usage.completion_tokens,
                        "total_tokens": completion.usage.total_tokens
                    }
                }
            )
            
            return parsed_output
        
        except Exception as e:
            raise self._handle_openai_error(e)
    
    async def _structured_chat_litellm(
        self,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel]
    ) -> BaseModel:
        """LiteLLM backend with model fallback chain.
        
        Tries the primary model first, then falls back through
        LITELLM_FALLBACK_MODELS on failure.
        """
        import litellm
        
        models_to_try = [self.model] + getattr(self, '_fallback_models', [])
        last_error = None
        
        for i, model in enumerate(models_to_try):
            try:
                is_fallback = i > 0
                logger.debug(
                    f"Calling LiteLLM structured output{' (fallback)' if is_fallback else ''}",
                    extra={"model": model, "schema": output_schema.__name__, "attempt": i + 1}
                )
                
                completion = await litellm.acompletion(
                    model=model,
                    messages=messages,
                    response_format=output_schema,
                    timeout=self.timeout,
                )
                
                content = completion.choices[0].message.content
                if not content:
                    raise LLMUnavailableError(f"LiteLLM returned empty content from {model}")
                
                parsed_output = output_schema.model_validate_json(content)
                
                usage = completion.usage if completion.usage else None
                logger.info(
                    "Structured output generated successfully",
                    extra={
                        "model": completion.model or model,
                        "backend": "litellm",
                        "was_fallback": is_fallback,
                        "usage": {
                            "prompt_tokens": getattr(usage, 'prompt_tokens', 0),
                            "completion_tokens": getattr(usage, 'completion_tokens', 0),
                            "total_tokens": getattr(usage, 'total_tokens', 0),
                        } if usage else {}
                    }
                )
                
                return parsed_output
            
            except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError, LLMAuthenticationError) as e:
                last_error = e
                if i < len(models_to_try) - 1:
                    logger.warning(f"Model {model} failed ({e}), trying next fallback...")
                    continue
                raise
            except Exception as e:
                last_error = e
                if i < len(models_to_try) - 1:
                    logger.warning(f"Model {model} failed ({e}), trying next fallback...")
                    continue
                raise self._handle_litellm_error(e)
        
        # Should not reach here, but just in case
        raise self._handle_litellm_error(last_error or Exception("All models failed"))
    
    def _handle_openai_error(self, error: Exception) -> Exception:
        """Map OpenAI SDK exceptions to custom LLM exceptions"""
        from openai import (
            APIConnectionError,
            APITimeoutError,
            RateLimitError,
            AuthenticationError,
            BadRequestError
        )
        
        if isinstance(error, APITimeoutError):
            logger.error(f"OpenAI request timeout: {error}")
            return LLMTimeoutError(
                f"OpenAI request timed out after {self.timeout}s: {error}"
            )
        elif isinstance(error, APIConnectionError):
            logger.error(f"OpenAI connection failed: {error}")
            return LLMUnavailableError(f"Failed to connect to OpenAI API: {error}")
        elif isinstance(error, RateLimitError):
            logger.error(f"OpenAI rate limit exceeded: {error}")
            return LLMRateLimitError(f"OpenAI rate limit exceeded: {error}")
        elif isinstance(error, AuthenticationError):
            logger.error(f"OpenAI authentication failed: {error}")
            return LLMAuthenticationError(f"OpenAI API key invalid or expired: {error}")
        elif isinstance(error, BadRequestError):
            logger.error(f"OpenAI bad request: {error}")
            return error
        else:
            logger.error(f"Unexpected error in LLM service: {error}", exc_info=True)
            return error
    
    def _handle_litellm_error(self, error: Exception) -> Exception:
        """Map LiteLLM exceptions to custom LLM exceptions"""
        error_str = str(error).lower()
        error_type = type(error).__name__
        
        if "timeout" in error_str or "Timeout" in error_type:
            logger.error(f"LiteLLM timeout: {error}")
            return LLMTimeoutError(f"LiteLLM request timed out: {error}")
        elif "rate" in error_str and "limit" in error_str:
            logger.error(f"LiteLLM rate limit: {error}")
            return LLMRateLimitError(f"LiteLLM rate limit exceeded: {error}")
        elif "auth" in error_str or "api key" in error_str or "401" in error_str:
            logger.error(f"LiteLLM auth error: {error}")
            return LLMAuthenticationError(f"LiteLLM authentication failed: {error}")
        elif "connection" in error_str or "connect" in error_str:
            logger.error(f"LiteLLM connection error: {error}")
            return LLMUnavailableError(f"LiteLLM connection failed: {error}")
        elif "ValidationError" in error_type or "json" in error_str:
            logger.error(f"LiteLLM output parsing failed: {error}")
            return LLMUnavailableError(f"Failed to parse LLM output: {error}")
        else:
            logger.error(f"Unexpected LiteLLM error: {error}", exc_info=True)
            return LLMUnavailableError(f"LiteLLM error: {error}")
    
    async def close(self):
        """Close the async HTTP client"""
        if self._client:
            await self._client.close()


# Singleton pattern for easy access
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """
    Get singleton LLMService instance.
    Auto-selects backend: OpenAI if OPENAI_API_KEY is set, else LiteLLM.
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

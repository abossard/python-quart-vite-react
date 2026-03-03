"""
LLM Service - OpenAI Client for KBA Draft Generation

Provides async interface to OpenAI API using native structured output.
Replaces Ollama service with OpenAI's beta.chat.completions.parse() feature
for automatic Pydantic model parsing and validation.

Following "Grokking Simplicity":
- Pure calculations: Pydantic parsing, error mapping
- Actions: HTTP requests to OpenAI API
- Clear error handling with custom exceptions

Example usage:
    service = LLMService()
    
    # Check if available
    if await service.health_check():
        result = await service.structured_chat(
            messages=[{"role": "user", "content": "Generate KBA..."}],
            output_schema=KBAOutputSchema
        )
        # result is already a validated Pydantic object
"""

import logging
import os
from typing import Any, Optional, Type

from openai import AsyncOpenAI
from pydantic import BaseModel

from kba_exceptions import (
    LLMUnavailableError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMAuthenticationError
)

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION - OpenAI settings (consistent with agents.py)
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")  # optional override


class LLMService:
    """OpenAI client for structured output generation"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 60
    ):
        """
        Initialize LLM service client
        
        Args:
            api_key: OpenAI API key (default: from OPENAI_API_KEY env var)
            model: Model to use (default: from OPENAI_MODEL env var or gpt-4o-mini)
            base_url: Optional base URL override (default: from OPENAI_BASE_URL env var)
            timeout: Request timeout in seconds (default: 60)
            
        Raises:
            LLMAuthenticationError: If no API key configured
        """
        # Use module-level config as defaults (consistent with agents.py pattern)
        self.api_key = api_key or OPENAI_API_KEY
        self.model = model or OPENAI_MODEL
        self.base_url = base_url or OPENAI_BASE_URL or None
        self.timeout = timeout
        
        # Validate API key is configured
        if not self.api_key:
            raise LLMAuthenticationError(
                "OpenAI API key not set. "
                "Please set OPENAI_API_KEY environment variable."
            )
        
        # Initialize OpenAI async client
        client_kwargs = {
            "api_key": self.api_key,
            "timeout": self.timeout
        }
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        
        self._client = AsyncOpenAI(**client_kwargs)
        
        logger.info(
            "LLMService initialized",
            extra={
                "model": self.model,
                "base_url": self.base_url or "default",
                "timeout": self.timeout,
                "api_key_prefix": self.api_key[:10] + "..." if self.api_key else "None"
            }
        )
    
    async def health_check(self) -> bool:
        """
        Check if OpenAI API is accessible
        
        Returns:
            True if service is reachable, False otherwise
        """
        try:
            # Simple check: list models
            await self._client.models.list()
            return True
        except Exception as e:
            logger.warning(f"LLM health check failed: {e}")
            return False
    
    async def structured_chat(
        self,
        messages: list[dict[str, str]],
        output_schema: Type[BaseModel]
    ) -> BaseModel:
        """
        Generate structured output using OpenAI's native parsing
        
        Uses beta.chat.completions.parse() which automatically validates
        the LLM output against the provided Pydantic schema.
        
        Args:
            messages: Chat messages in OpenAI format [{"role": "user", "content": "..."}]
            output_schema: Pydantic BaseModel class defining the expected output structure
            
        Returns:
            Validated Pydantic object of type output_schema
            
        Raises:
            LLMUnavailableError: If OpenAI API not reachable
            LLMTimeoutError: If request times out
            LLMRateLimitError: If rate limit exceeded
            LLMAuthenticationError: If API key invalid
            Exception: For other OpenAI errors (parsing failures, etc.)
        """
        try:
            logger.debug(
                f"Calling OpenAI structured output",
                extra={
                    "model": self.model,
                    "schema": output_schema.__name__,
                    "message_count": len(messages)
                }
            )
            
            # Use native structured output (beta feature)
            completion = await self._client.beta.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=output_schema
            )
            
            # Check for refusal (content policy violations)
            if completion.choices[0].message.refusal:
                refusal_reason = completion.choices[0].message.refusal
                logger.warning(f"OpenAI refused to generate content: {refusal_reason}")
                raise LLMUnavailableError(
                    f"OpenAI content policy violation: {refusal_reason}"
                )
            
            # Get parsed Pydantic object
            parsed_output = completion.choices[0].message.parsed
            
            logger.info(
                "Structured output generated successfully",
                extra={
                    "model": completion.model,
                    "usage": {
                        "prompt_tokens": completion.usage.prompt_tokens,
                        "completion_tokens": completion.usage.completion_tokens,
                        "total_tokens": completion.usage.total_tokens
                    }
                }
            )
            
            return parsed_output
        
        except Exception as e:
            # Map OpenAI exceptions to custom exceptions
            raise self._handle_error(e)
    
    def _handle_error(self, error: Exception) -> Exception:
        """
        Map OpenAI SDK exceptions to custom LLM exceptions
        
        Args:
            error: Original exception from OpenAI SDK
            
        Returns:
            Mapped custom exception
        """
        from openai import (
            APIConnectionError,
            APITimeoutError,
            RateLimitError,
            AuthenticationError,
            BadRequestError
        )
        
        # Check specific errors first (APITimeoutError is subclass of APIConnectionError)
        if isinstance(error, APITimeoutError):
            logger.error(f"OpenAI request timeout: {error}")
            return LLMTimeoutError(
                f"OpenAI request timed out after {self.timeout}s: {error}"
            )
        
        elif isinstance(error, APIConnectionError):
            logger.error(f"OpenAI connection failed: {error}")
            return LLMUnavailableError(
                f"Failed to connect to OpenAI API: {error}"
            )
        
        elif isinstance(error, RateLimitError):
            logger.error(f"OpenAI rate limit exceeded: {error}")
            return LLMRateLimitError(
                f"OpenAI rate limit exceeded: {error}"
            )
        
        elif isinstance(error, AuthenticationError):
            logger.error(f"OpenAI authentication failed: {error}")
            return LLMAuthenticationError(
                f"OpenAI API key invalid or expired: {error}"
            )
        
        elif isinstance(error, BadRequestError):
            logger.error(f"OpenAI bad request: {error}")
            # Keep as-is for debugging (schema errors, etc.)
            return error
        
        else:
            # Unknown error - log and re-raise
            logger.error(f"Unexpected error in LLM service: {error}", exc_info=True)
            return error
    
    async def close(self):
        """Close the async HTTP client"""
        await self._client.close()


# Singleton pattern for easy access
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """
    Get singleton LLMService instance
    
    Returns:
        Shared LLMService instance
        
    Raises:
        LLMAuthenticationError: If OPENAI_API_KEY not configured
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

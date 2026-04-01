"""
Copilot LLM Factory

Builds LangChain ChatOpenAI and OpenAI AsyncOpenAI clients pointed at
the GitHub Copilot Chat API (https://api.githubcopilot.com).

Uses copilot_auth for token management (device flow / GITHUB_TOKEN).
"""

import logging
import os
import secrets
from typing import Any
from uuid import uuid4

from copilot_auth import COPILOT_API_BASE, get_copilot_authenticator

logger = logging.getLogger(__name__)

COPILOT_MODEL = os.getenv("COPILOT_MODEL", "gpt-4o")

# Headers that the Copilot API expects (simulates VS Code)
_COPILOT_VERSION = "0.26.7"
_MACHINE_ID = secrets.token_hex(33)[:65]


def _copilot_headers() -> dict[str, str]:
    return {
        "content-type": "application/json",
        "copilot-integration-id": "vscode-chat",
        "editor-version": "vscode/1.95.0",
        "editor-plugin-version": f"copilot-chat/{_COPILOT_VERSION}",
        "user-agent": f"GithubCopilotChat/{_COPILOT_VERSION}",
        "openai-intent": "conversation-panel",
        "x-request-id": str(uuid4()),
        "vscode-machineid": _MACHINE_ID,
    }


def build_copilot_llm(
    model: str = "",
    temperature: float = 0.0,
    max_tokens: int = 0,
    **_kwargs: Any,
) -> Any:
    """Return a LangChain ChatOpenAI pointed at the Copilot API.
    
    Extra kwargs (e.g. reasoning_effort) are silently ignored since
    the Copilot API doesn't support them.
    """
    from langchain_openai import ChatOpenAI

    auth = get_copilot_authenticator()
    api_key = auth.get_api_key()
    api_base = auth.get_api_base()

    resolved_model = model or COPILOT_MODEL

    kwargs: dict[str, Any] = {
        "model": resolved_model,
        "api_key": api_key,
        "base_url": api_base,
        "temperature": temperature,
        "default_headers": _copilot_headers(),
    }
    if max_tokens > 0:
        kwargs["max_tokens"] = max_tokens

    logger.info("Built Copilot LLM: model=%s, base=%s", resolved_model, api_base)
    return ChatOpenAI(**kwargs)


def build_copilot_async_client(timeout: int = 60) -> Any:
    """Return an OpenAI AsyncOpenAI client pointed at the Copilot API."""
    from openai import AsyncOpenAI

    auth = get_copilot_authenticator()
    api_key = auth.get_api_key()
    api_base = auth.get_api_base()

    return AsyncOpenAI(
        api_key=api_key,
        base_url=api_base,
        timeout=timeout,
        default_headers=_copilot_headers(),
    )

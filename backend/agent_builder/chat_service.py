"""
Agent Builder — Chat Service

Deep module: simple interface for the chat agent.
Uses the shared ReAct engine under the hood.
"""

import logging
import os
from datetime import datetime
from typing import Any

from .engine.prompt_builder import build_chat_system_prompt
from .engine.react_runner import RunResult, run_react_agent
from .llm_protocol import LLMConfig, LLMFactory
from .models.chat import AgentRequest, AgentResponse
from .tools import ToolRegistry

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


class ChatService:
    """
    Runs one-shot chat agent interactions.

    Designed as a deep module:
      - Simple public API: run_agent(request) → response
      - Hides LLM setup, tool resolution, prompt building, execution
    """

    def __init__(
        self,
        tool_registry: ToolRegistry,
        llm_factory: LLMFactory,
        default_model: str = "",
        system_prompt_builder: Any = None,
    ) -> None:
        self._registry = tool_registry
        self._llm_factory = llm_factory
        self._default_model = default_model
        self._system_prompt_builder = system_prompt_builder or build_chat_system_prompt
        self._llm: Any = None
        self._recursion_limit = max(3, _env_int("REACT_AGENT_RECURSION_LIMIT", 8))
        self._efficiency_mode = _env_flag("AGENT_EFFICIENCY_MODE", "true")
        self._llm_logging = _env_flag("OPENAI_CALL_LOGGING_ENABLED", "true")

    @property
    def llm(self) -> Any:
        if self._llm is None:
            self._llm = self._llm_factory(LLMConfig(model=self._default_model))
        return self._llm

    @property
    def tools(self) -> list[Any]:
        return self._registry.available_tools()

    async def run_agent(self, request: AgentRequest) -> AgentResponse:
        """Run a ReAct agent with the given request."""
        system_prompt = self._system_prompt_builder(efficiency_mode=self._efficiency_mode)

        result: RunResult = await run_react_agent(
            llm=self.llm,
            tools=self.tools,
            system_prompt=system_prompt,
            user_message=request.prompt,
            recursion_limit=self._recursion_limit,
            enable_tool_logging=True,
            enable_llm_logging=self._llm_logging,
            default_model_name=self._default_model,
        )

        if result.error:
            return AgentResponse(
                result="Agent execution failed. See error field for details.",
                agent_type=request.agent_type,
                error=result.error,
                created_at=datetime.now(),
            )

        return AgentResponse(
            result=result.output,
            agent_type=request.agent_type,
            tools_used=result.tools_used,
            created_at=datetime.now(),
        )

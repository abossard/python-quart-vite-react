"""
Agent Builder — LLM Callbacks

Logging callbacks for OpenAI LLM calls and tool invocations.
Actions (I/O): write to logger.
"""

import logging
from time import perf_counter
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


def make_tool_logging_callback() -> Any:
    """Create a callback handler that logs tool invocations with latency."""
    from langchain_core.callbacks import BaseCallbackHandler

    class ToolCallLoggingCallback(BaseCallbackHandler):
        def __init__(self) -> None:
            super().__init__()
            self._start_times: dict[Any, float] = {}

        def on_tool_start(
            self,
            serialized: dict[str, Any],
            input_str: str,
            *,
            run_id: Any,
            **kwargs: Any,
        ) -> None:
            self._start_times[run_id] = perf_counter()
            name = serialized.get("name", "?")
            preview = input_str[:200] if isinstance(input_str, str) else str(input_str)[:200]
            logger.info("🔧 Tool START  name=%s run_id=%s input=%s", name, run_id, preview)

        def on_tool_end(self, output: str, *, run_id: Any, **kwargs: Any) -> None:
            started = self._start_times.pop(run_id, None)
            ms = int((perf_counter() - started) * 1000) if started is not None else None
            preview = output[:300] if isinstance(output, str) else str(output)[:300]
            logger.info("✅ Tool END    run_id=%s duration_ms=%s output=%s", run_id, ms, preview)

        def on_tool_error(self, error: BaseException, *, run_id: Any, **kwargs: Any) -> None:
            started = self._start_times.pop(run_id, None)
            ms = int((perf_counter() - started) * 1000) if started is not None else None
            logger.error("❌ Tool ERROR  run_id=%s duration_ms=%s error=%s", run_id, ms, error)

    return ToolCallLoggingCallback()


def make_llm_logging_callback(default_model: str = "") -> Any:
    """Create a callback handler that logs LLM calls with latency and token usage."""
    from langchain_core.callbacks import BaseCallbackHandler

    class LLMCallLoggingCallback(BaseCallbackHandler):
        def __init__(self) -> None:
            super().__init__()
            self._start_times: dict[UUID, float] = {}

        def on_llm_start(
            self,
            serialized: dict[str, Any],
            prompts: list[str],
            *,
            run_id: UUID,
            **kwargs: Any,
        ) -> None:
            self._start_times[run_id] = perf_counter()
            model_name = None
            if isinstance(serialized, dict):
                model_name = (
                    serialized.get("kwargs", {}).get("model")
                    if isinstance(serialized.get("kwargs"), dict)
                    else None
                )
            prompt_chars = sum(len(p or "") for p in prompts)
            logger.info(
                "OpenAI call start run_id=%s model=%s prompts=%d chars=%d",
                run_id, model_name or default_model, len(prompts), prompt_chars,
            )

        def on_llm_end(self, response: Any, *, run_id: UUID, **kwargs: Any) -> None:
            started_at = self._start_times.pop(run_id, None)
            duration_ms = int((perf_counter() - started_at) * 1000) if started_at is not None else None
            token_usage, model_name, finish_reason = _extract_llm_call_metadata(response)
            logger.info(
                "OpenAI call end run_id=%s model=%s duration_ms=%s finish_reason=%s token_usage=%s",
                run_id, model_name or default_model,
                duration_ms if duration_ms is not None else "n/a",
                finish_reason or "n/a",
                token_usage or {},
            )

        def on_llm_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
            started_at = self._start_times.pop(run_id, None)
            duration_ms = int((perf_counter() - started_at) * 1000) if started_at is not None else None
            logger.error(
                "OpenAI call error run_id=%s duration_ms=%s error=%s",
                run_id, duration_ms if duration_ms is not None else "n/a", error,
            )

    return LLMCallLoggingCallback()


def _extract_llm_call_metadata(
    response: Any,
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Extract token usage, model name, and finish reason from LLMResult-like objects."""
    token_usage: dict[str, Any] | None = None
    model_name: str | None = None
    finish_reason: str | None = None

    llm_output = getattr(response, "llm_output", None)
    if isinstance(llm_output, dict):
        maybe_usage = llm_output.get("token_usage")
        if isinstance(maybe_usage, dict):
            token_usage = maybe_usage
        maybe_model = llm_output.get("model_name")
        if isinstance(maybe_model, str):
            model_name = maybe_model

    generations = getattr(response, "generations", None) or []
    if generations and generations[0]:
        first_generation = generations[0][0]
        generation_info = getattr(first_generation, "generation_info", None)
        if isinstance(generation_info, dict):
            maybe_finish = generation_info.get("finish_reason")
            if isinstance(maybe_finish, str):
                finish_reason = maybe_finish

        message = getattr(first_generation, "message", None)
        if message is not None:
            usage_metadata = getattr(message, "usage_metadata", None)
            if isinstance(usage_metadata, dict):
                token_usage = token_usage or usage_metadata

            response_metadata = getattr(message, "response_metadata", None)
            if isinstance(response_metadata, dict):
                maybe_usage = response_metadata.get("token_usage")
                if isinstance(maybe_usage, dict):
                    token_usage = token_usage or maybe_usage
                maybe_model = response_metadata.get("model_name")
                if isinstance(maybe_model, str):
                    model_name = model_name or maybe_model
                maybe_finish = response_metadata.get("finish_reason")
                if isinstance(maybe_finish, str):
                    finish_reason = finish_reason or maybe_finish

    return token_usage, model_name, finish_reason

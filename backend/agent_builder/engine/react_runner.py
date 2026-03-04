"""
Agent Builder — ReAct Runner

Unified ReAct agent builder and executor.
Action: performs LLM invocations via LangGraph.

Both WorkbenchService and ChatService use this to avoid duplicating
the "build → invoke → extract" pattern.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from .callbacks import make_llm_logging_callback, make_tool_logging_callback

logger = logging.getLogger(__name__)


@dataclass
class RunResult:
    """Immutable result of a ReAct agent invocation."""
    output: str
    tools_used: list[str] = field(default_factory=list)
    messages: list[Any] = field(default_factory=list)
    error: str | None = None


def build_llm(
    model: str,
    api_key: str,
    base_url: str = "",
    temperature: float = 0.0,
    max_tokens: int = 0,
) -> Any:
    """Construct a ChatOpenAI instance with configurable parameters."""
    from langchain_openai import ChatOpenAI

    kwargs: dict[str, Any] = {
        "model": model,
        "api_key": api_key,
        "base_url": base_url or None,
        "temperature": temperature,
    }
    if max_tokens > 0:
        kwargs["max_tokens"] = max_tokens
    return ChatOpenAI(**kwargs)


def build_react_agent(
    llm: Any,
    tools: list[Any],
    system_prompt: str,
    response_format: Any = None,
) -> Any:
    """Construct a LangGraph ReAct agent, optionally with structured output."""
    from langgraph.prebuilt import create_react_agent

    kwargs: dict[str, Any] = {
        "model": llm,
        "tools": tools,
        "prompt": system_prompt,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format
    return create_react_agent(**kwargs)


def extract_tools_used(messages: list[Any]) -> list[str]:
    """
    Extract tool names from a LangGraph message chain.

    Pure calculation over message data.
    """
    tools_used: list[str] = []
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
                if name:
                    tools_used.append(name)
        elif hasattr(msg, "type") and msg.type == "tool" and hasattr(msg, "name"):
            tools_used.append(msg.name)
    return list(dict.fromkeys(tools_used))  # deduplicate, preserve order


async def run_react_agent(
    llm: Any,
    tools: list[Any],
    system_prompt: str,
    user_message: str,
    *,
    recursion_limit: int = 10,
    enable_tool_logging: bool = True,
    enable_llm_logging: bool = False,
    default_model_name: str = "",
) -> RunResult:
    """
    Build and execute a ReAct agent in a single call.

    Returns a RunResult with output, tools_used, and optional error.
    This is the shared execution path for both chat and workbench agents.
    """
    try:
        react = build_react_agent(llm, tools, system_prompt)

        callbacks: list[Any] = []
        if enable_tool_logging:
            callbacks.append(make_tool_logging_callback())
        if enable_llm_logging:
            callbacks.append(make_llm_logging_callback(default_model_name))

        result = await react.ainvoke(
            {"messages": [("user", user_message)]},
            config={
                "recursion_limit": recursion_limit,
                "callbacks": callbacks,
            },
        )

        messages = result.get("messages", [])
        final_msg = messages[-1] if messages else None
        output = final_msg.content if final_msg and hasattr(final_msg, "content") else str(final_msg)
        tools_used = extract_tools_used(messages)

        return RunResult(output=output, tools_used=tools_used, messages=messages)

    except Exception as exc:
        return RunResult(
            output="Agent execution failed.",
            error=str(exc),
        )

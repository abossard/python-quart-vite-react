"""
Agent Builder — Engine

ReAct agent execution engine: runner, callbacks, prompt building, event bus.
"""

from .callbacks import make_llm_logging_callback, make_streaming_callback, make_tool_logging_callback
from .event_bus import AgentEvent, AgentEventBus, agent_event_bus
from .prompt_builder import (
    DEFAULT_OUTPUT_SCHEMA,
    append_markdown_instruction,
    append_output_instructions,
    build_chat_system_prompt,
    resolve_output_schema,
)
from .react_runner import RunResult, build_llm, build_react_agent, extract_tools_used, run_react_agent

__all__ = [
    "AgentEvent",
    "AgentEventBus",
    "DEFAULT_OUTPUT_SCHEMA",
    "RunResult",
    "agent_event_bus",
    "append_markdown_instruction",
    "append_output_instructions",
    "build_chat_system_prompt",
    "resolve_output_schema",
    "build_llm",
    "build_react_agent",
    "extract_tools_used",
    "make_llm_logging_callback",
    "make_streaming_callback",
    "make_tool_logging_callback",
    "run_react_agent",
]
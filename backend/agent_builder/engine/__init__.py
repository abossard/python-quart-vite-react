"""
Agent Builder — Engine

ReAct agent execution engine: runner, callbacks, prompt building.
"""

from .callbacks import make_llm_logging_callback, make_tool_logging_callback
from .prompt_builder import (
    DEFAULT_OUTPUT_SCHEMA,
    append_markdown_instruction,
    append_output_instructions,
    build_chat_system_prompt,
    resolve_output_schema,
)
from .react_runner import RunResult, build_llm, build_react_agent, extract_tools_used, run_react_agent

__all__ = [
    "DEFAULT_OUTPUT_SCHEMA",
    "RunResult",
    "append_markdown_instruction",
    "append_output_instructions",
    "build_chat_system_prompt",
    "resolve_output_schema",
    "build_llm",
    "build_react_agent",
    "extract_tools_used",
    "make_llm_logging_callback",
    "make_tool_logging_callback",
    "run_react_agent",
]
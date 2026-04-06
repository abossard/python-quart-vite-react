"""
Agent Builder — Prompt Builder

Pure calculations for composing system prompts.
No I/O, no side effects — easily testable.
"""

import json
from typing import Any


# Default output schema — always structured, even for "plain" agents.
# Every agent returns a message (markdown) + list of referenced ticket IDs.
DEFAULT_OUTPUT_SCHEMA: dict[str, Any] = {
    "title": "AgentOutput",
    "type": "object",
    "properties": {
        "message": {
            "type": "string",
            "description": "The agent's response formatted as GitHub-flavored Markdown.",
            "x-ui": {"widget": "markdown"},
        },
        "referenced_tickets": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of ticket IDs the agent looked at or referenced.",
            "x-ui": {"widget": "badge-list"},
        },
    },
    "required": ["message", "referenced_tickets"],
}


def resolve_output_schema(custom_schema: dict[str, Any] | None) -> dict[str, Any]:
    """Return the effective output schema: custom if it has properties, else default.

    Ensures the schema always has a 'title' key (required by OpenAI's structured output).
    """
    if custom_schema and custom_schema.get("properties"):
        if "title" not in custom_schema:
            custom_schema = {**custom_schema, "title": "AgentOutput"}
        return custom_schema
    return DEFAULT_OUTPUT_SCHEMA


def build_schema_instruction(output_schema: dict[str, Any]) -> str:
    """Build a prompt instruction from a JSON Schema."""
    if not output_schema or not output_schema.get("properties"):
        return ""
    schema_str = json.dumps(output_schema, indent=2)
    return (
        "You MUST respond with valid JSON matching this exact schema:\n"
        f"```json\n{schema_str}\n```\n"
        "Do not include any text outside the JSON object."
    )


def append_output_instructions(
    system_prompt: str,
    output_instructions: str = "",
    output_schema: dict[str, Any] | None = None,
) -> str:
    """Append output formatting instructions to a system prompt.

    Always includes a schema instruction (custom or default).
    output_instructions is prepended as additional context if provided.
    """
    effective_schema = resolve_output_schema(output_schema)
    schema_instruction = build_schema_instruction(effective_schema)

    parts: list[str] = []
    if output_instructions and output_instructions.strip():
        parts.append(output_instructions.strip())
    parts.append(schema_instruction)
    instruction = "\n\n".join(parts)

    base = (system_prompt or "").strip()
    if not base:
        return instruction
    return f"{base}\n\n{instruction}"


def append_markdown_instruction(system_prompt: str) -> str:
    """Append default structured output instruction to a system prompt."""
    return append_output_instructions(system_prompt, "")


def build_chat_system_prompt(*, efficiency_mode: bool = True) -> str:
    """Build a generic system prompt for the chat agent.

    Override this in the host application to customize for your domain.
    The ChatService accepts a ``system_prompt_builder`` parameter.
    """
    efficiency_rules = (
        "- Plan a single tool call when possible and stop early once the answer is clear.\n"
        "- Use small payloads: set sensible limits and compact fields.\n"
    ) if efficiency_mode else ""
    return (
        "You are a helpful assistant with access to tools.\n\n"
        "Behavior:\n"
        f"{efficiency_rules}"
        "- Do not invent data; clearly mark missing information.\n"
        "- Give concise answers."
    )

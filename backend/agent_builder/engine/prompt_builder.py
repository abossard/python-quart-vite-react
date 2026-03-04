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
    "type": "object",
    "properties": {
        "message": {
            "type": "string",
            "description": "The agent's response formatted as GitHub-flavored Markdown.",
        },
        "referenced_tickets": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of ticket IDs the agent looked at or referenced.",
        },
    },
    "required": ["message", "referenced_tickets"],
}


def resolve_output_schema(custom_schema: dict[str, Any] | None) -> dict[str, Any]:
    """Return the effective output schema: custom if it has properties, else default."""
    if custom_schema and custom_schema.get("properties"):
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
    """Build the default system prompt for the chat agent."""
    efficiency_rules = (
        "- Plane möglichst einen einzelnen Tool-Aufruf und stoppe früh, sobald die Antwort klar ist.\n"
        "- Nutze kleine Payloads: setze sinnvolle limits und kompakte fields.\n"
        "- Fordere notes/resolution nur bei explizitem Bedarf an.\n"
    ) if efficiency_mode else ""
    return (
        "Du bist ein präziser CSV-Ticket-Assistent. Sprich Deutsch.\n\n"
        "Verhalten:\n"
        "- Verwende ausschließlich csv_* Tools für Ticketdaten.\n"
        f"{efficiency_rules}"
        "- Erfinde keine Daten; markiere fehlende Daten klar.\n"
        "- Gib eine kurze Antwort und bei strukturierten Ergebnissen einen JSON-Codeblock "
        'mit {"rows": [...]}.'
    )

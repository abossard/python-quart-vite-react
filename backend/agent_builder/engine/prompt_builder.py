"""
Agent Builder — Prompt Builder

Pure calculations for composing system prompts.
No I/O, no side effects — easily testable.
"""

import json
from typing import Any


DEFAULT_MARKDOWN_INSTRUCTION = (
    "Format your final answer as GitHub-flavored Markdown. "
    "Use headings, bullet lists, and tables when helpful. "
    "Do not wrap the entire response in a code block."
)


def build_schema_instruction(output_schema: dict[str, Any]) -> str:
    """
    Build a prompt instruction from a JSON Schema.

    Tells the LLM exactly what structure to produce. The schema is both
    human-readable (in the prompt) and machine-enforced (via response_format).
    """
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

    Priority:
      1. output_schema → generates a strict JSON schema instruction
      2. output_instructions → custom free-text instruction
      3. neither → default markdown instruction
    """
    schema_instruction = build_schema_instruction(output_schema or {})
    if schema_instruction:
        instruction = schema_instruction
    elif output_instructions and output_instructions.strip():
        instruction = output_instructions.strip()
    else:
        instruction = DEFAULT_MARKDOWN_INSTRUCTION

    base = (system_prompt or "").strip()
    if not base:
        return instruction
    return f"{base}\n\n{instruction}"


def append_markdown_instruction(system_prompt: str) -> str:
    """Append default markdown formatting instruction to a system prompt."""
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

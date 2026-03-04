"""
Agent Builder — Prompt Builder

Pure calculations for composing system prompts.
No I/O, no side effects — easily testable.
"""


def append_markdown_instruction(system_prompt: str) -> str:
    """Append a markdown formatting instruction to a system prompt."""
    instruction = (
        "Format your final answer as GitHub-flavored Markdown. "
        "Use headings, bullet lists, and tables when helpful. "
        "Do not wrap the entire response in a code block."
    )
    base = (system_prompt or "").strip()
    if not base:
        return instruction
    return f"{base}\n\n{instruction}"


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

"""
KBA Prompt Engineering

Functions for building structured prompts for OpenAI LLM.
Combines ticket data with guidelines and schema instructions.

Following "Grokking Simplicity":
- Pure calculations: Prompt assembly, string formatting
- No side effects: Just returns prompt strings
- Clear inputs/outputs
"""

import json
from typing import Optional

from kba_schemas import KBA_OUTPUT_SCHEMA, KBA_OUTPUT_EXAMPLE
from tickets import Ticket


def build_kba_prompt(
    ticket: Ticket,
    guidelines: str,
    schema: Optional[dict] = None
) -> str:
    """
    Build structured prompt for OpenAI KBA generation
    
    Args:
        ticket: Ticket object with resolution data
        guidelines: Combined guidelines text from .md files
        schema: JSON schema for output (default: KBA_OUTPUT_SCHEMA)
        
    Returns:
        Complete prompt string for LLM
    """
    if schema is None:
        schema = KBA_OUTPUT_SCHEMA
    
    # Escape braces in ticket content to prevent format string issues
    def escape_braces(text: Optional[str]) -> str:
        if not text:
            return ""
        return text.replace("{", "{{").replace("}", "}}")
    
    safe_summary = escape_braces(ticket.summary)
    safe_notes = escape_braces(ticket.notes)
    safe_resolution = escape_braces(ticket.resolution)
    safe_description = escape_braces(ticket.description)
    
    prompt = f"""Du bist ein erfahrener technischer Redakteur für Knowledge Base Articles (KBAs).

AUFGABE: Erstelle einen strukturierten KBA aus dem folgenden Ticket.

WICHTIGE GUIDELINES (befolge diese strikt):
{guidelines}

TICKET-DATEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Incident-ID: {ticket.incident_id or "N/A"}
Zusammenfassung: {safe_summary}

Beschreibung:
{safe_description or "N/A"}

Notizen:
{safe_notes or "N/A"}

Lösung/Resolution:
{safe_resolution or "N/A"}

Kategorie: {ticket.operational_category_tier1 or "N/A"} > {ticket.operational_category_tier2 or "N/A"}
Priorität: {ticket.priority.value if ticket.priority else "N/A"}
Status: {ticket.status.value if ticket.status else "N/A"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT-FORMAT:
Antworte NUR mit einem JSON-Objekt (kein zusätzlicher Text davor oder danach!), das diesem Schema entspricht:

```json
{json.dumps(schema, indent=2, ensure_ascii=False)}
```

BEISPIEL eines gültigen Outputs:
```json
{json.dumps(KBA_OUTPUT_EXAMPLE, indent=2, ensure_ascii=False)}
```

WICHTIGE REGELN FÜR DIE STRUKTURIERTE AUSGABE:

**title**: SEO-optimiert, präzise, 10-200 Zeichen

**symptoms** (REQUIRED): Array von konkreten Symptomen
- Beobachtbare Fehler/Probleme aus Ticket extrahieren
- Exakte Fehlermeldungen wenn vorhanden
- Mindestens 1 Symptom, maximal 10
Beispiel: ["VPN bricht ab", "Fehler: Timeout", "Kein Internet"]

**cause** (OPTIONAL): Root Cause Analysis
- Warum tritt das Problem auf?
- Nur angeben wenn aus Ticket ableitbar
- Maximal 1000 Zeichen

**resolution_steps** (REQUIRED): Schritt-für-Schritt Lösungsanleitung
- Array von Strings, ein String pro Schritt
- Jeder Schritt eigenständig ausführbar
- Mindestens 1 Schritt, maximal 20
- Aus "Resolution" und "Notes" extrahieren

**validation_checks** (OPTIONAL): Wie prüft man ob Lösung funktioniert?
- Array von Testschritten
- Maximal 10 checks
Beispiel: ["VPN-Verbindung testen", "Ping zu Intranet"]

**warnings** (OPTIONAL): Wichtige Warnungen
- Vorsichtsmaßnahmen, Voraussetzungen, Risiken
- Maximal 5 warnings
Beispiel: ["Admin-Rechte erforderlich", "Backup erstellen"]

**confidence_notes** (OPTIONAL): LLM-Unsicherheiten
- Wenn Information unklar oder mehrdeutig ist
- Einschränkungen der Lösung
- Maximal 500 Zeichen
Beispiel: "Lösung gilt nur für Windows 11. Bei Mac andere Schritte."

**tags** (REQUIRED): Lowercase Suchbegriffe, 2-10 Tags

**related_tickets** (OPTIONAL): Verwandte Incident-IDs (Format: INC + 9-12 Ziffern, z.B. INC000016346 oder INC000016312744). Verwende die EXAKTE Incident-ID aus dem Ticket ohne Änderungen.

**Wichtig**:
- Formuliere aus Sicht des Endbenutzers, nicht des Technikers
- NUR JSON ausgeben, kein zusätzlicher Text oder Markdown-Wrapper!

BEGINNE MIT DEM JSON:"""
    
    return prompt


def build_correction_prompt(
    original_prompt: str,
    failed_response: str,
    validation_error: str
) -> str:
    """
    Build prompt for retry after validation failure
    
    Args:
        original_prompt: Original prompt that was sent
        failed_response: Response that failed validation
        validation_error: Error message from validation
        
    Returns:
        Correction prompt with error feedback
    """
    prompt = f"""{original_prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEHLER IN DEINEM VORHERIGEN OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dein Output war:
{failed_response[:500]}...

VALIDIERUNGSFEHLER:
{validation_error}

BITTE KORRIGIERE das JSON und stelle sicher, dass:
- Alle REQUIRED Felder vorhanden sind: title, symptoms, resolution_steps, tags
- symptoms als Array von Strings (mindestens 1 Symptom)
- resolution_steps als Array von Strings (mindestens 1 Schritt)
- tags als Array von lowercase Strings (2-10 Tags, z.B. ["vpn", "windows"])
- Datentypen korrekt sind (strings, arrays)
- Längen-Constraints eingehalten werden (z.B. title: 10-200 Zeichen)

NUR JSON ausgeben, kein zusätzlicher Text oder Markdown!
BEGINNE MIT {{:"""
    
    return prompt


def build_markdown_fallback_prompt(ticket: Ticket, guidelines: str) -> str:
    """
    Build simpler prompt for markdown-formatted fallback
    
    Used when JSON parsing fails repeatedly.
    
    Args:
        ticket: Ticket object
        guidelines: Combined guidelines
        
    Returns:
        Prompt for markdown-formatted KBA
    """
    safe_summary = ticket.summary.replace("{", "{{").replace("}", "}}")
    safe_resolution = (ticket.resolution or "").replace("{", "{{").replace("}", "}}")
    
    prompt = f"""Erstelle einen Knowledge Base Article aus diesem Ticket.

GUIDELINES:
{guidelines}

TICKET:
- ID: {ticket.incident_id}
- Problem: {safe_summary}
- Lösung: {safe_resolution}

Formatiere als Markdown mit folgender Struktur:

# Titel

## Problem
[Beschreibung]

## Lösungsschritte
1. [Schritt 1]
2. [Schritt 2]
...

## Hinweise
[Zusätzliche Informationen]

## Tags
tag1, tag2, tag3"""
    
    return prompt


def build_search_questions_prompt(draft_data: dict) -> str:
    """
    Build prompt for generating search questions from a KBA draft.
    
    Args:
        draft_data: Dictionary with KBA draft fields (title, symptoms, resolution_steps, etc.)
        
    Returns:
        Prompt string for search question generation
    """
    import json
    
    # Create clean JSON representation of KBA draft
    kba_draft_json = json.dumps({
        "title": draft_data.get("title", ""),
        "symptoms": draft_data.get("symptoms", []),
        "cause": draft_data.get("cause", ""),
        "resolution_steps": draft_data.get("resolution_steps", []),
        "tags": draft_data.get("tags", []),
        "validation_checks": draft_data.get("validation_checks", []),
        "warnings": draft_data.get("warnings", [])
    }, ensure_ascii=False, indent=2)
    
    prompt = f"""Erstelle aus dem folgenden KBA-Draft eine Liste von Suchfragen, die Benutzer in einer Knowledge Base eingeben könnten, um genau diesen Artikel zu finden.

Regeln:
- Verwende nur Informationen aus dem KBA-Draft.
- Keine erfundenen Details.
- Fragen müssen klar, neutral und suchbar sein.
- Erzeuge eine Mischung aus:
  - symptom-orientierten Fragen
  - problem-/ursachen-orientierten Fragen
  - lösungsorientierten Fragen
  - kurzen natürlichen Suchanfragen
- Keine Duplikate oder fast identischen Fragen.
- Sprache soll zur Sprache des KBA passen.
- Gib nur das geforderte JSON zurück.

KBA-Draft:
{kba_draft_json}

Erwartetes JSON-Schema:
{{
  "questions": ["...", "..."]
}}

BEGINNE MIT DEM JSON:"""
    
    return prompt


def build_search_questions_correction_prompt(
    original_prompt: str,
    failed_output: str,
    validation_error: str
) -> str:
    """
    Build correction prompt for search questions retry.
    
    Args:
        original_prompt: Original prompt that was sent
        failed_output: Output that failed validation
        validation_error: Error message from validation
        
    Returns:
        Correction prompt with error feedback
    """
    prompt = f"""{original_prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEHLER IN DEINEM VORHERIGEN OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dein Output:
{failed_output[:500]}...

Validierungsfehler:
{validation_error}

KORREKTUR:
- Stelle sicher, dass mindestens 5 valide Fragen vorhanden sind
- Jede Frage muss 10-200 Zeichen lang sein
- Keine leeren Strings oder Duplikate
- Format: {{"questions": ["...", "..."]}}
- Nur Informationen aus dem KBA-Draft verwenden

NUR JSON zurückgeben, kein zusätzlicher Text!
BEGINNE MIT {{:"""
    
    return prompt

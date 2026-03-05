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


# ============================================================================
# KBA COMPARISON SCHEMA
# ============================================================================

KBA_COMPARISON_SCHEMA = {
    "type": "object",
    "properties": {
        "duplicate_likelihood": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Wahrscheinlichkeit dass bestehender KBA das Problem bereits abdeckt (0.0-1.0)"
        },
        "match_summary": {
            "type": "string",
            "description": "Zusammenfassung der Übereinstimmungen und Unterschiede"
        },
        "strengths_existing_kba": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Stärken des bestehenden KBA (z.B. 'Vollständige Lösungsschritte', 'Klare Symptombeschreibung')"
        },
        "gaps_existing_kba": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Lücken oder Schwächen des bestehenden KBA (z.B. 'Ursache fehlt', 'Lösung unvollständig')"
        },
        "recommendation": {
            "type": "string",
            "enum": ["keep_existing", "create_new", "merge_candidate"],
            "description": "Handlungsempfehlung: keep_existing (bestehenden KBA nutzen), create_new (neuen KBA erstellen), merge_candidate (beide zusammenführen erwägen)"
        },
        "recommendation_reason": {
            "type": "string",
            "description": "Begründung für die Empfehlungsentscheidung"
        },
        "confidence_notes": {
            "type": "string",
            "description": "Hinweise zur Konfidenz der Bewertung, Unsicherheiten oder Einschränkungen"
        }
    },
    "required": [
        "duplicate_likelihood",
        "match_summary",
        "strengths_existing_kba",
        "gaps_existing_kba",
        "recommendation",
        "recommendation_reason"
    ]
}


# ============================================================================
# PROMPT BUILDERS
# ============================================================================

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


def build_comparison_prompt(ticket_data: dict, kba_draft: dict) -> str:
    """
    Build prompt for comparing ticket problem with existing KBA draft
    
    Analyzes whether the existing KBA adequately covers the ticket's problem,
    using structured criteria: problem/symptom match, cause alignment,
    solution coverage, completeness, clarity, and redundancy risk.
    
    Args:
        ticket_data: Dictionary with ticket fields (summary, notes, resolution, etc.)
        kba_draft: Dictionary with KBA draft fields (title, symptoms, cause, resolution_steps, etc.)
        
    Returns:
        Prompt string for LLM comparison analysis
    """
    
    # Extract ticket fields
    ticket_summary = ticket_data.get("summary", "Keine Zusammenfassung")
    ticket_notes = ticket_data.get("notes") or "Keine Notizen"
    ticket_resolution = ticket_data.get("resolution") or "Keine Lösung dokumentiert"
    ticket_status = ticket_data.get("status", "Unbekannt")
    ticket_priority = ticket_data.get("priority", "Unbekannt")
    
    # Extract KBA fields
    kba_title = kba_draft.get("title", "Kein Titel")
    kba_symptoms = kba_draft.get("symptoms", [])
    kba_cause = kba_draft.get("cause") or "Keine Ursache dokumentiert"
    kba_resolution_steps = kba_draft.get("resolution_steps", [])
    kba_tags = kba_draft.get("tags", [])
    kba_validation_checks = kba_draft.get("validation_checks", [])
    kba_warnings = kba_draft.get("warnings", [])
    kba_status = kba_draft.get("status", "draft")
    kba_created_at = kba_draft.get("created_at", "Unbekannt")
    
    # Format lists for display
    symptoms_text = "\n".join([f"  - {s}" for s in kba_symptoms]) if kba_symptoms else "  (keine Symptome)"
    resolution_steps_text = "\n".join([f"  {i+1}. {step}" for i, step in enumerate(kba_resolution_steps)]) if kba_resolution_steps else "  (keine Schritte)"
    tags_text = ", ".join(kba_tags) if kba_tags else "(keine Tags)"
    validation_text = "\n".join([f"  - {v}" for v in kba_validation_checks]) if kba_validation_checks else "  (keine Validierungen)"
    warnings_text = "\n".join([f"  - {w}" for w in kba_warnings]) if kba_warnings else "  (keine Warnungen)"
    
    prompt = f"""Du bist ein Experte für IT-Support-Dokumentation und Knowledge Base Management.

AUFGABE: Vergleiche das folgende Ticket-Problem mit einem bestehenden KBA-Entwurf und bewerte, ob der bestehende KBA das Problem bereits ausreichend abdeckt oder ob ein neuer KBA erstellt werden sollte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET-PROBLEM (NEU):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Zusammenfassung: {ticket_summary}
Status: {ticket_status}
Priorität: {ticket_priority}

Notizen/Beschreibung:
{ticket_notes}

Dokumentierte Lösung:
{ticket_resolution}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BESTEHENDER KBA-ENTWURF:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Titel: {kba_title}
Status: {kba_status}
Erstellt: {kba_created_at}

Symptome:
{symptoms_text}

Ursache:
{kba_cause}

Lösungsschritte:
{resolution_steps_text}

Validierungschecks:
{validation_text}

Warnungen:
{warnings_text}

Tags: {tags_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERGLEICHSKRITERIEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bewerte folgende Aspekte strukturiert:

1. **Problem-/Symptom-Übereinstimmung**
   - Beschreibt der KBA die gleichen oder sehr ähnliche Symptome?
   - Würde ein Benutzer mit dem Ticket-Problem den KBA finden?

2. **Ursache-Übereinstimmung**
   - Ist die Root Cause identisch oder kompatibel?
   - Falls Ursache im Ticket fehlt: Ist die KBA-Ursache plausibel?

3. **Lösungsabdeckung**
   - Würde die KBA-Lösung das Ticket-Problem beheben?
   - Sind die Schritte vollständig und anwendbar?

4. **Vollständigkeit**
   - Enthält der KBA alle wichtigen Informationen (Symptome, Ursache, Lösung, Validierung)?
   - Fehlen wichtige Details aus dem Ticket?

5. **Verständlichkeit**
   - Ist der KBA klar formuliert und für Endbenutzer verständlich?
   - Sind die Schritte präzise und nachvollziehbar?

6. **Aktualität** (falls erkennbar)
   - Basiert der KBA auf aktuellen Systemen/Prozessen?
   - Gibt es Hinweise auf veraltete Informationen?

7. **Risiko von Duplikat/Redundanz**
   - Würde ein neuer KBA redundant sein?
   - Oder gibt es genug Unterschiede, um einen separaten KBA zu rechtfertigen?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTSCHEIDUNGSLOGIK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**recommendation = "keep_existing"** WENN:
- Problem/Symptome sind identisch oder sehr ähnlich (>80% Übereinstimmung)
- KBA-Lösung würde das Ticket-Problem beheben
- KBA ist vollständig und verständlich
- Neuer KBA wäre redundant
- duplicate_likelihood >= 0.7

**recommendation = "create_new"** WENN:
- Problem/Symptome unterscheiden sich deutlich (<60% Übereinstimmung)
- KBA-Lösung passt nicht zum Ticket-Problem
- Ticket enthält neue/spezifische Aspekte, die einen eigenen KBA rechtfertigen
- duplicate_likelihood < 0.5

**recommendation = "merge_candidate"** WENN:
- Moderate Übereinstimmung (60-80%)
- Beide decken Teilaspekte ab
- Ein zusammengefasster KBA wäre besser als zwei getrennte
- duplicate_likelihood 0.5-0.7

**WICHTIG**: Wenn der bestehende KBA das Problem ausreichend abdeckt, empfehle standardmäßig **keep_existing** statt unnötig einen neuen KBA zu erstellen. Redundanzvermeidung ist wichtig!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT-FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antworte NUR mit einem JSON-Objekt (kein zusätzlicher Text davor oder danach!), das diesem Schema entspricht:

```json
{json.dumps(KBA_COMPARISON_SCHEMA, indent=2, ensure_ascii=False)}
```

BEISPIEL eines gültigen Outputs:
```json
{{
  "duplicate_likelihood": 0.85,
  "match_summary": "Das Ticket beschreibt VPN-Verbindungsprobleme unter Windows 11 mit Timeout-Fehler. Der bestehende KBA behandelt exakt dieses Problem mit identischen Symptomen und vollständiger Lösung.",
  "strengths_existing_kba": [
    "Vollständige Schritt-für-Schritt-Anleitung",
    "Klare Symptombeschreibung passt exakt zum Ticket",
    "Validierungschecks vorhanden",
    "Lösung ist getestet und bewährt"
  ],
  "gaps_existing_kba": [
    "Keine spezifischen Warnungen für Windows 11 22H2",
    "Fehlt Troubleshooting für alternative Szenarien"
  ],
  "recommendation": "keep_existing",
  "recommendation_reason": "Der bestehende KBA deckt das Ticket-Problem vollständig ab. Die Symptome sind identisch, die Lösung ist anwendbar und getestet. Ein neuer KBA wäre redundant und würde die Knowledge Base unnötig aufblähen. Empfehlung: Bestehenden KBA verwenden und ggf. Cross-Reference zum Ticket hinzufügen.",
  "confidence_notes": "Sehr hohe Konfidenz (0.85) aufgrund identischer Symptombeschreibung und bewährter Lösung. Einzige Unsicherheit: Ticket könnte spezifische Windows 11 22H2-Variante sein, aber Lösung sollte trotzdem funktionieren."
}}
```

REGELN FÜR DIE AUSGABE:
- **duplicate_likelihood**: Numerischer Wert 0.0-1.0 (nicht boolean!)
- **match_summary**: Prägnante Zusammenfassung (100-500 Zeichen)
- **strengths_existing_kba**: Array mit 1-8 konkreten Stärken
- **gaps_existing_kba**: Array mit 0-8 konkreten Lücken (kann leer sein wenn keine Lücken)
- **recommendation**: EXAKT einer der Werte: "keep_existing", "create_new", "merge_candidate"
- **recommendation_reason**: Ausführliche Begründung (200-800 Zeichen)
- **confidence_notes**: Optional, nur wenn Unsicherheiten bestehen (max 500 Zeichen)

NUR JSON ausgeben, kein zusätzlicher Text oder Markdown-Wrapper!
BEGINNE MIT DEM JSON:"""
    
    return prompt


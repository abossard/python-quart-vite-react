"""
KBA JSON Schemas

JSON Schema definitions for validating LLM output.
Used as reference schema - OpenAI uses Pydantic models (kba_output_models.py)
for structured output, but this schema is kept for documentation and
backward compatibility.

The schema defines the expected structure for KBA draft content.
"""

# JSON Schema Draft 7 for KBA output validation
KBA_OUTPUT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "KBA Draft Output",
    "description": "Schema for LLM-generated KBA draft content with structured problem analysis",
    "type": "object",
    "required": ["title", "symptoms", "resolution_steps", "tags"],
    "properties": {
        "title": {
            "type": "string",
            "minLength": 10,
            "maxLength": 200,
            "description": "SEO-optimized KBA title with keywords"
        },
        # Problem Analysis
        "symptoms": {
            "type": "array",
            "minItems": 1,
            "maxItems": 10,
            "items": {
                "type": "string",
                "minLength": 10
            },
            "description": "Observable symptoms, error messages, failure modes"
        },
        "cause": {
            "type": "string",
            "maxLength": 1000,
            "description": "Root cause analysis - why does this problem occur?"
        },
        # Solution
        "resolution_steps": {
            "type": "array",
            "minItems": 1,
            "maxItems": 20,
            "items": {
                "type": "string",
                "minLength": 10
            },
            "description": "Step-by-step resolution procedure"
        },
        "validation_checks": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "string",
                "minLength": 5
            },
            "description": "Steps to verify the solution worked"
        },
        # Additional Information
        "warnings": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "string",
                "minLength": 10
            },
            "description": "Important warnings, precautions, side effects"
        },
        "confidence_notes": {
            "type": "string",
            "maxLength": 500,
            "description": "LLM confidence notes, uncertainties, limitations"
        },
        # Metadata
        "tags": {
            "type": "array",
            "minItems": 2,
            "maxItems": 10,
            "items": {
                "type": "string",
                "pattern": "^[a-z0-9-]+$",
                "minLength": 2
            },
            "description": "Lowercase tags for search (e.g., vpn, windows, network)"
        },
        "related_tickets": {
            "type": "array",
            "items": {
                "type": "string",
                "pattern": "^INC[0-9]{7}$"
            },
            "description": "Related incident IDs in format INC0001234"
        },
        # Legacy fields (optional for backward compatibility)
        "problem_description": {
            "type": "string",
            "maxLength": 2000,
            "description": "[DEPRECATED] Use symptoms/cause instead"
        },
        "additional_notes": {
            "type": "string",
            "maxLength": 1000,
            "description": "Optional additional context"
        }
    },
    "additionalProperties": False
}


# Example valid JSON output (for LLM prompts - reference only)
KBA_OUTPUT_EXAMPLE = {
    "title": "VPN-Verbindungsprobleme unter Windows 11 beheben",
    "symptoms": [
        "VPN-Verbindung bricht nach 30 Sekunden automatisch ab",
        "Fehlermeldung im OpenVPN-Client: 'Connection timeout (Error 10060)'",
        "Symbol im System Tray zeigt 'Connecting...' dauerhaft an"
    ],
    "cause": "Windows Firewall blockiert UDP-Port 1194 für ausgehende OpenVPN-Verbindungen. Dies tritt nach Windows 11 Updates auf, die Firewall-Regeln zurücksetzen.",
    "resolution_steps": [
        "VPN-Client vollständig beenden: Rechtsklick auf Icon im System Tray → 'Beenden'",
        "Windows Firewall-Einstellungen öffnen: Start → 'Windows Defender Firewall' → 'Erweiterte Einstellungen'",
        "Neue Ausgangsregel erstellen: 'Ausgangsregeln' → 'Neue Regel' → Port UDP 1194 freigeben",
        "VPN-Client neu starten und Verbindung testen"
    ],
    "validation_checks": [
        "VPN-Verbindung bleibt länger als 2 Minuten stabil",
        "Zugriff auf Intranet-Ressourcen (z.B. \\\\\\\\fileserver) funktioniert",
        "VPN-Client zeigt 'Connected' Status dauerhaft an"
    ],
    "warnings": [
        "Firewall-Änderungen erfordern lokale Administrator-Rechte",
        "Vor Änderungen Backup der Firewall-Regeln erstellen (netsh advfirewall export)"
    ],
    "confidence_notes": "Lösung gilt für OpenVPN 2.x Clients. Bei anderen VPN-Protokollen (IPsec, WireGuard) können andere Ports betroffen sein.",
    "tags": ["vpn", "openvpn", "windows11", "firewall", "connection-timeout"],
    "related_tickets": ["INC0001234", "INC0002456"]
}

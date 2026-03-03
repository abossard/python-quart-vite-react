"""
KBA Output Models - Pydantic Schemas for OpenAI Structured Output

Pydantic models that define the structure for LLM-generated KBA content.
Used with OpenAI's native structured output feature for automatic parsing
and validation.

Replaces JSON Schema approach (kba_schemas.py) with type-safe Pydantic models.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class KBAOutputSchema(BaseModel):
    """
    Schema for LLM-generated KBA draft content with structured problem analysis.
    
    Used with OpenAI's beta.chat.completions.parse() for automatic validation.
    """
    
    # Title
    title: str = Field(
        ...,
        min_length=10,
        max_length=200,
        description="SEO-optimized KBA title with keywords"
    )
    
    # Problem Analysis
    symptoms: list[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Observable symptoms, error messages, failure modes"
    )
    
    cause: Optional[str] = Field(
        default="",
        max_length=1000,
        description="Root cause analysis - why does this problem occur?"
    )
    
    # Solution
    resolution_steps: list[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Step-by-step resolution procedure"
    )
    
    validation_checks: Optional[list[str]] = Field(
        default_factory=list,
        max_length=10,
        description="Steps to verify the solution worked"
    )
    
    # Additional Information
    warnings: Optional[list[str]] = Field(
        default_factory=list,
        max_length=5,
        description="Important warnings, precautions, side effects"
    )
    
    confidence_notes: Optional[str] = Field(
        default="",
        max_length=500,
        description="LLM confidence notes, uncertainties, limitations"
    )
    
    # Metadata
    tags: list[str] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Lowercase tags for search (e.g., vpn, windows, network)"
    )
    
    related_tickets: Optional[list[str]] = Field(
        default_factory=list,
        description="Related incident IDs in format INC0001234"
    )
    
    # Legacy fields (optional for backward compatibility)
    problem_description: Optional[str] = Field(
        default="",
        max_length=2000,
        description="[DEPRECATED] Use symptoms/cause instead"
    )
    
    additional_notes: Optional[str] = Field(
        default="",
        max_length=1000,
        description="Optional additional context"
    )
    
    # Validators
    @field_validator('symptoms')
    @classmethod
    def validate_symptoms(cls, v: list[str]) -> list[str]:
        """Ensure each symptom is at least 10 characters"""
        if not all(len(s.strip()) >= 10 for s in v):
            raise ValueError("Each symptom must be at least 10 characters long")
        return v
    
    @field_validator('resolution_steps')
    @classmethod
    def validate_resolution_steps(cls, v: list[str]) -> list[str]:
        """Ensure each resolution step is at least 10 characters"""
        if not all(len(s.strip()) >= 10 for s in v):
            raise ValueError("Each resolution step must be at least 10 characters long")
        return v
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        """Ensure tags are lowercase and properly formatted - allows German umlauts"""
        import re
        for tag in v:
            # Allow lowercase ASCII, numbers, hyphens, and German umlauts (ä, ö, ü, ß)
            if not re.match(r'^[a-z0-9äöüß-]+$', tag) or len(tag) < 2:
                raise ValueError(
                    f"Tag '{tag}' must be lowercase alphanumeric (incl. äöüß) with hyphens, min 2 chars"
                )
        return v
    
    @field_validator('related_tickets')
    @classmethod
    def validate_related_tickets(cls, v: list[str]) -> list[str]:
        """Ensure ticket IDs match INC format - supports 12-digit format"""
        import re
        for ticket in v:
            # Support real format: INC000016312744 (12 digits)
            if not re.match(r'^INC[0-9]{12}$', ticket):
                raise ValueError(
                    f"Ticket ID '{ticket}' must match format INC000012345678 (INC + 12 digits)"
                )
        return v
    
    @field_validator('validation_checks')
    @classmethod
    def validate_validation_checks(cls, v: Optional[list[str]]) -> list[str]:
        """Ensure each validation check is at least 5 characters"""
        if v is None:
            return []
        if not all(len(s.strip()) >= 5 for s in v):
            raise ValueError("Each validation check must be at least 5 characters long")
        return v
    
    @field_validator('warnings')
    @classmethod
    def validate_warnings(cls, v: Optional[list[str]]) -> list[str]:
        """Ensure each warning is at least 10 characters"""
        if v is None:
            return []
        if not all(len(s.strip()) >= 10 for s in v):
            raise ValueError("Each warning must be at least 10 characters long")
        return v
    
    model_config = {
        # Forbid extra fields
        "extra": "forbid",
        # JSON schema example
        "json_schema_extra": {
            "example": {
                "title": "VPN-Verbindungsprobleme unter Windows 11 beheben",
                "symptoms": [
                    "VPN-Verbindung bricht nach 30 Sekunden automatisch ab",
                    "Fehlermeldung im OpenVPN-Client: 'Connection timeout (Error 10060)'",
                    "Symbol im System Tray zeigt 'Connecting...' dauerhaft an"
                ],
                "cause": "Windows Firewall blockiert UDP-Port 1194 für ausgehende OpenVPN-Verbindungen.",
                "resolution_steps": [
                    "Windows Firewall öffnen über Systemsteuerung",
                    "Neue ausgehende Regel für UDP-Port 1194 erstellen",
                    "OpenVPN-Service neu starten"
                ],
                "validation_checks": [
                    "VPN-Verbindung bleibt für mindestens 5 Minuten stabil",
                    "Keine Timeout-Fehler mehr im OpenVPN-Log"
                ],
                "warnings": [
                    "Administrator-Rechte erforderlich für Firewall-Änderungen"
                ],
                "confidence_notes": "Lösung basiert auf häufigem Windows 11 Update-Problem",
                "tags": ["vpn", "windows-11", "firewall", "openvpn", "timeout"],
                "related_tickets": [],
                "problem_description": "",
                "additional_notes": ""
            }
        }
    }

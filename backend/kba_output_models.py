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
    
    # Search Questions (generated separately, not part of main draft generation)
    search_questions: Optional[list[str]] = Field(
        default_factory=list,
        description="User search queries - generated in separate step"
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
        """Ensure ticket IDs match INC format - supports 9-12 digit format"""
        import re
        for ticket in v:
            # Support both short (INC000016346) and full format (INC000016312744)
            # INC followed by 9-12 digits
            if not re.match(r'^INC[0-9]{9,12}$', ticket):
                raise ValueError(
                    f"Ticket ID '{ticket}' must match format INC + 9-12 digits (e.g., INC000016346)"
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
                "search_questions": [
                    "Wie behebe ich VPN-Verbindungsprobleme unter Windows 11?",
                    "VPN bricht nach 30 Sekunden ab was tun?",
                    "OpenVPN Connection Timeout Error 10060 lösen",
                    "Warum verbindet sich mein VPN nicht mehr?",
                    "Windows Firewall blockiert VPN-Verbindung"
                ],
                "problem_description": "",
                "additional_notes": ""
            }
        }
    }


# ============================================================================
# SEARCH QUESTIONS SCHEMA & VALIDATION
# ============================================================================

class SearchQuestionsSchema(BaseModel):
    """
    Schema for LLM-generated search questions (separate generation step).
    
    Used with OpenAI's beta.chat.completions.parse() for automatic validation.
    """
    
    questions: list[str] = Field(
        ...,
        min_length=5,
        max_length=15,
        description="User search queries - how users might search for this KBA"
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions_format(cls, v: list[str]) -> list[str]:
        """Basic validation - detailed cleaning happens in service layer"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        
        # Basic length checks
        for q in v:
            if not q or not q.strip():
                raise ValueError("Empty question not allowed")
            q_stripped = q.strip()
            if len(q_stripped) < 10:
                raise ValueError(f"Question too short (min 10 chars): '{q[:30]}...'")
            if len(q_stripped) > 200:
                raise ValueError(f"Question too long (max 200 chars): '{q[:50]}...'")
        
        return v
    
    model_config = {
        "extra": "forbid",
        "json_schema_extra": {
            "example": {
                "questions": [
                    "Wie behebe ich VPN-Verbindungsprobleme unter Windows 11?",
                    "VPN bricht nach 30 Sekunden ab was tun?",
                    "OpenVPN Connection Timeout Error 10060",
                    "Warum verbindet sich mein VPN nicht?",
                    "Windows Firewall blockiert VPN"
                ]
            }
        }
    }


def validate_and_clean_search_questions(
    questions: list[str],
    min_questions: int = 5,
    max_questions: int = 15
) -> list[str]:
    """
    Validate and clean search questions with deduplication.
    
    Args:
        questions: Raw questions from LLM
        min_questions: Minimum required questions
        max_questions: Maximum allowed questions
        
    Returns:
        Cleaned and deduplicated question list
        
    Raises:
        ValueError: If validation fails
    """
    import re
    
    # Step 1: Trim and filter empty
    cleaned = []
    for q in questions:
        q_stripped = q.strip()
        if q_stripped:
            cleaned.append(q_stripped)
    
    # Step 2: Validate length
    valid = []
    for q in cleaned:
        if 10 <= len(q) <= 200:
            valid.append(q)
    
    # Step 3: Deduplicate (case-insensitive, normalized)
    seen = set()
    deduplicated = []
    for q in valid:
        # Normalize: lowercase, remove extra whitespace
        normalized = re.sub(r'\s+', ' ', q.lower())
        if normalized not in seen:
            seen.add(normalized)
            deduplicated.append(q)  # Keep original casing
    
    # Step 4: Enforce min/max
    if len(deduplicated) < min_questions:
        raise ValueError(
            f"Only {len(deduplicated)} valid questions after cleaning "
            f"(required: {min_questions}). "
            f"Raw count: {len(questions)}, after filtering: {len(valid)}"
        )
    
    if len(deduplicated) > max_questions:
        # Truncate to max
        deduplicated = deduplicated[:max_questions]
    
    return deduplicated

"""
KBA Output Models - Pydantic Schemas for OpenAI Structured Output

Pydantic models that define the structure for LLM-generated KBA content.
Used with OpenAI's native structured output feature for automatic parsing
and validation.

Replaces JSON Schema approach (kba_schemas.py) with type-safe Pydantic models.
"""

from typing import Optional, Literal
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator, computed_field


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
    
    # New QC-related fields
    target_audience: Literal["L0_enduser", "L1_support"] = Field(
        default="L0_enduser",
        description="Zielgruppe: Endnutzer oder Support"
    )
    
    initial_question: str = Field(
        ...,
        min_length=10,
        max_length=200,
        description="W-Frage, die das Problem beschreibt"
    )
    
    article_layout_type: Literal["1_field", "2_field", "3_field"] = Field(
        default="2_field",
        description="Layout-Typ des Artikels"
    )
    
    technical_notes: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Technische Hinweise für IT-Personal (nur bei 3_field)"
    )
    
    media_references: list[str] = Field(
        default_factory=list,
        description="Liste von Bild-/Screenshot-Referenzen"
    )
    
    privacy_checked: bool = Field(
        default=False,
        description="PII-Prüfung durchgeführt?"
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
    
    @field_validator('initial_question')
    @classmethod
    def validate_w_question(cls, v: str) -> str:
        """Prüft ob W-Frage (heuristisch)"""
        w_words = ['warum', 'wie', 'was', 'wann', 'wo', 'wer', 'welche', 'wieso', 'weshalb']
        if not any(v.lower().startswith(w) for w in w_words):
            raise ValueError(
                f"initial_question sollte mit W-Wort beginnen (Warum, Wie, Was, ...). "
                f"Erhalten: '{v[:50]}...'"
            )
        return v
    
    @field_validator('technical_notes')
    @classmethod
    def validate_technical_notes_usage(cls, v: Optional[str], info) -> Optional[str]:
        """Technical Notes nur bei 3_field erlaubt"""
        if v and info.data.get('article_layout_type') != "3_field":
            layout = info.data.get('article_layout_type', 'unknown')
            raise ValueError(
                f"technical_notes nur bei article_layout_type='3_field' erlaubt, "
                f"nicht bei '{layout}'"
            )
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


# ============================================================================
# QUALITY CHECK MODELS
# ============================================================================

class GenerationMode(str, Enum):
    """Modus für /api/kba/generate"""
    DRAFT = "draft"
    QUALITY_CHECK = "quality_check"


class CriterionStatus(str, Enum):
    """Status eines Prüfkriteriums"""
    ERFUELLT = "erfüllt"
    TEILWEISE_ERFUELLT = "teilweise_erfüllt"
    NICHT_ERFUELLT = "nicht_erfüllt"


class OverallVerdict(str, Enum):
    """Gesamturteil des Quality Checks"""
    GEEIGNET = "geeignet"
    BEDINGT_GEEIGNET = "bedingt_geeignet"
    NICHT_GEEIGNET = "nicht_geeignet"


class QualityCriterionResult(BaseModel):
    """Ergebnis eines einzelnen Prüfkriteriums"""
    criterion_id: str = Field(..., description="z.B. '1.1', '2.1'")
    criterion_title: str = Field(..., description="z.B. 'Zielgruppe klar definiert'")
    status: CriterionStatus
    score: float = Field(..., ge=0.0, le=1.0, description="1.0 (erfüllt), 0.5 (teilweise), 0.0 (nicht erfüllt)")
    reason: str = Field(..., description="Begründung für Status (verpflichtend)")
    improvement_suggestion: Optional[str] = Field(None, description="Konkreter Verbesserungsvorschlag")
    is_critical_blocker: bool = Field(False, description="Kritischer Blocker?")
    
    @field_validator('score')
    @classmethod
    def validate_score_matching_status(cls, v: float, info) -> float:
        """Score muss zu Status passen"""
        status = info.data.get('status')
        if status == CriterionStatus.ERFUELLT and v != 1.0:
            raise ValueError("Status 'erfüllt' erfordert score=1.0")
        elif status == CriterionStatus.NICHT_ERFUELLT and v != 0.0:
            raise ValueError("Status 'nicht_erfüllt' erfordert score=0.0")
        elif status == CriterionStatus.TEILWEISE_ERFUELLT and not (0.0 < v < 1.0):
            raise ValueError("Status 'teilweise_erfüllt' erfordert 0.0 < score < 1.0")
        return v


class QualityCategoryResult(BaseModel):
    """Ergebnis einer QC-Kategorie"""
    category_id: str = Field(..., description="'1', '2', ... '9'")
    category_title: str = Field(..., description="'Zielgruppengerechtigkeit', etc.")
    criteria: list[QualityCriterionResult]
    score_percent: float = Field(..., ge=0.0, le=100.0, description="Berechnet, 1 Dezimalstelle")
    
    @computed_field
    @property
    def status(self) -> CriterionStatus:
        """Kategorie-Status basierend auf Score"""
        if self.score_percent >= 80.0:
            return CriterionStatus.ERFUELLT
        elif self.score_percent >= 50.0:
            return CriterionStatus.TEILWEISE_ERFUELLT
        else:
            return CriterionStatus.NICHT_ERFUELLT


class QualityCheckResult(BaseModel):
    """Vollständiges Quality Check Ergebnis"""
    overall_verdict: OverallVerdict
    score_percent: float = Field(..., ge=0.0, le=100.0, description="1 Dezimalstelle")
    categories: list[QualityCategoryResult]
    improvement_suggestions: list[str]
    critical_blockers: list[str]
    deterministic_findings: list[str] = Field(default_factory=list, description="Wichtig für Debugging")
    llm_summary: Optional[str] = Field(None, description="LLM-Zusammenfassung")
    disclaimer: str = Field(
        default=(
            "GPT gibt keine finale Freigabe. Technische Richtigkeit und finale "
            "Veröffentlichungsentscheidung liegen bei der verantwortlichen Person."
        ),
        description="Haftungsausschluss"
    )
    
    # Versionierung (für Nachvollziehbarkeit)
    qc_version: str = Field(default="1.0", description="Version der Scoring-Regeln")
    guideline_version: Optional[str] = Field(None, description="Hash/Datum von 35_*.md")
    
    @field_validator('score_percent')
    @classmethod
    def round_score(cls, v: float) -> float:
        """Rundet auf 1 Dezimalstelle"""
        return round(v, 1)


class GenerateKBARequest(BaseModel):
    """Request für /api/kba/generate"""
    ticket_id: Optional[str] = None
    draft_id: Optional[int] = None
    mode: GenerationMode = GenerationMode.DRAFT
    
    # QC-Optionen (optional)
    qc_strict_mode: bool = False
    qc_include_suggestions: bool = True
    
    @model_validator(mode='after')
    def validate_mode_requirements(self):
        """Validiert dass benötigte IDs vorhanden sind"""
        if self.mode == GenerationMode.DRAFT and not self.ticket_id:
            raise ValueError("ticket_id erforderlich für mode='draft'")
        if self.mode == GenerationMode.QUALITY_CHECK and not self.draft_id:
            raise ValueError("draft_id erforderlich für mode='quality_check'")
        return self


class GenerateResponse(BaseModel):
    """
    Unified Response für /api/kba/generate
    Garantiert genau ein Resultat (draft_result XOR quality_check_result)
    """
    mode: GenerationMode
    draft_result: Optional[dict] = None  # KBADraft as dict
    quality_check_result: Optional[QualityCheckResult] = None
    warnings: list[str] = Field(default_factory=list, description="Nicht-blockierende Hinweise")
    
    @model_validator(mode='after')
    def check_result_consistency(self):
        """Genau ein Resultat muss gesetzt sein (XOR)"""
        if self.mode == GenerationMode.DRAFT:
            if self.draft_result is None:
                raise ValueError("draft_result fehlt bei mode='draft'")
            if self.quality_check_result is not None:
                raise ValueError("quality_check_result darf bei mode='draft' nicht gesetzt sein")
        
        elif self.mode == GenerationMode.QUALITY_CHECK:
            if self.quality_check_result is None:
                raise ValueError("quality_check_result fehlt bei mode='quality_check'")
            if self.draft_result is not None:
                raise ValueError("draft_result darf bei mode='quality_check' nicht gesetzt sein")
        
        return self

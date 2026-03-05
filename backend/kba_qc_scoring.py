"""
Quality Check Scoring Engine

Kapselt Scoring-Logik für Testbarkeit und Wartbarkeit.
Implementiert die Scoring-Regeln Version 1.0.
"""

from backend.kba_output_models import (
    QualityCriterionResult,
    QualityCategoryResult,
    CriterionStatus,
    OverallVerdict
)


class QCScoringEngine:
    """Berechnet Scores und Verdicts gemäß definierter Regeln"""
    
    # Konstanten
    SCORE_ERFUELLT = 1.0
    SCORE_TEILWEISE = 0.5
    SCORE_NICHT_ERFUELLT = 0.0
    
    # Verdict-Schwellenwerte
    THRESHOLD_GEEIGNET = 80.0
    THRESHOLD_BEDINGT = 60.0
    
    # PII-Blocker-IDs (höchste Priorität)
    PII_BLOCKER_IDS = {"6.3", "6.4", "7.3"}
    
    @staticmethod
    def calculate_category_score(criteria: list[QualityCriterionResult]) -> float:
        """
        Berechnet Score einer Kategorie aus Kriterien
        
        Returns:
            0.0-100.0 (1 Dezimalstelle)
        """
        if not criteria:
            return 0.0
        
        total_score = sum(c.score for c in criteria)
        max_score = len(criteria) * QCScoringEngine.SCORE_ERFUELLT
        
        score_percent = (total_score / max_score) * 100.0
        return round(score_percent, 1)
    
    @staticmethod
    def calculate_total_score(categories: list[QualityCategoryResult]) -> float:
        """
        Berechnet Gesamt-Score aus Kategorien (gleichgewichtet)
        
        Returns:
            0.0-100.0 (1 Dezimalstelle)
        """
        if not categories:
            return 0.0
        
        total = sum(cat.score_percent for cat in categories)
        average = total / len(categories)
        return round(average, 1)
    
    @staticmethod
    def determine_verdict(
        score: float,
        critical_blockers: list[str],
        all_criteria: list[QualityCriterionResult]
    ) -> OverallVerdict:
        """
        Bestimmt Verdict gemäß Regeln (Version 1.0)
        
        Regeln:
        1. PII/Datenschutz-Blocker → IMMER nicht_geeignet
        2. Sonst Score-basiert:
           - <60% → nicht_geeignet
           - ≥60% und <80% → bedingt_geeignet
           - ≥80%:
             - 0 Blocker → geeignet
             - 1 nicht-PII-Blocker → bedingt_geeignet
             - ≥2 Blocker → nicht_geeignet
        """
        # Check 1: PII-Blocker? → IMMER nicht_geeignet
        has_pii_blocker = any(
            c.is_critical_blocker and c.criterion_id in QCScoringEngine.PII_BLOCKER_IDS
            for c in all_criteria
        )
        if has_pii_blocker:
            return OverallVerdict.NICHT_GEEIGNET
        
        # Check 2: Score-basiert
        blocker_count = len(critical_blockers)
        
        if score < QCScoringEngine.THRESHOLD_BEDINGT:  # <60%
            return OverallVerdict.NICHT_GEEIGNET
        
        elif score < QCScoringEngine.THRESHOLD_GEEIGNET:  # 60-79%
            return OverallVerdict.BEDINGT_GEEIGNET
        
        else:  # ≥80%
            if blocker_count == 0:
                return OverallVerdict.GEEIGNET
            elif blocker_count == 1:
                return OverallVerdict.BEDINGT_GEEIGNET
            else:  # ≥2 Blocker
                return OverallVerdict.NICHT_GEEIGNET
    
    @staticmethod
    def collect_critical_blockers(all_criteria: list[QualityCriterionResult]) -> list[str]:
        """Sammelt Texte aller kritischen Blocker"""
        blockers = []
        for c in all_criteria:
            if c.is_critical_blocker and c.status != CriterionStatus.ERFUELLT:
                blocker_text = f"{c.criterion_title} (Kriterium {c.criterion_id}): {c.reason}"
                blockers.append(blocker_text)
        return blockers
    
    @staticmethod
    def collect_improvement_suggestions(all_criteria: list[QualityCriterionResult]) -> list[str]:
        """Sammelt alle Verbesserungsvorschläge"""
        suggestions = []
        for c in all_criteria:
            if c.improvement_suggestion and c.status != CriterionStatus.ERFUELLT:
                suggestions.append(c.improvement_suggestion)
        return suggestions

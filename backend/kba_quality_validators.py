"""
Deterministische Quality Checks (kein LLM)

Schnelle, robuste, nachvollziehbare Checks die vor LLM-Aufruf ausgeführt werden.
Prüft strukturelle Aspekte und PII-Patterns.
"""

import re
from typing import Pattern

from backend.kba_models import KBADraft
from backend.kba_output_models import (
    QualityCriterionResult,
    CriterionStatus
)


class DeterministicQualityChecker:
    """Führt alle deterministischen Quality Checks durch"""
    
    # PII-Patterns (konservativ)
    EMAIL_PATTERN: Pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN: Pattern = re.compile(r'(\+41|0041|0)\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}')
    # Weitere Patterns nach Bedarf (AHV, etc.)
    
    def check_all(self, draft: KBADraft) -> tuple[list[QualityCriterionResult], list[str]]:
        """
        Führt alle deterministischen Checks durch
        
        Returns:
            (results, findings_text) - Kriterien-Resultate + menschenlesbare Findings
        """
        results = []
        findings = []
        
        # Pflichtfelder
        r, f = self._check_required_fields(draft)
        results.extend(r)
        findings.extend(f)
        
        # PII-Checks (höchste Priorität)
        r, f = self._check_pii_in_content(draft)
        results.extend(r)
        findings.extend(f)
        
        # Sprache & Format
        r, f = self._check_sie_form(draft)
        results.extend(r)
        findings.extend(f)
        
        r, f = self._check_exclamation_marks(draft)
        results.extend(r)
        findings.extend(f)
        
        r, f = self._check_uppercase_emphasis(draft)
        results.extend(r)
        findings.extend(f)
        
        r, f = self._check_step_verb_start(draft)
        results.extend(r)
        findings.extend(f)
        
        return results, findings
    
    def _check_required_fields(
        self, 
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """Prüft Pflichtfelder"""
        results = []
        findings = []
        
        # initial_question
        if not draft.initial_question:
            results.append(QualityCriterionResult(
                criterion_id="0.1",
                criterion_title="W-Frage vorhanden",
                status=CriterionStatus.NICHT_ERFUELLT,
                score=0.0,
                reason="initial_question fehlt",
                improvement_suggestion="Ergänzen Sie eine W-Frage, z.B. 'Warum funktioniert...?'",
                is_critical_blocker=True
            ))
            findings.append("❌ CRITICAL: initial_question fehlt")
        else:
            # Prüfe ob W-Frage
            w_words = ['warum', 'wie', 'was', 'wann', 'wo', 'wer', 'welche', 'wieso', 'weshalb']
            is_w_question = any(draft.initial_question.lower().startswith(w) for w in w_words)
            
            if not is_w_question:
                results.append(QualityCriterionResult(
                    criterion_id="5.1",
                    criterion_title="W-Frage korrekt formuliert",
                    status=CriterionStatus.NICHT_ERFUELLT,
                    score=0.0,
                    reason=f"Keine W-Frage: '{draft.initial_question[:50]}'",
                    improvement_suggestion="Formulieren Sie als W-Frage: 'Warum/Wie/Was...?'",
                    is_critical_blocker=True
                ))
                findings.append(f"❌ CRITICAL: Keine W-Frage: '{draft.initial_question[:30]}...'")
            else:
                results.append(QualityCriterionResult(
                    criterion_id="5.1",
                    criterion_title="W-Frage korrekt formuliert",
                    status=CriterionStatus.ERFUELLT,
                    score=1.0,
                    reason=f"W-Frage vorhanden: '{draft.initial_question[:50]}...'"
                ))
                findings.append("✓ W-Frage korrekt formuliert")
        
        # target_audience
        if not draft.target_audience:
            results.append(QualityCriterionResult(
                criterion_id="0.2",
                criterion_title="Zielgruppe definiert",
                status=CriterionStatus.NICHT_ERFUELLT,
                score=0.0,
                reason="target_audience fehlt",
                improvement_suggestion="Setzen Sie target_audience auf 'L0_enduser' oder 'L1_support'",
                is_critical_blocker=False
            ))
            findings.append("⚠️  target_audience fehlt")
        else:
            results.append(QualityCriterionResult(
                criterion_id="0.2",
                criterion_title="Zielgruppe definiert",
                status=CriterionStatus.ERFUELLT,
                score=1.0,
                reason=f"target_audience gesetzt: {draft.target_audience}"
            ))
            findings.append(f"✓ target_audience: {draft.target_audience}")
        
        return results, findings
    
    def _check_pii_in_content(
        self,
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """
        Prüft auf PII im Content (höchste Priorität)
        E-Mails, Telefonnummern, etc.
        """
        results = []
        findings = []
        pii_violations = []
        
        # Alle Text-Felder sammeln
        all_text = '\n'.join([
            draft.title or '',
            draft.cause or '',
            *draft.symptoms,
            *draft.resolution_steps,
            *draft.validation_checks,
            *draft.warnings,
            draft.confidence_notes or '',
            draft.technical_notes or ''
        ])
        
        # E-Mail-Check
        emails = self.EMAIL_PATTERN.findall(all_text)
        if emails:
            pii_violations.append(f"E-Mail-Adressen: {', '.join(set(emails))}")
        
        # Telefon-Check
        phones = self.PHONE_PATTERN.findall(all_text)
        if phones:
            pii_violations.append(f"Telefonnummern gefunden: {len(phones)} Treffer")
        
        # Resultat
        if pii_violations:
            results.append(QualityCriterionResult(
                criterion_id="7.3",
                criterion_title="Keine personenbezogenen Daten im Artikeltext",
                status=CriterionStatus.NICHT_ERFUELLT,
                score=0.0,
                reason=f"PII gefunden: {'; '.join(pii_violations)}",
                improvement_suggestion="Entfernen oder anonymisieren Sie alle PII (E-Mails, Telefon, Namen)",
                is_critical_blocker=True  # KRITISCH: Datenschutz
            ))
            findings.append(f"❌ DATENSCHUTZ-KRITISCH: PII gefunden: {'; '.join(pii_violations)}")
        else:
            results.append(QualityCriterionResult(
                criterion_id="7.3",
                criterion_title="Keine personenbezogenen Daten im Artikeltext",
                status=CriterionStatus.ERFUELLT,
                score=1.0,
                reason="Keine PII-Patterns gefunden (Email, Telefon)"
            ))
            findings.append("✓ Keine offensichtlichen PII-Patterns gefunden")
        
        return results, findings
    
    def _check_sie_form(
        self,
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """Prüft auf du/ihr statt Sie"""
        results = []
        findings = []
        
        violations = []
        total_steps = len(draft.resolution_steps)
        
        for i, step in enumerate(draft.resolution_steps):
            # Konservative Patterns (mit Leerzeichen, um Teilwörter zu vermeiden)
            if any(pattern in step.lower() for pattern in [' du ', ' dein', ' dich ', ' dir ', ' ihr ', ' euer', ' eure']):
                violations.append(i + 1)
        
        if total_steps == 0:
            violation_rate = 0.0
        else:
            violation_rate = len(violations) / total_steps
        
        is_blocker = violation_rate > 0.5  # >50% = kritisch
        
        if not violations:
            status = CriterionStatus.ERFUELLT
            score = 1.0
            reason = "Keine du/ihr-Form gefunden"
            suggestion = None
        elif violation_rate < 0.3:
            status = CriterionStatus.TEILWEISE_ERFUELLT
            score = 0.5
            reason = f"Sie-Form in {len(violations)}/{total_steps} Schritten verletzt ({int(violation_rate*100)}%)"
            suggestion = f"Ersetzen Sie 'du'/'ihr' durch 'Sie' in Schritt(en): {violations}"
        else:
            status = CriterionStatus.NICHT_ERFUELLT
            score = 0.0
            reason = f"Sie-Form in {len(violations)}/{total_steps} Schritten verletzt ({int(violation_rate*100)}%)"
            suggestion = f"Ersetzen Sie 'du'/'ihr' durch 'Sie' in Schritt(en): {violations}"
        
        results.append(QualityCriterionResult(
            criterion_id="2.1",
            criterion_title="Sie-Form durchgehend verwendet",
            status=status,
            score=score,
            reason=reason,
            improvement_suggestion=suggestion,
            is_critical_blocker=is_blocker
        ))
        
        if violations:
            findings.append(f"{'❌' if is_blocker else '⚠️'} Sie-Form verletzt in Schritt(en): {violations}")
        else:
            findings.append("✓ Sie-Form durchgehend verwendet")
        
        return results, findings
    
    def _check_exclamation_marks(
        self,
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """Prüft auf Ausrufezeichen in Anleitung"""
        results = []
        findings = []
        
        violations = [i+1 for i, step in enumerate(draft.resolution_steps) if '!' in step]
        
        if not violations:
            results.append(QualityCriterionResult(
                criterion_id="3.2a",
                criterion_title="Keine Ausrufezeichen in Anleitung",
                status=CriterionStatus.ERFUELLT,
                score=1.0,
                reason="Keine Ausrufezeichen gefunden"
            ))
            findings.append("✓ Keine Ausrufezeichen")
        else:
            results.append(QualityCriterionResult(
                criterion_id="3.2a",
                criterion_title="Keine Ausrufezeichen in Anleitung",
                status=CriterionStatus.NICHT_ERFUELLT,
                score=0.0,
                reason=f"Ausrufezeichen in Schritt(en): {violations}",
                improvement_suggestion="Entfernen Sie Ausrufezeichen, bleiben Sie sachlich"
            ))
            findings.append(f"⚠️  Ausrufezeichen in Schritt(en): {violations}")
        
        return results, findings
    
    def _check_uppercase_emphasis(
        self,
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """Prüft auf GROSSSCHRIFT (ganze Wörter in Caps)"""
        results = []
        findings = []
        
        violations = []
        for i, step in enumerate(draft.resolution_steps):
            # Finde Wörter in GROSSSCHRIFT (min 3 Buchstaben)
            words = re.findall(r'\b[A-ZÄÖÜ]{3,}\b', step)
            if words:
                violations.append((i+1, words))
        
        if not violations:
            results.append(QualityCriterionResult(
                criterion_id="3.2b",
                criterion_title="Keine GROSSSCHRIFT zur Betonung",
                status=CriterionStatus.ERFUELLT,
                score=1.0,
                reason="Keine GROSSSCHRIFT gefunden"
            ))
            findings.append("✓ Keine GROSSSCHRIFT")
        else:
            violation_details = [f"Schritt {step}: {', '.join(words)}" for step, words in violations]
            results.append(QualityCriterionResult(
                criterion_id="3.2b",
                criterion_title="Keine GROSSSCHRIFT zur Betonung",
                status=CriterionStatus.NICHT_ERFUELLT,
                score=0.0,
                reason=f"GROSSSCHRIFT gefunden: {'; '.join(violation_details)}",
                improvement_suggestion="Ersetzen Sie GROSSSCHRIFT durch **Fettschrift**"
            ))
            findings.append(f"⚠️  GROSSSCHRIFT in Schritt(en): {[v[0] for v in violations]}")
        
        return results, findings
    
    def _check_step_verb_start(
        self,
        draft: KBADraft
    ) -> tuple[list[QualityCriterionResult], list[str]]:
        """Prüft ob Schritte mit Verb beginnen (heuristisch)"""
        results = []
        findings = []
        
        # Häufige Imperativ-Verben
        common_verbs = [
            'öffnen', 'klicken', 'wählen', 'geben', 'drücken', 'tippen',
            'schliessen', 'bestätigen', 'eingeben', 'auswählen', 'starten',
            'beenden', 'speichern', 'löschen', 'kopieren', 'einfügen',
            'navigieren', 'scrollen', 'markieren', 'ziehen', 'laden',
            'installieren', 'deinstallieren', 'aktualisieren', 'prüfen',
            'kontrollieren', 'überprüfen', 'suchen', 'finden', 'anzeigen'
        ]
        
        violations = []
        for i, step in enumerate(draft.resolution_steps):
            first_word = step.split()[0].lower() if step.split() else ''
            if not any(first_word.startswith(verb) for verb in common_verbs):
                violations.append(i+1)
        
        total_steps = len(draft.resolution_steps)
        violation_rate = len(violations) / total_steps if total_steps > 0 else 0.0
        
        if violation_rate == 0.0:
            status = CriterionStatus.ERFUELLT
            score = 1.0
            reason = "Alle Schritte beginnen mit Verb"
        elif violation_rate < 0.3:
            status = CriterionStatus.TEILWEISE_ERFUELLT
            score = 0.5
            reason = f"{len(violations)}/{total_steps} Schritte beginnen nicht mit erkennbarem Verb"
        else:
            status = CriterionStatus.NICHT_ERFUELLT
            score = 0.0
            reason = f"{len(violations)}/{total_steps} Schritte beginnen nicht mit erkennbarem Verb"
        
        results.append(QualityCriterionResult(
            criterion_id="3.3",
            criterion_title="Arbeitsschritte beginnen mit Verb",
            status=status,
            score=score,
            reason=reason,
            improvement_suggestion="Formulieren Sie Schritte im Imperativ: 'Öffnen Sie...', 'Klicken Sie...'" if violations else None
        ))
        
        if violations:
            findings.append(f"⚠️  Schritte ohne erkennbares Verb: {violations} (Heuristik)")
        else:
            findings.append("✓ Alle Schritte beginnen mit Verb (Heuristik)")
        
        return results, findings

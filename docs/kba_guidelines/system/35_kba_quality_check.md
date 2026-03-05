# KBA Quality Check Kriterien

## Übersicht

Diese Guideline definiert die **inhaltlichen Quality Check Kriterien** für KBA-Artikel.
Basierend auf: `docs/KBA Quality Check.txt`

**Trennung:**
- `30_quality_checks.md` = Strukturelle/deterministische Checks
- Diese Datei = Inhaltliche Bewertung durch LLM

---

## Scoring-Regeln (Version 1.0)

### Kriterien-Punktevergabe

- **erfüllt** = 1.0 Punkt
- **teilweise_erfüllt** = 0.5 Punkte
- **nicht_erfüllt** = 0.0 Punkte

### Score-Berechnung

```
score_percent = (sum(alle_kriterien_punkte) / anzahl_kriterien) * 100
Rundung: round(score_percent, 1) → 1 Dezimalstelle
```

### Kritische Blocker (hart definiert)

**Datenschutz-Blocker (höchste Priorität):**
- **6.3/6.4:** PII in Bildern/Screenshots sichtbar
- **7.3:** Personenbezogene Daten im Artikeltext (E-Mail, Telefon, AHV-Nr, Namen)

**Inhaltliche Blocker:**
- **2.1:** Sie-Form in >50% der Schritte verletzt
- **5.1:** W-Frage fehlt komplett oder unrealistisch
- **5.3:** Problem nicht erkannt (tatsächliches Bedürfnis verfehlt)

### Gesamturteil-Logik (strikt)

**1. Datenschutz-Check (Override):**
- Wenn PII-/Datenschutz-Blocker vorhanden → **nicht_geeignet**
  (Selbst bei Score 95% → Datenschutz geht vor)

**2. Sonst Score-basiert:**
- Score < 60% → **nicht_geeignet**
- Score ≥ 60% UND < 80% → **bedingt_geeignet**
- Score ≥ 80%:
  - Keine Blocker → **geeignet**
  - 1 nicht-Datenschutz-Blocker → **bedingt_geeignet**
  - ≥2 Blocker → **nicht_geeignet**

**Definition "mehrere Blocker":** ≥2 kritische Blocker

---

## 1. Zielgruppengerechtigkeit

### 1.1 Ist klar, für wen der Artikel gedacht ist?

**Prüfkriterien:**
- Feld `target_audience` korrekt gesetzt (L0_enduser vs. L1_support)
- Sprachniveau passt zur Zielgruppe
- Detailtiefe angemessen

**erfüllt:** Zielgruppe klar definiert und durchgehend berücksichtigt  
**teilweise_erfüllt:** Zielgruppe definiert, aber stellenweise inkonsistent  
**nicht_erfüllt:** Zielgruppe unklar oder nicht konsistent

### 1.2 Ist er für Endkunden ohne technisches Vorwissen verständlich?

**Prüfkriterien (bei target_audience = L0_enduser):**
- Kein unerklärter Fachjargon
- Technische Konzepte allgemeinverständlich erklärt
- Schritte auch für Laien nachvollziehbar

**erfüllt:** Vollständig für Laien verständlich  
**teilweise_erfüllt:** Meist verständlich, einzelne Fachbegriffe ohne Erklärung  
**nicht_erfüllt:** Zu technisch, für Laien nicht nachvollziehbar

---

## 2. Sprache & Stil

### 2.1 Sie-Form verwendet?

**Prüfkriterien:**
- Durchgehend "Sie" (nie "du", "ihr", "man")
- Direkte Anrede ohne Passivkonstruktionen

**erfüllt:** Sie-Form in allen Schritten (>95%)  
**teilweise_erfüllt:** Sie-Form mehrheitlich verwendet (70-95%)  
**nicht_erfüllt:** Sie-Form in <70% der Schritte oder >50% verletzt

**BLOCKER:** Wenn >50% der Schritte du/ihr-Form verwenden

**Hinweis:** Deterministische Prüfung bereits durchgeführt. LLM prüft inhaltliche Konsistenz.

### 2.2 Kurze, klare Sätze?

**Prüfkriterien:**
- Satzlänge durchschnittlich <20 Wörter
- Ein Gedanke pro Satz
- Keine verschachtelten Nebensätze

**erfüllt:** Alle Sätze kurz und klar  
**teilweise_erfüllt:** Mehrheitlich kurz, einzelne lange Sätze (20-30 Wörter)  
**nicht_erfüllt:** Viele lange/verschachtelte Sätze (>30 Wörter)

### 2.3 Keine Schachtelsätze oder Fachjargon ohne Erklärung?

**Prüfkriterien:**
- Max. 1 Nebensatz pro Satz
- Fachjargon nur mit direkter Erklärung in Klammern
- Beispiel: "DNS-Cache (Zwischenspeicher für Webadressen)"

**erfüllt:** Keine Schachtelsätze, kein unerklärter Fachjargon  
**teilweise_erfüllt:** Einzelne Schachtelsätze oder 1-2 unerkärte Fachbegriffe  
**nicht_erfüllt:** Häufige Schachtelsätze oder viel unerklärter Fachjargon

---

## 3. Struktur

### 3.1 Übersichtliche Gliederung mit nummerierten Schritten?

**Prüfkriterien:**
- Lösungsschritte nummeriert und sequenziell
- Logischer Ablauf (keine Sprünge)
- Nachvollziehbare Reihenfolge

**erfüllt:** Klare, logische Struktur  
**teilweise_erfüllt:** Struktur erkennbar, kleinere Logik-Lücken  
**nicht_erfüllt:** Unübersichtlich, Schritte nicht nachvollziehbar

### 3.2 Verzicht auf Klammern, GROSSSCHRIFT und Ausrufezeichen?

**Prüfkriterien:**
- Keine unnötigen Klammern (außer Erklärungen)
- Keine GROSSSCHRIFT zur Betonung
- Keine Ausrufezeichen in Anleitung

**erfüllt:** Keine Verstöße  
**teilweise_erfüllt:** 1-2 Verstöße  
**nicht_erfüllt:** Mehrere Verstöße

**Hinweis:** Deterministische Prüfung bereits durchgeführt. LLM prüft Gesamteindruck.

### 3.3 Arbeitsanweisungen mit Verben begonnen?

**Prüfkriterien:**
- Schritte beginnen mit Imperativ-Verb
- Beispiele: "Öffnen Sie...", "Klicken Sie...", "Geben Sie ein..."

**erfüllt:** Alle Schritte beginnen mit Verb (>90%)  
**teilweise_erfüllt:** Mehrheitlich (70-90%)  
**nicht_erfüllt:** <70% beginnen mit Verb

### 3.4 Direkte Anrede

**Prüfkriterien:**
- Aktive statt passive Formulierungen
- "Öffnen Sie..." statt "Es wird geöffnet..."
- Keine unpersönlichen Konstruktionen

**erfüllt:** Durchgehend direkte Anrede  
**teilweise_erfüllt:** Mehrheitlich direkt, einzelne Passivkonstruktionen  
**nicht_erfüllt:** Häufig passiv oder unpersönlich

---

## 4. Titel & Keywords

### 4.1 Startet der Titel mit dem Produktnamen?

**Prüfkriterien:**
- Produktname am Anfang (z.B. "Windows", "Outlook", "VPN")
- Struktur: [Produkt] – [Problem] – [Kontext/Fehlermeldung]

**erfüllt:** Produktname klar am Anfang  
**teilweise_erfüllt:** Produkt erwähnt, aber nicht am Anfang  
**nicht_erfüllt:** Produktname fehlt oder unklar

### 4.2 Entspricht der Titel einer realistisch zu erwartenden Suchanfrage?

**Prüfkriterien:**
- Nutzer würden so suchen
- Präzise Problemformulierung (nicht zu allgemein)
- Enthält relevante Keywords

**erfüllt:** Titel = realistische Suchanfrage  
**teilweise_erfüllt:** Titel verständlich, aber nicht optimal für Suche  
**nicht_erfüllt:** Titel zu technisch oder zu allgemein

### 4.3 Sind Keywords präzise und relevant?

**Prüfkriterien:**
- Keywords decken Hauptproblem ab
- Keine redundanten oder irrelevanten Keywords
- Enthalten wichtige Suchbegriffe

**erfüllt:** Keywords präzise und vollständig  
**teilweise_erfüllt:** Keywords größtenteils relevant, einzelne fehlen/irrelevant  
**nicht_erfüllt:** Keywords unpräzise, irrelevant oder unvollständig

---

## 5. W-Fragen & Problemverständnis

### 5.1 Ist die Ausgangsfrage realistisch und präzise formuliert?

**Prüfkriterien:**
- `initial_question` ist echte W-Frage
- Frage spiegelt tatsächliches Nutzerproblem
- Nicht zu technisch formuliert

**erfüllt:** W-Frage präzise und realistisch  
**teilweise_erfüllt:** W-Frage vorhanden, aber unpräzise oder zu technisch  
**nicht_erfüllt:** Keine W-Frage oder unrealistisch

**BLOCKER:** Wenn W-Frage fehlt oder völlig unrealistisch

### 5.2 Ist sie als W-Frage geschrieben?

**Prüfkriterien:**
- Beginnt mit W-Wort (Warum, Wie, Was, Wann, Wo, Wer, Welche, Wieso, Weshalb)
- Endet mit Fragezeichen

**erfüllt:** Korrekte W-Frage  
**teilweise_erfüllt:** W-Wort vorhanden, Formulierung suboptimal  
**nicht_erfüllt:** Keine W-Frage

**Hinweis:** Deterministische Prüfung bereits durchgeführt.

### 5.3 Wird das tatsächliche Bedürfnis erkannt und adressiert?

**Prüfkriterien:**
- Unterscheidung Symptom vs. eigentliches Problem
- Lösung adressiert Grundbedürfnis (nicht nur Symptom)
- Beispiel: "Warum ist Internet langsam?" → Bedürfnis = schnelles Internet, nicht nur Diagnose

**erfüllt:** Tatsächliches Bedürfnis erkannt und adressiert  
**teilweise_erfüllt:** Symptom adressiert, Grundbedürfnis nur teilweise  
**nicht_erfüllt:** Nur Symptom behandelt, Bedürfnis verfehlt

**BLOCKER:** Wenn Problem komplett verfehlt

---

## 6. Bild- und Mediennutzung

### 6.1 Sind unterstützende Bilder gut gewählt?

**Prüfkriterien (falls media_references vorhanden):**
- Bilder unterstützen Verständnis
- Zeigen relevante Schritte/UI-Elemente
- Qualität ausreichend

**erfüllt:** Bilder sinnvoll und hilfreich  
**teilweise_erfüllt:** Bilder teils hilfreich, teils redundant  
**nicht_erfüllt:** Bilder wenig hilfreich oder irreführend

**Falls keine Bilder:** N/A oder erfüllt (wenn nicht nötig)

### 6.2 Ist der Problemlösungsweg auch ohne Bilder vollständig verständlich?

**Prüfkriterien:**
- Text allein ausreichend für Problemlösung
- Bilder nur Ergänzung, nicht Voraussetzung
- Alle Schritte textuell beschrieben

**erfüllt:** Ohne Bilder vollständig verständlich  
**teilweise_erfüllt:** Text größtenteils ausreichend, stellenweise unklar ohne Bild  
**nicht_erfüllt:** Bilder zwingend erforderlich, Text unvollständig

### 6.3 Datenschutz eingehalten?

**Prüfkriterien:**
- `privacy_checked = true` oder keine Bilder
- Keine PII-Hinweise in `media_references`

**erfüllt:** Datenschutz eingehalten  
**teilweise_erfüllt:** Unklar, manuelle Prüfung erforderlich  
**nicht_erfüllt:** PII-Verdacht in Bild-Referenzen

**BLOCKER:** Wenn PII in Bildern vermutet

### 6.4 Enthält das Bild keine personenbezogenen Daten oder sind sie ausgegraut?

**Prüfkriterien:**
- Keine sichtbaren Namen, E-Mails, User-IDs, Telefonnummern
- Falls nötig: Redaktion (Schwärzung/Pixelierung)

**erfüllt:** Keine PII oder korrekt redaktiert  
**teilweise_erfüllt:** Unklar, manuelle Prüfung erforderlich  
**nicht_erfüllt:** PII-Verdacht

**BLOCKER:** Wenn PII in Bildern vorhanden

**Hinweis:** Deterministische Text-PII-Prüfung bereits durchgeführt. LLM prüft Bild-Metadaten.

---

## 7. Technische Umsetzung

### 7.1 Sind die Inhalte als 1-/2-/3-Feld-Artikel klar erkennbar?

**Prüfkriterien:**
- `article_layout_type` passt zum Inhalt:
  - **1-Feld:** Nur Symptom + Lösung (Schnellanleitung)
  - **2-Feld:** + Ursache (Standard-KBA)
  - **3-Feld:** + Technical Notes (für L1-Support)

**erfüllt:** Layout-Typ passt perfekt  
**teilweise_erfüllt:** Layout-Typ passt größtenteils, könnte optimiert werden  
**nicht_erfüllt:** Falscher Layout-Typ gewählt

### 7.2 Sind "Technical Notes" korrekt platziert?

**Prüfkriterien (falls vorhanden):**
- Nur bei `article_layout_type = "3_field"`
- Enthalten technische Details für IT-Personal
- Getrennt von Endnutzer-Anleitung

**erfüllt:** Technical Notes korrekt platziert und passend  
**teilweise_erfüllt:** Technical Notes vorhanden, aber nicht optimal getrennt  
**nicht_erfüllt:** Technical Notes fehlen (bei 3-field) oder falsch platziert

**Falls nicht vorhanden:** N/A

### 7.3 Enthält der Artikel keine personenbezogenen Daten?

**Prüfkriterien:**
- Keine E-Mail-Adressen
- Keine Telefonnummern
- Keine vollständigen Namen
- Keine AHV-/Kundennummern
- Keine internen User-IDs

**erfüllt:** Keine PII im Text  
**teilweise_erfüllt:** Unklar, manuelle Prüfung erforderlich  
**nicht_erfüllt:** PII im Text gefunden

**BLOCKER:** Wenn PII im Artikeltext vorhanden (höchste Priorität!)

**Hinweis:** Deterministische Prüfung bereits durchgeführt.

---

## 8. Verbesserungsvorschläge

### 8.1 Konkret, handlungsorientiert

**Anforderungen an Verbesserungsvorschläge:**

**Richtig (konkret):**
- ✓ "Formulieren Sie Titel um zu: 'Windows VPN – Verbindung schlägt fehl nach Update KB5001234'"
- ✓ "Ergänzen Sie in Schritt 3: 'DNS-Cache (Zwischenspeicher für Webadressen)'"
- ✓ "Ersetzen Sie in Schritt 2 'du' durch 'Sie': 'Öffnen Sie...' statt 'Öffne...'"

**Falsch (zu vage):**
- ✗ "Titel könnte besser sein"
- ✗ "Mehr Details wären gut"
- ✗ "Überarbeiten Sie die Sprache"

**Format:**
- Imperativ: "Formulieren Sie...", "Ergänzen Sie...", "Ersetzen Sie..."
- Mit konkretem Beispiel oder exakter Formulierung
- Zeigt wo (Schritt-Nummer, Feldname) und was geändert werden soll

### 8.2 Gibt in Prozent an, wie viele Kriterien erfüllt sind

**Berechnung:**
- Automatisch durch System
- `score_percent = (erfüllte_kriterien_punkte / gesamt_punkte) * 100`
- Rundung auf 1 Dezimalstelle

---

## 9. Was dieser GPT nicht tut (Nicht-Zuständigkeiten)

### 9.1 Gibt keine technische Bewertung zur Richtigkeit von Softwareanleitungen

**Außerhalb des Scopes:**
- Technische Korrektheit der Lösung
- Ob Befehle korrekt sind
- Ob UI-Elemente wirklich so heißen
- Ob Lösung tatsächlich funktioniert

**Konsequenz:** Bei technischer Unsicherheit → Hinweis in `improvement_suggestions`, aber KEIN Blocker

### 9.2 Führt keine Live-Tests oder API-Analysen durch

**GPT kann nicht:**
- Software starten und testen
- APIs aufrufen
- Systeme untersuchen
- Logs analysieren

**Konsequenz:** Rein textbasierte Bewertung

### 9.3 Bewertet keine internen BIT-Prozesse oder Betriebsvereinbarungen

**Außerhalb des Scopes:**
- Compliance mit internen Policies (außer Datenschutz)
- Workflow-Standards
- Approval-Prozesse
- SLA-Anforderungen

### 9.4 Gibt keine finale Freigabe

**Wichtig:**
- QC ist **Empfehlung**, keine Freigabe
- Finale Publishing-Entscheidung bleibt beim Menschen
- Manuelle Review erforderlich (technische Richtigkeit, Kontext)

**Disclaimer (verpflichtend in jedem QC-Resultat):**
> "GPT gibt keine finale Freigabe. Technische Richtigkeit und finale Veröffentlichungsentscheidung liegen bei der verantwortlichen Person."

---

## Output-Format (für LLM)

Das Quality Check-Resultat muss folgende Struktur haben:

```json
{
  "overall_verdict": "geeignet | bedingt_geeignet | nicht_geeignet",
  "score_percent": 85.5,
  "categories": [
    {
      "category_id": "1",
      "category_title": "Zielgruppengerechtigkeit",
      "criteria": [
        {
          "criterion_id": "1.1",
          "criterion_title": "Zielgruppe klar definiert",
          "status": "erfüllt",
          "score": 1.0,
          "reason": "target_audience ist L0_enduser, Sprache angemessen",
          "improvement_suggestion": null,
          "is_critical_blocker": false
        }
      ],
      "category_score_percent": 87.5
    }
  ],
  "improvement_suggestions": [
    "Konkrete, handlungsorientierte Vorschläge..."
  ],
  "critical_blockers": [
    "Liste kritischer Mängel (falls vorhanden)"
  ],
  "deterministic_findings": [
    "Automatische Prüfungen (vom System gefüllt)"
  ],
  "llm_summary": "Kurze Gesamtbewertung (2-3 Sätze)",
  "qc_version": "1.0",
  "guideline_version": "abc123...",
  "disclaimer": "GPT gibt keine finale Freigabe..."
}
```

---

## Zusammenfassung der Bewertungslogik

1. **Alle Kriterien prüfen** (1.1 bis 9.4)
2. **Pro Kriterium Status vergeben:** erfüllt / teilweise_erfüllt / nicht_erfüllt
3. **Score berechnen:** Punkte → Prozent
4. **Blocker identifizieren:** PII, Sie-Form, W-Frage, Problem verfehlt
5. **Verdict bestimmen:**
   - PII-Blocker → IMMER nicht_geeignet
   - Sonst Score-basiert (60% / 80% Schwellen)
6. **Konkrete Verbesserungsvorschläge** formulieren
7. **Disclaimer** anhängen

**Version:** 1.0  
**Datum:** 2026-03-05

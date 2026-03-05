---
title: Quality Checks & Validation
version: 1.0.0
enabled: true
priority: 30
---

# Qualitätsprüfung und Validierung

Diese Guideline definiert die **strukturellen/deterministischen Qualitätskriterien** für KBA-Drafts vor der Veröffentlichung.

**Hinweis: Trennung strukturell/inhaltlich**
- Diese Datei = **Strukturelle/deterministische** Checks (schnell prüfbar, automatisierbar)
- `35_kba_quality_check.md` = **Inhaltliche** QC-Kriterien (LLM-basiert)

## Kritisch: Blockt Publishing (Status ≠ reviewed)

Diese Fehler führen dazu, dass der KBA **nicht** veröffentlicht werden darf:

### 1. ❌ Fehlende Pflichtfelder
- `title` ist leer oder fehlt
- `symptoms` ist leer oder fehlt
- `resolution_steps` ist leer oder fehlt
- `tags` ist leer oder fehlt

**Fix:** Felder aus Ticket-Daten ergänzen. Bei fehlenden Daten → `confidence_notes` hinzufügen.

---

### 2. ❌ Spekulative Lösungen ohne Validierung
- Resolution-Steps enthalten "vielleicht", "vermutlich", "könnte helfen"
- Keine Verifikation im Ticket dokumentiert

**Fix:** 
- Nur **verifizierte** Lösungen aus Ticket übernehmen
- Falls nicht verifiziert → `confidence_notes` ergänzen: "Lösung wurde im Ticket nicht final validiert"

**Beispiel:**
```json
❌ "resolution_steps": ["Vermutlich hilft ein Neustart"]
✅ "resolution_steps": ["PC neu starten (Lösung wurde im Ticket #12345 bestätigt)"]
   + "confidence_notes": "Lösung basiert auf ähnlichem Ticket #12345, nicht final verifiziert"
```

---

### 3. ❌ Halluzinierte Informationen
- Befehle, Pfade, URLs erfunden (nicht im Ticket dokumentiert)
- Root Cause erfunden (nicht im Ticket diagnostiziert)
- Produkt-Versionen / Error-Codes erraten

**Fix:**
- **Nur** aus Ticket übernehmen
- Bei fehlenden Infos → Platzhalter oder `confidence_notes`

**Beispiel:**
```json
❌ "resolution_steps": ["Patch KB5002345 installieren"]  // nicht im Ticket erwähnt
✅ "resolution_steps": ["Windows-Update installieren"]
   + "confidence_notes": "Exakte KB-Nummer wurde im Ticket nicht dokumentiert"
```

---

### 4. ❌ Zu unspezifische Titel
- Titel ohne Keywords: "Problem beheben", "Fehler lösen"
- Keine Kontextinformationen (OS, Produkt, Fehlermeldung)

**Fix:**
- Title muss enthalten: Problem + Kontext + (optional) Fehlermeldung
- Max. 150 Zeichen

**Beispiel:**
```json
❌ "title": "VPN funktioniert nicht"
✅ "title": "VPN-Verbindung schlägt fehl mit Timeout-Fehler (Windows 11)"
```

---

### 5. ❌ Nicht umsetzbare Lösungsschritte
- Schritte zu abstrakt: "Netzwerk reparieren", "Problem beheben"
- Keine konkreten Anweisungen

**Fix:**
- Jeder Schritt muss **konkret umsetzbar** sein
- Bei komplexen Schritten: Substeps verwenden

**Beispiel:**
```json
❌ "resolution_steps": ["Netzwerk reparieren"]
✅ "resolution_steps": [
      "Netzwerkadapter zurücksetzen: CMD als Admin öffnen",
      "Befehl ausführen: ipconfig /release && ipconfig /renew",
      "PC neu starten"
    ]
```

---

---

### 6. ❌ PII im Content (höchste Priorität - Datenschutz)

**Personenbezogene Daten im Artikeltext:**
- E-Mail-Adressen (muster@domain.ch)
- Telefonnummern (+41 xx xxx xx xx)
- AHV-/Kundennummern
- Vollständige Namen von Personen
- Interne User-IDs

**Blocker-Regel:** PII-Verstoß → **IMMER "nicht_geeignet"**

Selbst bei 95% Score → Datenschutz geht vor allem!

**Fix:**
- PII vollständig entfernen oder anonymisieren
- Bei Beispielen: Platzhalter verwenden ("max.muster@beispiel.ch")

**Beispiel:**
```json
❌ "resolution_steps": ["E-Mail an support@firma.ch mit Betreff 'Problem von Hans Meier (hmeier@firma.ch)' senden"]
✅ "resolution_steps": ["E-Mail an Support-Team mit Problembeschreibung senden"]
```

---

### 7. ❌ Missing initial_question
W-Frage fehlt oder ist keine W-Frage (Warum, Wie, Was, Wann, Wo, Wer, Welche).

**Fix:** Ergänzen Sie `initial_question` mit realistischer W-Frage.

---

### 8. ❌ Missing target_audience
Zielgruppe nicht definiert (L0_enduser oder L1_support).

**Fix:** Setzen Sie `target_audience` entsprechend der Zielgruppe.

---

## Warnungen: Blockiert nicht, aber manuell prüfen

Diese Probleme sollten vor Publishing manuell geprüft werden:

### ⚠️ Steps ohne Verb am Anfang
Arbeitsschritte beginnen nicht mit Verb im Imperativ (heuristisch prüfbar).

**Fix:** Formulieren Sie Schritte im Imperativ: "Öffnen Sie...", "Klicken Sie..."

### ⚠️ GROSSSCHRIFT oder Ausrufezeichen
GROSSCHRIFT zur Betonung oder Ausrufezeichen in Anleitungsschritten.

**Fix:** 
- GROSSSCHRIFT → **Fettschrift**
- Ausrufezeichen entfernen, sachlich bleiben

### ⚠️ Sie-Form-Verletzung
Verwendung von "du", "ihr", "man" statt "Sie" (heuristisch erkannt).

**Fix:** Ersetzen Sie durchgehend durch "Sie".

### 6. ⚠️ Fehlende Root Cause
- `cause` ist leer oder `null`
- Symptom beschreibt Problem, aber Ursache unklar

**Action:**
- In `confidence_notes` dokumentieren: "Ursache wurde im Ticket nicht diagnostiziert"
- Status bleibt `draft` bis manuelle Review

---

### 7. ⚠️ Keine Validierungsschritte
- `validation_checks` ist leer
- Keine Anleitung, wie Lösung verifiziert wird

**Action:**
- Falls möglich, aus Ticket ableiten
- Ansonsten: Manuelle Ergänzung durch Support-Team

---

### 8. ⚠️ Widersprüchliche Ticket-Daten
- Ticket enthält mehrere unterschiedliche Lösungsversuche
- Unklar, welche Lösung final war

**Action:**
- In `confidence_notes` dokumentieren: "Mehrere Lösungsversuche im Ticket, finale Lösung unklar"
- Manuelle Review erforderlich

---

### 9. ⚠️ Zu viele resolution_steps (>10)
- Mehr als 10 Lösungsschritte
- KBA wird unübersichtlich

**Action:**
- KBA aufteilen in mehrere Articles
- Oder: Schritte gruppieren / zusammenfassen

---

## Automatische Validierungen (JSON Schema)

Diese Checks werden automatisch durch das JSON Schema geprüft:

- `title`: String, min. 1 Zeichen, max. 150 Zeichen
- `symptoms`: Array, min. 1 Item, max. 10 Items
- `resolution_steps`: Array, min. 1 Item, max. 15 Items
- `tags`: Array, min. 1 Item, max. 10 Items, Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- `cause`: String (optional)
- `validation_checks`: Array (optional), max. 10 Items
- `warnings`: Array (optional), max. 10 Items
- `confidence_notes`: String (optional), max. 1000 Zeichen

---

## Qualitäts-Checkliste (vor Publishing)

### Pflicht (Blockiert Publishing)
- [ ] Alle Pflichtfelder ausgefüllt (title, symptoms, resolution_steps, tags)
- [ ] Keine spekulativen Formulierungen ("vielleicht", "könnte")
- [ ] Alle Informationen aus Ticket ableitbar (keine Halluzinationen)
- [ ] Titel ist spezifisch und enthält Keywords
- [ ] Lösungsschritte sind konkret umsetzbar

### Empfohlen (Manuelle Review)
- [ ] Root Cause ist dokumentiert (falls vorhanden in Ticket)
- [ ] Validierungsschritte sind definiert
- [ ] Bei Unsicherheiten: `confidence_notes` ausgefüllt
- [ ] Bei Warnungen: `warnings`-Feld ausgefüllt
- [ ] Max. 10 resolution_steps (sonst aufteilen)

---

## Beispiel: Qualitätsprüfung bestanden ✅

```json
{
  "title": "Outlook startet nicht nach Office 365 Update KB5002345",
  "symptoms": [
    "Outlook zeigt Fehlermeldung 'Outlook.exe - Anwendungsfehler'",
    "Problem tritt nur nach Windows Update KB5002345 auf",
    "Betrifft nur Windows 10 Clients"
  ],
  "cause": "Inkompatibilität zwischen Office 365 Build 16.0.14326 und Windows Update KB5002345",
  "resolution_steps": [
    "Office 365 Update installieren: Microsoft AutoUpdate öffnen → 'Nach Updates suchen'",
    "Warten bis Build 16.0.14827 oder höher installiert ist",
    "Outlook neu starten",
    "Falls Problem weiterhin: Office Reparatur ausführen (Systemsteuerung → Programme → Office 365 → Ändern → Online-Reparatur)"
  ],
  "validation_checks": [
    "Outlook startet ohne Fehlermeldung",
    "E-Mails können empfangen und gesendet werden"
  ],
  "tags": ["outlook", "office-365", "windows-10", "kb5002345", "update"],
  "confidence_notes": null
}
```

**Status:** ✅ Ready for review → Kann nach manueller Prüfung veröffentlicht werden.

---

## Beispiel: Qualitätsprüfung fehlgeschlagen ❌

```json
{
  "title": "VPN Problem",  // ❌ Zu unspezifisch
  "symptoms": ["VPN geht nicht"],  // ❌ Keine Details
  "cause": "Vermutlich Netzwerkproblem",  // ❌ Spekulation
  "resolution_steps": [
    "VPN reparieren",  // ❌ Nicht umsetzbar
    "Falls das nicht hilft, vielleicht Neustart versuchen"  // ❌ Spekulation
  ],
  "tags": ["vpn"]
}
```

**Status:** ❌ Draft rejected → Manuelle Nachbesserung erforderlich.

---

**Ziel:** Nur **qualitativ hochwertige, verifizierte KBAs** veröffentlichen, um Falschinformationen zu vermeiden.

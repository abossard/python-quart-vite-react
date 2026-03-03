---
title: KBA Structure & Format
version: 1.0.0
enabled: true
priority: 10
---

# KBA-Struktur und Format

Diese Guideline definiert die **pflichtmäßige Struktur** eines Knowledge Base Articles.

## Pflichtfelder (Required)

### 1. `title` (string, 1-150 Zeichen)
**Purpose:** SEO-optimierter Titel für Suche und Navigation

**Format:**
```
[Problem] [Kontext] [optional: Fehlermeldung/Error-Code]
```

**Beispiele:**
- ✅ "VPN-Verbindung schlägt fehl mit Timeout-Fehler (Windows 11)"
- ✅ "Outlook startet nicht nach Office 365 Update KB5002345"
- ✅ "Drucker HP LaserJet druckt nur weiße Seiten"
- ❌ "VPN Problem" (zu unspezifisch)
- ❌ "How to fix VPN connection when users report timeout errors and cannot connect to corporate network" (zu lang)

**Regeln:**
- Max. 150 Zeichen
- Enthält Hauptschlagwörter (VPN, Drucker-Modell, Fehlermeldung)
- Keine Fragen ("Wie…?"), nur Aussagen
- Deutsch (Schweizer Hochdeutsch bevorzugt)

---

### 2. `symptoms` (array of strings, 1-10 items)
**Purpose:** Symptome und Fehlermeldungen, wie der Benutzer sie erlebt

**Format:**
- Jedes Item = ein Symptom oder eine Fehlermeldung
- Wörtliche Zitate aus Tickets in Anführungszeichen
- Aus Endbenutzer-Sicht beschrieben

**Beispiele:**
```json
"symptoms": [
  "VPN-Client zeigt Fehlermeldung 'Connection timeout after 30 seconds'",
  "Verbindung bricht nach ca. 2 Minuten ab",
  "Problem tritt nur bei Windows 11 Clients auf"
]
```

**Regeln:**
- Min. 1 Symptom erforderlich
- Bei Fehlermeldungen: wörtlich zitieren (aus Ticket kopieren)
- Keine Lösungen hier dokumentieren (nur Problem-Beschreibung)

---

### 3. `resolution_steps` (array of strings, 1-15 items)
**Purpose:** Schritt-für-Schritt-Anleitung zur Lösung

**Format:**
- Jeder Step = **eine konkrete, umsetzbare Aktion**
- Reihenfolge: Einfachste Lösung zuerst → Komplexere Schritte → Eskalation
- Kommandos / Pfade exakt angeben

**Beispiel:**
```json
"resolution_steps": [
  "VPN-Client neu starten: Rechtsklick auf System-Tray Icon → 'Beenden' → Neu öffnen",
  "Netzwerkadapter zurücksetzen: CMD als Admin öffnen, ausführen: 'ipconfig /release && ipconfig /renew'",
  "VPN-Profil neu importieren: Datei '\\\\fileserver\\vpn\\profiles\\company-vpn.ovpn' öffnen",
  "Windows-Firewall prüfen: Einstellung → Windows-Firewall → VPN-Client erlauben",
  "Falls Problem weiterhin besteht: Ticket an Network Team eskalieren mit Referenz zu diesem KBA"
]
```

**Regeln:**
- Min. 1 Schritt erforderlich
- Max. 15 Schritte (bei mehr: KBA aufteilen)
- Eskalationspfad am Ende
- Keine Annahmen ("vermutlich", "vielleicht") → nur validierte Schritte
- Spezifische Befehle/Pfade/URLs verwenden

---

### 4. `tags` (array of strings, 1-10 items)
**Purpose:** Suchschlagwörter für Kategorisierung und Volltextsuche

**Format:**
- Lowercase
- Keine Sonderzeichen (nur Buchstaben, Zahlen, Bindestrich)
- Single words oder hyphenated-words

**Beispiele:**
```json
"tags": ["vpn", "windows-11", "timeout", "network", "remote-access"]
```

**Regeln:**
- Min. 1 Tag erforderlich
- Max. 10 Tags
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$` (Regex)
- Häufig verwendete Tags bevorzugen (konsistente Taxonomie)

---

## Optionale Felder

### 5. `cause` (string, optional)
**Purpose:** Root Cause / technische Ursache des Problems

**Wann ausfüllen:**
- Ursache ist im Ticket dokumentiert
- Ursache wurde vom Support verifiziert

**Wann NICHT ausfüllen:**
- Ursache ist unklar → Feld weglassen oder `null`
- Bei Spekulation → in `confidence_notes` dokumentieren

**Beispiel:**
```json
"cause": "Inkompatibilität zwischen VPN-Client Version 4.2 und Windows 11 Build 22H2. Client sendet falsches Cipher-Suite."
```

---

### 6. `validation_checks` (array of strings, optional)
**Purpose:** Verifikationsschritte nach der Lösung

**Beispiel:**
```json
"validation_checks": [
  "VPN-Verbindung erfolgreich: Status im Client ist 'Connected'",
  "Ping zu internem Server erfolgreich: 'ping 10.0.0.1' antwortet",
  "Benutzer kann auf Fileserver zugreifen: \\\\fileserver\\share öffnen"
]
```

---

### 7. `warnings` (array of strings, optional)
**Purpose:** Wichtige Hinweise, Risiken, bekannte Limitationen

**Beispiel:**
```json
"warnings": [
  "ACHTUNG: VPN-Client-Update erfordert Admin-Rechte",
  "Nach Update muss PC neu gestartet werden",
  "Bekanntes Problem: Update schlägt fehl, wenn Antivirus aktiv ist"
]
```

---

### 8. `confidence_notes` (string, optional)
**Purpose:** LLM-Hinweise zu Unsicherheiten oder fehlenden Daten

**Wann verwenden:**
- Ticket-Daten unvollständig
- Keine Resolution dokumentiert
- Widersprüchliche Informationen im Ticket

**Beispiel:**
```json
"confidence_notes": "Warnung: Im Ticket wurde keine finale Lösung dokumentiert. Resolution-Steps basieren auf ähnlichen Tickets (#12345, #12389). Manuelle Prüfung empfohlen."
```

---

## Struktur-Checkliste

Vor dem Senden eines KBA-Drafts prüfen:

- [ ] `title`: Prägnant, SEO-optimiert, 1-150 Zeichen?
- [ ] `symptoms`: Min. 1 Symptom, aus Benutzer-Sicht?
- [ ] `resolution_steps`: Min. 1 Schritt, konkret umsetzbar?
- [ ] `tags`: Min. 1 Tag, lowercase, keine Sonderzeichen?
- [ ] `cause`: Nur wenn im Ticket dokumentiert
- [ ] `validation_checks`: Falls vorhanden, konkrete Prüfschritte?
- [ ] `warnings`: Falls vorhanden, kritische Hinweise?
- [ ] `confidence_notes`: Bei Unsicherheiten dokumentiert?

---

**JSON Schema Validation:** Alle Outputs werden gegen das JSON Schema validiert. Bei Validation-Fehlern wird der Draft abgelehnt.

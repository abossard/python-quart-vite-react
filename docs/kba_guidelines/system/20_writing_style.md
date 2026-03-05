---
title: Writing Style & Language
version: 1.0.0
enabled: true
priority: 20
---

# Schreibstil und Sprache

Diese Guideline definiert den **sprachlichen Stil** für alle KBA-Texte.

## Grundprinzipien

### 1. Zielgruppe: First-Level-Support
- **Wenig technisches Hintergrundwissen**
- Benötigen klare, umsetzbare Anweisungen
- Keine Zeit für lange Theorie
- Lesen diagonal / Scannen nach Lösung

### 2. Sprache: Deutsch (Schweizer Hochdeutsch bevorzugt)
- Alle Texte auf Deutsch
- Englische Begriffe nur bei:
  - Fehlermeldungen (wörtlich zitieren)
  - Produkt-/Markennamen (z.B. "Windows", "VPN-Client")
  - Technische Begriffe ohne gute Übersetzung (z.B. "Timeout", "Patch")

### 3. Ton: Neutral, sachlich, präzise
- **NICHT:** Marketing-Sprache ("großartig", "einfach", "perfekt")
- **NICHT:** Emotional ("leider", "hoffentlich")
- **JA:** Direkt, klar, ohne Umschweife

---

## Konkrete Formulierungsregeln

### ✅ DO: Imperativ verwenden (Befehle)

**Gut:**
- "VPN-Client neu starten"
- "Eingabeaufforderung als Administrator öffnen"
- "Folgende Schritte ausführen"

**Schlecht:**
- "Man sollte den VPN-Client neu starten" (umständlich)
- "Bitte öffnen Sie die Eingabeaufforderung" (zu förmlich)

---

### ✅ DO: Aktiv statt Passiv

**Gut:**
- "Öffnen Sie die Systemsteuerung"
- "Laden Sie die Datei herunter"

**Schlecht:**
- "Die Systemsteuerung wird geöffnet"
- "Die Datei sollte heruntergeladen werden"

---

### ✅ DO: Konkrete Angaben

**Gut:**
- "Warten Sie 30 Sekunden"
- "Führen Sie den Befehl 'ipconfig /release' aus"
- "Öffnen Sie die Datei unter \\\\fileserver\\vpn\\config.ovpn"

**Schlecht:**
- "Warten Sie einen Moment" (unklar)
- "Führen Sie einen Netzwerk-Reset aus" (zu abstrakt)
- "Öffnen Sie die Konfigurationsdatei" (welche?)

---

### ✅ DO: Kurze Sätze

**Gut:**
- "VPN-Client neu starten. Dann Verbindung erneut versuchen."

**Schlecht:**
- "Nachdem Sie den VPN-Client neu gestartet haben, sollten Sie versuchen, die Verbindung erneut herzustellen, wobei Sie darauf achten müssen, dass…" (zu lang)

---

### ❌ DON'T: Überflüssige Adjektive

**Gut:**
- "VPN-Client starten"
- "Firewall-Einstellungen prüfen"

**Schlecht:**
- "Den praktischen VPN-Client starten"
- "Die wichtigen Firewall-Einstellungen sorgfältig prüfen"

---

### ❌ DON'T: Unsicherheit ausdrücken

**Gut:**
- "Ursache unbekannt" (ehrlich)

---

## Sprach- und Stilregeln (QC-prüfbar)

### Sie-Form (verpflichtend)
- **Immer "Sie"**, nie "du", "ihr", "man"
- Direkte Anrede: "Öffnen **Sie**...", nicht "Man öffnet..."
- Ausnahme: Zitate oder UI-Elemente ("Klicken Sie auf 'Anmelden'")

**Beispiele:**
- ✅ "Öffnen Sie die Systemsteuerung"
- ✅ "Klicken Sie auf den Button"
- ❌ "Öffne die Systemsteuerung" (du-Form)
- ❌ "Man öffnet die Systemsteuerung" (unpersönlich)

### Satzstruktur
- **Kurze, klare Sätze** (Richtwert: max. 20 Wörter)
- Keine Schachtelsätze mit mehreren Nebensätzen
- Ein Gedanke pro Satz

### Arbeitsschritte
**Beginnen mit Verb im Imperativ:**
- ✅ "Öffnen Sie..."
- ✅ "Klicken Sie..."
- ✅ "Geben Sie ein..."
- ❌ "Sie müssen öffnen..." (umständlich)
- ❌ "Nun wird geklickt..." (passiv)

### Formatierung (Verbote)
- **Keine GROSSSCHRIFT** zur Betonung (stattdessen **Fettschrift**)
- **Keine Ausrufezeichen** in Anleitungsschritten (sachlich bleiben)
- **Keine unnötigen Klammern** (Infos in Fließtext integrieren oder weglassen)

### Fachjargon
- Minimieren, nur wenn nötig
- Bei Verwendung **direkt erklären:** "DNS-Cache (Zwischenspeicher für Webadressen)"
- Keine Abkürzungen ohne erste Auflösung
- "Falls Problem weiterhin besteht: Ticket eskalieren" (klar)

**Schlecht:**
- "Vielleicht hilft es, wenn…" (unsicher)
- "Möglicherweise könnte das Problem mit…" (spekulativ)
- "Es scheint, als ob…" (unklar)

---

### ❌ DON'T: Fachjargon ohne Erklärung

**Gut:**
- "VPN-Verbindung (Virtual Private Network)"
- "DNS-Server (übersetzt Domain-Namen in IP-Adressen)"

**Schlecht:**
- "RADIUS-Authentifizierung konfigurieren" (ohne Kontext)
- "MTU-Fragmentation anpassen" (zu technisch)

**Ausnahme:** Wenn Ticket bereits technische Begriffe verwendet, dürfen diese übernommen werden.

---

## Formatierung

### Befehle / Code

Befehle in separater Zeile mit Kontext:

```
Netzwerkadapter zurücksetzen:
- CMD als Administrator öffnen
- Befehl ausführen: ipconfig /release && ipconfig /renew
```

### Pfade / URLs

Exakte Pfade angeben:

```
✅ Datei öffnen: \\fileserver\vpn\profiles\corporate-vpn.ovpn
✅ Download von: https://intranet.example.com/downloads/vpn-client-4.5.exe
❌ Datei vom Fileserver öffnen (zu unspezifisch)
```

### Fehlermeldungen

Wörtlich zitieren (exakt aus Ticket kopieren):

```
✅ "Connection timeout after 30 seconds"
✅ "Fehler 0x80070005: Zugriff verweigert"
❌ Die Verbindung ist fehlgeschlagen (paraphrasiert)
```

---

## Struktur für Lösungsschritte

### Standard-Format:

```
1. [Aktion]: [Detaillierte Anweisung]
2. [Überprüfung]: [Validierung des Ergebnisses]
3. [Alternative]: Falls Schritt 1 fehlschlägt: [Nächste Option]
4. [Eskalation]: Falls Problem weiterhin besteht: [An wen eskalieren]
```

**Beispiel:**
```
1. VPN-Client neu starten: Rechtsklick auf System-Tray Icon → 'Beenden' → Neu öffnen
2. Verbindung testen: VPN einwählen und Status prüfen (sollte 'Connected' zeigen)
3. Falls Fehler weiterhin: VPN-Profil neu importieren (siehe Schritt 3)
4. Falls Problem weiterhin besteht: Ticket an Network Team eskalieren
```

---

## Checkliste Schreibstil

Vor dem Senden eines KBA-Drafts prüfen:

- [ ] Deutsche Sprache verwendet (außer bei englischen Fehlermeldungen)?
- [ ] Neutrale, sachliche Formulierung?
- [ ] Imperativ (Befehle) statt Passiv?
- [ ] Kurze Sätze (max. 2 Nebensätze)?
- [ ] Konkrete Angaben (Pfade, Befehle, Zeitangaben)?
- [ ] Keine Spekulation ("vielleicht", "möglicherweise")?
- [ ] Keine überflüssigen Adjektive?
- [ ] Fachjargon erklärt oder vermieden?

---

**Ziel:** Ein Support-Mitarbeiter soll den KBA lesen und **sofort** umsetzen können, ohne Rückfragen.

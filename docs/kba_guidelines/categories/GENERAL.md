# Allgemeine KBA-Guidelines

Diese Guidelines gelten für **alle** Knowledge Base Articles und werden immer inkludiert.

## Struktur eines Knowledge Base Articles

Ein guter KBA besteht aus folgenden Komponenten:

### 1. Titel
- **Prägnant und suchmaschinenoptimiert (SEO)**
- Enthält Hauptschlagwörter des Problems
- Max. 150 Zeichen
- Formulierung: Problem + Kontext
- **Beispiele:**
  - ✅ "VPN-Verbindungsprobleme unter Windows 11 beheben"
  - ✅ "Outlook-Absturz beim Öffnen von Anhängen (PDF)"
  - ❌ "VPN funktioniert nicht" (zu unspezifisch)
  - ❌ "Wie man den VPN-Client neu installiert unter Windows 11 mit aktuellen Patches" (zu lang)

### 2. Problembeschreibung
- Beschreibt das Problem aus **Sicht des Endbenutzers**
- Symptome klar benennen
- Häufige Fehlermeldungen wörtlich zitieren
- 2-4 Sätze
- **Beispiel:**
  ```
  Benutzer können sich nicht mit dem Unternehmens-VPN verbinden. 
  Der VPN-Client zeigt die Fehlermeldung "Verbindung fehlgeschlagen: Timeout". 
  Das Problem tritt hauptsächlich bei Nutzern mit Windows 11 auf.
  ```

### 3. Lösungsschritte
- **Nummerierte Schritt-für-Schritt-Anleitung**
- Jeder Schritt beschreibt **eine konkrete Aktion**
- Beginne mit einfachsten Lösungen (First-Level-Support)
- Eskalationspfad am Ende
- Screenshots erwähnen falls hilfreich (z.B. "Siehe Screenshot 1")
- **Beispiel:**
  ```
  1. VPN-Client neu starten (Rechtsklick auf Icon → "Beenden" → Neu öffnen)
  2. Netzwerkadapter zurücksetzen: Eingabeaufforderung als Admin öffnen, ausführen: 
     ipconfig /release && ipconfig /renew
  3. VPN-Profil neu importieren aus \\fileserver\vpn\profiles\company-vpn.ovpn
  4. Falls Problem weiterhin besteht: Ticket eskalieren an Network Team
  ```

### 4. Zusätzliche Hinweise
- **Präventionstipps** (Wie kann man das Problem vermeiden?)
- **Bekannte Limitationen** (Welche Fälle löst dieser KBA NICHT?)
- **Wann eskalieren?** (Ab wann ist Second-Level-Support nötig?)
- **Beispiel:**
  ```
  Präventiv sollten Benutzer den VPN-Client auf der neuesten Version halten.
  Bekannte Limitation: Dieser KBA gilt nicht für macOS-Clients.
  Eskalation: Bei mehr als 3 Fehlversuchen oder Fehlermeldung "Certificate invalid".
  ```

### 5. Tags
- **3-5 relevante Tags** für Suchbarkeit
- Kategorien: Komponente, Betriebssystem, Problem-Typ
- Lowercase, durch Komma getrennt
- **Beispiele:**
  - `vpn, windows, network, connection-error`
  - `outlook, email, attachment, crash`
  - `password, active-directory, account-locked`

### 6. Verwandte Tickets
- Liste von ähnlichen tickets oder KBAs
- Format: Incident-ID oder KBA-ID
- Hilft bei Cross-Reference und Mustererkennung
- **Beispiel:**
  ```
  INC0001234, INC0002456, KB-VPN-001
  ```

## Schreibstil

### DO ✅
- Aktive Sprache: "Öffnen Sie..." statt "Es muss geöffnet werden..."
- Kurze Sätze (max. 20 Wörter)
- Fachbegriffe erklären bei erster Erwähnung
- Konsistente Terminologie (z.B. immer "VPN-Client", nicht mal "VPN-Software")
- Nutzerfreundliche Sprache, keine unnötige Techniker-Jargon

### DON'T ❌
- Keine Passiv-Konstruktionen
- Keine Annahmen über Vorwissen (außer Basic IT-Literacy)
- Keine veralteten Versionsangaben (besser: "aktuelle Version")
- Keine vagen Formulierungen ("möglicherweise", "eventuell")

## Qualitätskriterien

Ein guter KBA ist:
1. **Vollständig** - Alle Schritte sind dokumentiert
2. **Testbar** - Ein Dritter kann die Schritte nachvollziehen
3. **Aktuell** - Informationen sind nicht veraltet
4. **Suchbar** - Gute Tags und Titel
5. **Verständlich** - Auch für Nicht-Experten nachvollziehbar

## Beispiel eines vollständigen KBA

```
Titel: "Outlook-Absturz beim Öffnen von PDF-Anhängen unter Windows 11"

Problembeschreibung:
Outlook stürzt ab, sobald ein PDF-Anhang per Doppelklick geöffnet wird. 
Es erscheint die Fehlermeldung "Microsoft Outlook hat aufgehört zu funktionieren".
Das Problem tritt bei Benutzern mit Adobe Acrobat DC auf.

Lösungsschritte:
1. Outlook schließen
2. Adobe Acrobat DC öffnen → Bearbeiten → Voreinstellungen → Sicherheit (erweitert)
3. Deaktivieren: "Protected Mode beim Start aktivieren"
4. Adobe Acrobat DC neu starten
5. Outlook öffnen und PDF-Anhang testen
6. Falls Problem weiterhin besteht: Ticket eskalieren an Desktop Support Team

Zusätzliche Hinweise:
Protected Mode ist eine Sicherheitsfunktion von Adobe. 
Deaktivierung erhöht theoretisch Risiko, ist aber für unternehmenskontrollierte PDFs akzeptabel.
Eskalation bei: Crash tritt auch nach Deaktivierung auf, oder bei anderen Dateitypen (nicht nur PDF).

Tags: outlook, pdf, adobe-acrobat, crash, windows

Verwandte Tickets: INC0003456, INC0004567
```

## Spezielle Felder

- **additional_notes**: Optional, für Kontext der nicht in andere Felder passt
- **related_tickets**: Incident-IDs aus dem Ticket-System (Format: INC + 9-12 Ziffern, z.B. INC000016346)
- **guidelines_used**: Wird automatisch befüllt (z.B. ["GENERAL", "VPN"])

## LLM-Instruktionen

Wenn du als LLM diesen KBA erstellst:
1. Extrahiere Informationen aus **Resolution** und **Notes** des Tickets
2. Strukturiere sie gemäß obiger Vorgaben
3. Ergänze Best Practices aus den Guidelines
4. Nutze klare, nutzerfreundliche Sprache
5. Output als JSON gemäß Schema

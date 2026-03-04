# Fall 3: Zugriff / Berechtigung / Zertifikat-Problem

## Übersicht

| Feld | Wert |
|------|------|
| **Ticket-Typ** | Service Request / Failure — Zugriff & Berechtigungen |
| **Häufigkeit** | Mittel (~12 von 206 Tickets) |
| **Typische Priorität** | Medium |
| **Typische Zuweisung** | WOS - Workplace & Software |

---

## Repräsentativer Fall

### Ticket-Steckbrief

| Feld | Wert |
|------|------|
| **Incident ID** | INC000016337079 |
| **Zusammenfassung** | Zugriff auf GitHub gestört |
| **Priorität** | Medium |
| **Dringlichkeit** | 3-Medium |
| **Auswirkung** | 3-Moderate/Limited |
| **Status** | Pending |
| **Melder-Quelle** | Web |
| **Gemeldet am** | 14.11.2025, 14:09 |

### Betroffene/r Benutzer/in

| Feld | Wert |
|------|------|
| **Organisation** | WBF-SECO, Konjunktur |
| **Standort** | Bern |
| **Gerät** | HP EliteBook 840 G8 |
| **Service** | BS_GPL Git |

### Beschreibung (Original)

> Rückruf unter → +41 58 46 59538
>
> Grund der Ticketeröffnung → GitHub Probleme
>
> Thema → Software/Applikation - Sonstiges
>
> Beim `git pull` auf `https://github.com/dpkj/tstools.git` erhalte ich
> `schannel: SEC_E_UNTRUSTED_ROOT (0x80090325)`.
> Das scheint mit dem TLS-Proxy der Bundesverwaltung zusammenzuhängen.
> Können Sie bitte sicherstellen, dass das Root-Zertifikat des Proxys auf meinem
> Arbeitsplatz im Windows-Trusted Root Certification Authorities-Store installiert ist,
> so dass Git (schannel) Verbindungen zu GitHub aufbauen kann?

### Verlauf

| Zeitpunkt | Status | Bearbeiter |
|-----------|--------|------------|
| 14.11.2025 14:09 | New | U80839737 |
| 14.11.2025 14:09 | Assigned | U80839737 |
| 18.11.2025 08:56 | Pending | U80827226 (Boschung Sandro) |

- **Gruppen-Transfers:** 1
- **Gesamt-Transfers:** 2
- **SLA-Status:** ✅ Within the Service Target

---

## Diskussionsfragen

Gehen Sie den Fall durch und überlegen Sie sich Antworten zu folgenden Fragen:

### 1. Erstbewertung & Triage
- [ ] Der Melder hat als Operational Categorization **Service Request** angegeben. Handelt es sich um einen Service Request (Berechtigung einrichten) oder um eine **Failure** (etwas funktioniert nicht mehr, das vorher funktioniert hat)?
- [ ] Der Melder liefert eine sehr detaillierte technische Beschreibung inkl. Fehlermeldung und Lösungsvorschlag. Wie beeinflusst das Ihre Triage?
- [ ] Ist die Priorität **Medium** angemessen für einen Entwickler, der keinen Zugriff auf sein Code-Repository hat?

### 2. Analyse & Diagnose
- [ ] Der Fehler `SEC_E_UNTRUSTED_ROOT` deutet auf ein **Zertifikatsproblem** hin. Welche Ursachen kommen in Frage?
  - TLS-Inspection durch den Proxy der Bundesverwaltung
  - Fehlendes Root-Zertifikat im Windows Certificate Store
  - Git-Konfiguration (schannel vs. OpenSSL-Backend)
  - Netzwerkpolicy-Änderung
- [ ] Wie überprüfen Sie, ob andere Benutzer denselben Fehler haben?
- [ ] Welche Diagnose-Befehle/Tools würden Sie verwenden?
  - `git config --global http.sslBackend`
  - `certutil -store Root`
  - `openssl s_client -connect github.com:443`
  - Proxy-Logs

### 3. Bearbeitungsprozess
- [ ] Das Ticket wurde sofort zugewiesen (Assigned = Reported Date). Warum ist das positiv zu bewerten?
- [ ] Das SLA wird eingehalten. Welche Massnahmen tragen dazu bei?
- [ ] Das Ticket steht auf **Pending**. Was ist der wahrscheinlichste Grund?
  - Abklärung mit dem Netzwerk-/Proxy-Team?
  - Rückmeldung vom Benutzer nach einem Lösungsversuch?
  - Genehmigung für Zertifikatsinstallation?

### 4. Sicherheitsaspekte
- [ ] ⚠️ Zertifikatsinstallationen im Trust Store haben **Sicherheitsauswirkungen**. Welche Prüfungen sind vor der Installation notwendig?
- [ ] Muss diese Änderung durch das Security-Team genehmigt werden?
- [ ] Ist die Änderung nur für diesen einen Client oder muss sie flächendeckend ausgerollt werden?
- [ ] Was wäre das Risiko, wenn der Benutzer als Workaround die SSL-Verifizierung deaktiviert (`git config --global http.sslVerify false`)?

### 5. Lösung & Abschluss
- [ ] Welche Lösungswege gibt es?
  - Root-Zertifikat des Proxys per GPO verteilen
  - Git auf OpenSSL-Backend umstellen (`git config --global http.sslBackend openssl`)
  - Proxy-Ausnahme für `github.com` beantragen
- [ ] Wenn das Problem infrastrukturbedingt ist (TLS-Proxy), sollte dann ein **Problem-Ticket** eröffnet werden?
- [ ] Wie stellen Sie sicher, dass die Lösung auch für andere betroffene Benutzer greift?

---

## Ähnliche Tickets im Datenbestand

| Incident ID | Zusammenfassung |
|-------------|-----------------|
| INC000016322354 | Account gesperrt: wird nach 20 Sek. gesperrt |
| INC000016285115 | Account gesperrt |
| INC000016341050 | Smartcard Login: PIN-Abfrage erscheint nicht |
| INC000016333910 | G11: Windows Login Probleme / hängt sich vermehrt auf |
| INC000016342088 | RDP-Verbindung wird sofort nach Login geschlossen |
| INC000016343611 | DRINGEND: Kamera und Desktop Zugriff TÜV Süd |
| INC000016346926 | Zugriff auf M... |
| INC000016349483 | Windows-Login hängt und erfordert Neustart |
| INC000016151058 | DataShure - Zugriff nicht mehr möglich |
| INC000016314431 | Signieren von PDF Dokumenten nicht möglich |
| INC000016303514 | Ungültige Signatur im Dokument |

---

## Lernziele

Nach Bearbeitung dieses Falls sollten Sie:

1. **Zugriffsprobleme** von **Berechtigungsproblemen** und **Infrastrukturproblemen** unterscheiden können
2. Die **Sicherheitsimplikationen** von Zertifikatsänderungen verstehen
3. Wissen, wann eine Lösung **lokal** (einzelner Client) und wann **zentral** (GPO, Proxy-Konfiguration) umgesetzt werden muss
4. Die **korrekte Kategorisierung** (Service Request vs. Failure) bei Zugriffsproblemen anwenden
5. **Technisch versierte Melderbeschreibungen** effizient nutzen und trotzdem unabhängig verifizieren

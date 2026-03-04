# Fall 1: Windows Update / Software-Installation schlägt fehl

## Übersicht

| Feld | Wert |
|------|------|
| **Ticket-Typ** | Failure — Software Update / Installation |
| **Häufigkeit** | Sehr hoch (~30 von 206 Tickets) |
| **Typische Priorität** | Medium / Standard |
| **Typische Zuweisung** | WOS - Workplace & Software |

---

## Repräsentativer Fall

### Ticket-Steckbrief

| Feld | Wert |
|------|------|
| **Incident ID** | INC000016323643 |
| **Zusammenfassung** | CM032993 Windows Update läuft nicht durch |
| **Priorität** | Medium |
| **Dringlichkeit** | 3-Medium |
| **Auswirkung** | 3-Moderate/Limited |
| **Status** | Pending |
| **Melder-Quelle** | Web |
| **Gemeldet am** | 04.11.2025, 14:31 |

### Betroffene/r Benutzer/in

| Feld | Wert |
|------|------|
| **Organisation** | EDI-BAG, Sektion Medizinische Leistungen |
| **Standort** | Bern |
| **Gerät** | HP EliteBook X360 830 G9 (CM032993) |
| **Service** | BS_Microsoft SCCM |

### Beschreibung (Original)

> Rückruf unter → +41 58 462 6987
>
> Grund der Ticketeröffnung → Störung
>
> Thema → Software/Applikation - Standard Software - Microsoft Windows
>
> Hallo Servicedesk, auf dem Notebook CM032993 von von Gunten Elisabeth schlägt das Windows Update fehl. Bitte prüfen.

### Verlauf

| Zeitpunkt | Status | Bearbeiter |
|-----------|--------|------------|
| 04.11.2025 14:31 | New | U80747730 |
| 05.11.2025 14:09 | Assigned | U80799778 |
| 05.11.2025 17:32 | In Progress | U80797658 (Klee Jose Juan) |
| 11.11.2025 13:14 | Pending | U80797658 |

- **Gruppen-Transfers:** 1
- **Gesamt-Transfers:** 3
- **SLA-Status:** ⚠️ Service Targets Breached

---

## Diskussionsfragen

Gehen Sie den Fall durch und überlegen Sie sich Antworten zu folgenden Fragen:

### 1. Erstbewertung & Triage
- [ ] Ist die Priorität **Medium** angemessen? Welche Faktoren sprechen dafür/dagegen?
- [ ] Wurde die richtige **Operational Categorization** (Failure) gewählt?
- [ ] Hätte das Ticket direkt einer spezifischeren Gruppe zugewiesen werden können?

### 2. Analyse & Diagnose
- [ ] Welche ersten Schritte würden Sie zur Diagnose unternehmen?
- [ ] Welche Informationen fehlen in der Ticket-Beschreibung, die Sie vom Melder anfordern würden?
- [ ] Welche typischen Ursachen gibt es für fehlgeschlagene Windows Updates auf verwalteten Clients?
  - SCCM-Kommunikation gestört?
  - Speicherplatz auf dem Client?
  - Pending Reboots?
  - Softwareverteilungskonflikte?

### 3. Bearbeitungsprozess
- [ ] Das Ticket ging vom Status **New** → **Assigned** erst nach ~24h. Ist das akzeptabel?
- [ ] Warum steht das Ticket auf **Pending**? Was könnte der Grund für die Wartestellung sein?
- [ ] Das SLA wurde verletzt. Welche Massnahmen hätten ergriffen werden können, um dies zu verhindern?

### 4. Kommunikation
- [ ] Wurde der/die Melder/in ausreichend informiert?
- [ ] Wann und wie würden Sie eine Statusmeldung an den/die Benutzer/in senden?

### 5. Lösung & Abschluss
- [ ] Welche typischen Lösungsansätze kennen Sie für dieses Problem?
- [ ] Wie dokumentieren Sie die Lösung im Ticket, damit ähnliche Fälle schneller gelöst werden?
- [ ] Gibt es ein zugrunde liegendes Problem, das als **Problem-Ticket** erfasst werden sollte?

---

## Ähnliche Tickets im Datenbestand

| Incident ID | Zusammenfassung |
|-------------|-----------------|
| INC000016300803 | Es werden keine Updates angezeigt |
| INC000016318424 | Update Windows nicht erfolgt |
| INC000016322181 | Windows Update |
| INC000016327819 | Microsoft SCCM: Win Update schlägt fehl |
| INC000016327913 | Fehler bei Software Update-Installation |
| INC000016328288 | Windows 11, version 24H2 x64 2025-10 Update |
| INC000016338364 | Windows 11 Update kann nicht installiert werden |
| INC000016344758 | Update W11 geht nicht |
| INC000016346074 | SBA-O: Update Fehler |
| INC000016325638 | Software wird nicht deinstalliert |

---

## Lernziele

Nach Bearbeitung dieses Falls sollten Sie:

1. Die **Standardvorgehensweise** bei fehlgeschlagenen Windows Updates auf SCCM-verwalteten Clients kennen
2. Die **richtigen Eskalationswege** identifizieren können
3. Die **SLA-relevanten Zeitfenster** für Medium-Priority-Tickets verstehen
4. Wissen, wann ein **Problem-Ticket** eröffnet werden sollte (Häufung ähnlicher Incidents)

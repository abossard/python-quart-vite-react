# Fall 2: Hardware-/Peripherie-Problem (Dockingstation, Drucker, Monitor)

## Übersicht

| Feld | Wert |
|------|------|
| **Ticket-Typ** | Failure — Hardware / Peripherie |
| **Häufigkeit** | Hoch (~15 von 206 Tickets) |
| **Typische Priorität** | Medium / Standard |
| **Typische Zuweisung** | WOS - Workplace & Software |

---

## Repräsentativer Fall

### Ticket-Steckbrief

| Feld | Wert |
|------|------|
| **Incident ID** | INC000016338459 |
| **Zusammenfassung** | Anschluss Problem an Dockingstation |
| **Priorität** | Medium |
| **Dringlichkeit** | 3-Medium |
| **Auswirkung** | 4-Minor/Localized |
| **Status** | Pending |
| **Melder-Quelle** | Phone |
| **Gemeldet am** | 17.11.2025, 11:48 |

### Betroffene/r Benutzer/in

| Feld | Wert |
|------|------|
| **Organisation** | EJPD-SEM, Finanzaufsicht |
| **Standort** | Bern |
| **Gerät** | HP ZBook Fury 15 G8 i7 (CP001864) |
| **Zweites Gerät** | CM072262 (funktioniert einwandfrei) |
| **Peripherie** | HP Thunderbolt G2 Dockingstation |
| **Service** | BS_Dockingstation |

### Beschreibung (Original)

> Anschluss Problem an Dockingstation
>
> User hat 2 Clients und eine HP Thunderbolt G2 Dockingstation.
> An dieser Dockingstation wird mit dem CP001864 keine Peripherie erkannt.
> Mit dem anderen Gerät des Users (CM072262) läuft alles problemlos.
> Die Dockingstation hat ein Kabel mit 2 Anschlüssen nebeneinander (1x rund und 1x USB-C).

### Verlauf

| Zeitpunkt | Status | Bearbeiter |
|-----------|--------|------------|
| 17.11.2025 11:48 | New | U80799778 |
| 18.11.2025 14:27 | Assigned | X60029849 |
| 20.11.2025 08:18 | Pending | U80826666 (Stempfel Michael) |

- **Gruppen-Transfers:** 1
- **Gesamt-Transfers:** 3
- **SLA-Status:** ⚠️ Service Target Warning

---

## Diskussionsfragen

Gehen Sie den Fall durch und überlegen Sie sich Antworten zu folgenden Fragen:

### 1. Erstbewertung & Triage
- [ ] Der Impact ist **4-Minor/Localized**, die Urgency **3-Medium**. Ist diese Kombination korrekt, wenn der Benutzer ein Zweitgerät hat, das funktioniert?
- [ ] Sollte die Priorität heruntergestuft werden, weil ein Workaround (Zweitgerät) vorhanden ist?
- [ ] Ist **Failure** die richtige Operational Categorization, oder handelt es sich um einen **Service Request** (z.B. Treiberinstallation)?

### 2. Analyse & Diagnose
- [ ] Die Beschreibung enthält einen wichtigen Hinweis: Mit dem zweiten Gerät funktioniert die Dockingstation. Was schliesst das aus, was nicht?
- [ ] Welche Diagnose-Schritte würden Sie durchführen?
  - Thunderbolt-Treiber auf CP001864 prüfen
  - Firmware der Dockingstation prüfen
  - USB-C-Port auf dem ZBook testen
  - BIOS-Einstellungen (Thunderbolt Security Level) prüfen
- [ ] Welche zusätzlichen Informationen würden Sie vom Melder anfordern?
  - Wurde die Dockingstation je mit dem CP001864 verwendet?
  - Wurde kürzlich ein Update durchgeführt?
  - Wird das richtige Kabel (USB-C, nicht rund) verwendet?

### 3. Bearbeitungsprozess
- [ ] Das Ticket wurde telefonisch gemeldet und die Erstreaktion war sofort (Responded Date = Reported Date). Wie ist das im Vergleich zu Fall 1 zu bewerten?
- [ ] Das Ticket steht auf **Pending**. Typische Gründe bei Hardware-Tickets:
  - Warten auf Rückmeldung des Benutzers
  - Warten auf Ersatzteil
  - Warten auf Vor-Ort-Termin
- [ ] Welcher Pending-Grund ist hier am wahrscheinlichsten?

### 4. Eskalation & Vor-Ort-Support
- [ ] Ab wann würden Sie einen Vor-Ort-Einsatz planen?
- [ ] Wann wird ein Hardware-Austausch (RMA) notwendig?
- [ ] Wie unterscheiden Sie zwischen Dockingstation-Defekt und Laptop-Port-Defekt?

### 5. Lösung & Abschluss
- [ ] Wie dokumentieren Sie das Ergebnis, damit bei künftigen Dockingstation-Problemen schneller reagiert werden kann?
- [ ] Sollte ein Knowledge-Base-Artikel für die Kombination «HP Thunderbolt G2 + ZBook Fury» erstellt werden?

---

## Ähnliche Tickets im Datenbestand

| Incident ID | Zusammenfassung |
|-------------|-----------------|
| INC000016301833 | Drucker Evolis Tattoo |
| INC000016322757 | Druckerproblem aus dem Edge |
| INC000016336638 | Etikettendrucker druckt nicht auf ZebraDesigner Pro |
| INC000016337469 | Gekaufter Drucker mit Service Abo nicht in Betrieb |
| INC000016340658 | Anzeige erscheint nicht auf zwei Bildschirmen nach Windows-Update |
| INC000016344511 | Computer: wenn man ihn von der Dockingstation wegnimmt, schläft er ein |
| INC000016344720 | Status Fehler, aber keine Fehlermeldung auf Drucker |
| INC000016345027 | G11: Laptop friert ein beim Umschalten von Dockingstation |
| INC000016346109 | Bildschirme schalten sich regelmässig kurz aus |
| INC000016233438 | Monitor zeigt immer wieder keine Anzeige trotz eingeschaltetem Zustand |
| INC000016233455 | Telefonat annehmen über Headset mit Teams nicht möglich |
| INC000016299360 | G11: Probleme mit Laptop im Ruhezustand und mit Dockingstation |

---

## Lernziele

Nach Bearbeitung dieses Falls sollten Sie:

1. Die **Unterscheidung zwischen Software- und Hardware-Ursache** bei Peripherie-Problemen beherrschen
2. Die **systematische Fehlereingrenzung** (gleiches Gerät, andere Dockingstation vs. anderes Gerät, gleiche Dockingstation) anwenden können
3. Wissen, wann ein **Vor-Ort-Einsatz** oder **Hardware-Austausch** der richtige nächste Schritt ist
4. **Pending-Gründe** korrekt setzen und den Melder über den Status informieren

# Password Reset & Account Locked Guidelines

Diese Guidelines gelten für Knowledge Base Articles im Bereich **Passwort-Reset und Account-Sperren**.

## Typische Probleme

### 1. Passwort vergessen
- Benutzer kann sich nicht mehr einloggen
- "Falsches Passwort" trotz korrekter Eingabe (Caps Lock?)
- Passwort abgelaufen

### 2. Account gesperrt
- Account nach zu vielen Fehlversuchen gesperrt
- Automatische Sperrung nach Inaktivität
- Administrativ gesperrter Account

### 3. Self-Service-Portal-Probleme
- Passwort-Reset-Link funktioniert nicht
- Sicherheitsfragen falsch beantwortet
- E-Mail mit Reset-Link kommt nicht an

## Password-Reset-Standard-Prozess

Jeder Password-Reset-KBA sollte diesen Ablauf dokumentieren:

```
1. Self-Service-Portal versuchen
   - https://selfservice.company.com aufrufen
   - "Passwort vergessen" anklicken
   - E-Mail-Adresse oder Username eingeben
   - Sicherheitsfragen beantworten
   - Neues Passwort setzen gemäß Formalia

2. Falls Self-Service nicht funktioniert: Servicedesk kontaktieren
   - Telefon: +41 XX XXX XX XX
   - E-Mail: servicedesk@company.com
   - Identifikation über: Name, Geburtsdatum, Personalnummer
   - Temporäres Passwort wird per SMS/E-Mail zugesendet

3. Erstes Login mit temporärem Passwort
   - Windows-Login mit temporärem Passwort
   - Sofortiger Zwang zur Passwortänderung
   - Neues Passwort gemäß Policy setzen

4. Alle Geräte neu authentifizieren
   - Smartphone (E-Mail, VPN-Apps)
   - Laptop/PC (zwischengespeicherte Credentials aktualisieren)
   - Browser (gespeicherte Passwörter aktualisieren)
```

## Account Unlock Standard

Für gesperrte Accounts:

```
1. Warten (automatische Entsperrung)
   - Standard-Sperrzeit: 30 Minuten
   - Keine Aktionen erforderlich
   - Nach Ablauf erneut einloggen

2. Sofortige Entsperrung durch Servicedesk
   - Servicedesk anrufen: +41 XX XXX XX XX
   - Identifikation durchführen
   - Account wird innerhalb 5 Minuten entsperrt
   - Bestätigungs-E-Mail wird gesendet

3. Login nach Entsperrung
   - Bisheriges Passwort verwenden (sofern nicht abgelaufen)
   - Falls Passwort abgelaufen: Siehe "Password-Reset-Standard-Prozess"
```

## Passwort-Policy (dokumentieren!)

Jeder Passwort-KBA sollte die aktuelle Policy erwähnen:

- **Mindestlänge:** 12 Zeichen
- **Komplexität:** Mindestens 3 von 4 (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen)
- **Ablauf:** 90 Tage
- **Historie:** Letzten 5 Passwörter nicht wiederverwendbar
- **Sperr-Schwellwert:** 5 Fehlversuche innerhalb 30 Minuten

## Titel für Password-KBAs

Pattern: **[Aktion/Problem] + [System/Kontext]**

Beispiele:
- ✅ "Windows-Passwort zurücksetzen (Self-Service-Portal)"
- ✅ "Account entsperren nach Fehlversuchen"
- ✅ "Abgelaufenes Passwort erneuern"
- ❌ "Passwort funktioniert nicht" (zu vage)

## Tags

**Pflicht-Tags:**
- `password`
- `account`
- `authentication`

**Zusätzliche Tags:**
- System: `windows`, `active-directory`, `microsoft-365`, `vpn`
- Problem: `locked`, `expired`, `forgotten`, `reset`
- Lösung: `self-service`, `servicedesk`, `admin`

**Beispiel:**
```
password, account, locked, active-directory, self-service
```

## Zusätzliche Hinweise

### Prävention
- Passwort-Manager verwenden (z.B. 1Password, KeePass)
- Passwort-Ablauf-Erinnerungen aktivieren (Windows-Notification 14 Tage vorher)
- Sicherheitsfragen im Self-Service-Portal aktuell halten

### Sicherheitsaspekte
- ❌ **NIE** Passwörter per E-Mail oder Chat verschicken
- ❌ Keine Passwörter über unsichere Kanäle (WhatsApp, SMS ohne Verschlüsselung)
- ✅ Nur über Self-Service-Portal oder direkter Servicedesk-Kontakt (Telefon mit Identifikation)

### Bekannte Limitationen
- Self-Service-Portal funktioniert nur bei aktiver E-Mail-Adresse im System
- Bei veralteten Sicherheitsfragen: Nur Servicedesk kann helfen
- Bei gesperrten E-Mail-Accounts (Microsoft 365): Separate Entsperrung nötig

### Wann eskalieren?
- Account nach Unlock immer noch gesperrt (nach 10 Minuten)
- Self-Service-Portal gibt Fehler "User not found"
- Temporäres Passwort funktioniert nicht
- Account administrativ gesperrt (Verdacht auf Kompromittierung)

## Beispiel eines Password-Reset-KBA

```
Titel: "Windows-Passwort zurücksetzen über Self-Service-Portal"

Problembeschreibung:
Benutzer hat sein Windows-Passwort vergessen und kann sich nicht mehr am Laptop anmelden.
Login-Bildschirm zeigt Fehlermeldung "Benutzername oder Kennwort ist falsch".

Lösungsschritte:
1. Self-Service-Portal aufrufen (von anderem Gerät, z.B. Smartphone):
   - https://selfservice.company.com
2. "Passwort vergessen" anklicken
3. Username oder E-Mail-Adresse eingeben
4. Sicherheitsfragen beantworten:
   - Frage 1: Name des ersten Haustiers
   - Frage 2: Geburtsort der Mutter
   - Frage 3: Erste Schule
5. Neues Passwort setzen gemäß Policy:
   - Mindestens 12 Zeichen
   - Mindestens je 1x: Großbuchstabe, Kleinbuchstabe, Zahl, Sonderzeichen
   - Nicht in letzten 5 Passwörtern verwendet
6. Passwort-Bestätigung erhalten (E-Mail)
7. Windows-Login mit neuem Passwort
8. Alle anderen Geräte aktualisieren:
   - Smartphone (E-Mail-App: Passwort neu eingeben)
   - VPN-Client (gespeichertes Passwort aktualisieren)
   - Browser (gespeicherte Anmeldedaten aktualisieren)

Zusätzliche Hinweise:
Prävention: Passwort-Manager wie 1Password oder KeePass verwenden, um sichere Passwörter zu generieren und zu speichern.
Self-Service-Portal funktioniert nur, wenn hinterlegte E-Mail-Adresse aktuell ist und Sicherheitsfragen korrekt beantwortet werden können.
Falls Self-Service nicht funktioniert: Servicedesk anrufen unter +41 XX XXX XX XX (Identifikation über Personalnummer und Geburtsdatum erforderlich).
Eskalation: Wenn Self-Service-Portal Fehler "User not found" anzeigt oder Passwort-Reset nach 30 Minuten noch nicht funktioniert.

Tags: password, reset, self-service, windows, active-directory, authentication

Verwandte Tickets: INC0004567, INC0005678
```

## Beispiel eines Account-Unlock-KBA

```
Titel: "Account entsperren nach mehrfachen Fehlversuchen"

Problembeschreibung:
Benutzer hat mehrfach falsches Passwort eingegeben und Account ist gesperrt.
Fehlermeldung: "Ihr Konto wurde gesperrt. Wenden Sie sich an Ihren Administrator."

Lösungsschritte:
1. Option A: 30 Minuten warten (automatische Entsperrung)
   - Keine Aktionen erforderlich
   - Nach 30 Minuten automatisch entsperrt
   - Dann erneut einloggen mit korrektem Passwort
   
2. Option B: Sofort entsperren lassen (bei Dringlichkeit)
   - Servicedesk anrufen: +41 XX XXX XX XX
   - Identifikation durchführen (Personalnummer, Geburtsdatum)
   - Account wird innerhalb 5 Minuten entsperrt
   - Bestätigungs-E-Mail abwarten
   - Mit bestehendem Passwort einloggen

3. Nach Entsperrung:
   - Falls Passwort vergessen: Siehe KBA "Windows-Passwort zurücksetzen"
   - Falls Passwort abgelaufen: Neues Passwort bei nächstem Login setzen

Zusätzliche Hinweise:
Prävention: Caps-Lock-Status vor Passworteingabe prüfen. Bei Unsicherheit Passwort in Textfeld sichtbar machen (Auge-Symbol anklicken).
Account wird nach 5 Fehlversuchen innerhalb 30 Minuten gesperrt (Sicherheitsfeature gegen Brute-Force-Angriffe).
Eskalation: Falls Account nach 30 Minuten immer noch gesperrt ist oder Self-Service/Servicedesk nicht helfen können.

Tags: account, locked, unlock, active-directory, authentication, servicedesk

Verwandte Tickets: INC0006789, INC0007890
```

# Network-spezifische KBA-Guidelines

Diese Guidelines gelten für Knowledge Base Articles im Bereich **Netzwerkprobleme** (exkl. VPN, siehe VPN.md).

## Typische Netzwerkprobleme

### 1. Keine Internetverbindung
- "Kein Internetzugriff" trotz WLAN/LAN-Verbindung
- DNS-Auflösungsfehler
- Gateway nicht erreichbar

### 2. Langsame Verbindung
- Webseiten laden langsam
- Hohe Latenz (Ping)
- Packet Loss

### 3. WLAN-Probleme
- WLAN wird nicht angezeigt
- Verbindung bricht ständig ab
- Schwaches Signal

### 4. LAN-Probleme
- Ethernet-Kabel nicht erkannt
- Netzwerkadapter deaktiviert
- IP-Adresszuweisung fehlgeschlagen (DHCP)

## Netzwerk-Diagnostik-Standard

Jeder Netzwerk-KBA sollte grundlegende Diagnostik-Schritte enthalten:

```
1. Verbindungsstatus prüfen
   - Windows: Netzwerkstatus-Icon im System Tray
   - Systemsteuerung → Netzwerk und Internet → Netzwerkstatus

2. IP-Konfiguration prüfen
   - Eingabeaufforderung öffnen
   - Befehl: ipconfig /all
   - Prüfen: IPv4-Adresse, Subnetzmaske, Standardgateway, DNS-Server

3. Gateway-Erreichbarkeit testen
   - Befehl: ping [Gateway-IP]
   - Beispiel: ping 192.168.1.1

4. DNS-Auflösung testen
   - Befehl: nslookup google.com
   - Bei Fehler: DNS-Server-Problem

5. Internetverbindung testen
   - Befehl: ping 8.8.8.8 (Google DNS)
   - Bei Erfolg: Internet erreichbar, DNS-Problem
   - Bei Fehler: Routing-Problem oder keine Internetverbindung
```

## Lösungsschritte-Standard für Netzwerkprobleme

Typischer Troubleshooting-Flow:

```
1. Netzwerkadapter neu starten
   - Windows: Systemsteuerung → Netzwerkverbindungen
   - Rechtsklick auf Adapter → "Deaktivieren" → Warten 10 Sek → "Aktivieren"

2. IP-Konfiguration erneuern
   - Eingabeaufforderung als Admin
   - Befehle:
     ipconfig /release
     ipconfig /renew
     ipconfig /flushdns

3. Netzwerk-Troubleshooter ausführen
   - Windows: Einstellungen → Netzwerk und Internet → Status
   - "Netzwerkproblembehandlung" anklicken

4. Router/Switch neu starten (falls möglich)
   - Router vom Strom trennen → 30 Sek warten → Wieder einstecken
   - Warten bis alle LEDs stabil leuchten (ca. 2-3 Min)

5. DNS-Server manuell setzen (bei DNS-Problemen)
   - Netzwerkadapter-Eigenschaften → IPv4 → Eigenschaften
   - DNS-Server: 8.8.8.8 (primär), 8.8.4.4 (sekundär)

6. Eskalation (falls Problem weiterhin besteht)
   - Ticket an Network Team mit ipconfig /all Output
```

## Titel für Netzwerk-KBAs

Pattern: **[Problem] + [Komponente/Kontext] + [OS]**

Beispiele:
- ✅ "Keine Internetverbindung trotz WLAN-Verbindung (Windows 11)"
- ✅ "WLAN bricht ständig ab - Signalstärke optimieren"
- ✅ "DNS-Fehler 'Server nicht gefunden' beheben"
- ✅ "Ethernet-Adapter nicht erkannt (Treiberproblem)"
- ❌ "Internet geht nicht" (zu unspezifisch)

## Tags

**Pflicht-Tags:**
- `network`

**Zusätzliche Tags je nach Kontext:**
- Verbindungstyp: `wifi`, `wlan`, `ethernet`, `lan`
- Problem: `no-internet`, `slow-connection`, `dns-error`, `dhcp-error`, `packet-loss`
- Betriebssystem: `windows`, `macos`, `linux`
- Komponente: `router`, `switch`, `gateway`, `dns`

**Beispiel:**
```
network, wifi, no-internet, dns-error, windows
```

## Zusätzliche Hinweise

### Prävention
- Router regelmäßig neu starten (1x pro Woche)
- WLAN-Kanal optimieren (App: WiFi Analyzer)
- Netzwerktreiber aktuell halten (Windows Update)
- Bei Homeoffice: Ethernet-Kabel statt WLAN verwenden (stabiler)

### Bekannte Limitationen
- Public WLAN mit Captive Portal: Browser öffnen und Login durchführen
- VPN kann Internetverbindung blockieren wenn fehlkonfiguriert: VPN trennen zum Testen
- Unternehmens-Firewall: Manche Ports/Protokolle blockiert (z.B. P2P, Gaming)

### Wann eskalieren?
- Ping zu Gateway erfolgreich, aber kein Internet → Eskalation an ISP (Internet Service Provider)
- ipconfig zeigt keine IP-Adresse (169.254.x.x = APIPA) → DHCP-Server-Problem → Network Team
- Problem betrifft mehrere Benutzer gleichzeitig → Möglicher Netzwerkausfall → Sofort eskalieren

## WLAN vs. LAN Troubleshooting

### WLAN-spezifisch
```
1. WLAN-Adapter aktiviert? (Flugmodus aus, WLAN-Schalter an)
2. Richtiges WLAN ausgewählt? (SSID prüfen)
3. Passwort korrekt? (Bei Fehlern: "Netzwerk vergessen" → Neu verbinden)
4. Signalstärke prüfen (mindestens 2 Balken)
5. Kanal-Überlastung? (WLAN-Analyzer nutzen)
6. WLAN-Treiber aktualisieren
```

### LAN-spezifisch
```
1. Kabel korrekt eingesteckt? (Klick-Geräusch beim Einstecken)
2. Kabel defekt? (Anderes Kabel testen)
3. Port defekt? (Anderen Port am Switch testen)
4. Netzwerkadapter in Device Manager aktiv? (Kein gelbes Ausrufezeichen)
5. Ethernet-Treiber aktualisieren
```

## Beispiel eines Netzwerk-KBA

```
Titel: "Keine Internetverbindung trotz WLAN-Verbindung (Windows 11)"

Problembeschreibung:
Laptop ist mit WLAN verbunden (zeigt "Verbunden"), aber es gibt keinen Internetzugriff.
Browser zeigt Fehler "Diese Website ist nicht erreichbar" oder "DNS_PROBE_FINISHED_NO_INTERNET".
WLAN-Icon im System Tray zeigt gelbes Dreieck mit Ausrufezeichen.

Lösungsschritte:
1. WLAN-Adapter neu starten:
   - Systemsteuerung → Netzwerkverbindungen
   - Rechtsklick auf WLAN-Adapter → "Deaktivieren"
   - 10 Sekunden warten
   - Rechtsklick → "Aktivieren"
   - Warten bis Verbindung hergestellt

2. IP-Konfiguration erneuern:
   - Eingabeaufforderung als Administrator öffnen (Win+X → "Terminal (Admin)")
   - Befehle nacheinander ausführen:
     ipconfig /release
     ipconfig /renew
     ipconfig /flushdns
   - Internetverbindung testen (Browser → google.com)

3. DNS-Server manuell setzen:
   - Systemsteuerung → Netzwerkverbindungen
   - Rechtsklick auf WLAN-Adapter → "Eigenschaften"
   - "Internetprotokoll Version 4 (TCP/IPv4)" → "Eigenschaften"
   - "Folgende DNS-Serveradressen verwenden":
     Bevorzugt: 8.8.8.8
     Alternativ: 8.8.4.4
   - OK → OK
   - Internetverbindung testen

4. Router neu starten:
   - Router vom Strom trennen
   - 30 Sekunden warten
   - Router wieder einstecken
   - Warten bis alle LEDs stabil leuchten (2-3 Minuten)
   - Laptop: WLAN neu verbinden
   - Internetverbindung testen

5. Netzwerk-Troubleshooter:
   - Windows-Einstellungen → Netzwerk und Internet → Status
   - "Netzwerkproblembehandlung" anklicken
   - Anweisungen folgen

6. Falls Problem weiterhin besteht:
   - Output von "ipconfig /all" kopieren (Eingabeaufforderung)
   - Ticket an Network Team eskalieren mit Output

Zusätzliche Hinweise:
Dieses Problem tritt häufig nach Windows-Updates oder wenn DHCP-Server Probleme hat auf.
Prävention: Router wöchentlich neu starten (z.B. jeden Sonntagabend). DNS-Cache regelmäßig leeren (ipconfig /flushdns).
Bekannte Limitation: Bei Public WLAN mit Captive Portal (Flughafen, Hotel) muss Browser-Login erfolgen bevor Internet funktioniert.
Eskalation: Falls ipconfig /all zeigt "IPv4-Adresse: 169.254.x.x" → DHCP-Problem → Sofort eskalieren an Network Team.

Tags: network, wifi, no-internet, dns-error, windows, dhcp

Verwandte Tickets: INC0008901, INC0009012
```

## Beispiel eines WLAN-Signal-KBA

```
Titel: "WLAN-Signal schwach - Signalstärke optimieren"

Problembeschreibung:
WLAN-Verbindung ist langsam oder bricht häufig ab.
Signalstärke zeigt nur 1-2 Balken im WLAN-Icon.
Download-Geschwindigkeit deutlich niedriger als normal.

Lösungsschritte:
1. Position optimieren:
   - Näher zum Router bewegen (Sichtlinie wenn möglich)
   - Hindernisse minimieren (Wände, Möbel reduzieren Signal)
   - Laptop höher platzieren (nicht auf Boden)

2. WLAN-Kanal optimieren:
   - WLAN-Analyzer-App installieren (z.B. "WiFi Analyzer" aus Microsoft Store)
   - Überlastete Kanäle identifizieren
   - Router-Einstellungen öffnen (meist http://192.168.1.1)
   - WLAN-Kanal manuell auf weniger überlasteten Kanal setzen
   - 2.4 GHz: Kanäle 1, 6 oder 11 (nicht überlappend)
   - 5 GHz: Meist automatisch optimal

3. WLAN-Band wechseln:
   - Falls Router Dual-Band (2.4 GHz + 5 GHz):
   - 5 GHz für kurze Distanz, hohe Geschwindigkeit
   - 2.4 GHz für größere Reichweite, langsamere Geschwindigkeit
   - WLAN-Liste öffnen und zwischen SSIDs wechseln (z.B. "CompanyWiFi" vs "CompanyWiFi_5G")

4. WLAN-Repeater einsetzen (bei Homeoffice):
   - WLAN-Repeater zwischen Router und Laptop platzieren
   - In Steckdose einstecken, Anleitung zur Einrichtung folgen
   - Mit Repeater-WLAN verbinden statt direkt mit Router

5. Ethernet-Kabel verwenden (beste Lösung):
   - LAN-Kabel vom Router zum Laptop
   - Deutlich stabiler und schneller als WLAN

Zusätzliche Hinweise:
WLAN-Signal wird durch Wände, Spiegel, Metall, Mikrowellen und andere WLAN-Geräte geschwächt.
5 GHz-Band ist schneller, aber hat kürzere Reichweite als 2.4 GHz.
Bei Homeoffice: Ethernet-Kabel ist immer die beste Lösung (kein Signal-Schwankungen).

Tags: network, wifi, wlan, signal-strength, slow-connection

Verwandte Tickets: INC0010123
```

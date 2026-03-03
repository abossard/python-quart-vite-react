# VPN-spezifische KBA-Guidelines

Diese Guidelines gelten für Knowledge Base Articles im Bereich **VPN (Virtual Private Network)**.

## Typische VPN-Probleme

### 1. Verbindungsfehler
- Timeout beim Verbindungsaufbau
- Authentifizierungsfehler (falsches Passwort, abgelaufenes Zertifikat)
- Fehler "Server nicht erreichbar"

### 2. Performance-Probleme
- Langsame Verbindung
- Häufige Verbindungsabbrüche
- Hohe Latenz

### 3. Konfigurationsprobleme
- Falsches VPN-Profil
- Fehlerhafte Client-Installation
- Firewall/Antivirus blockiert VPN

## VPN-Diagnostik-Standard

Bei jedem VPN-Problem sollten folgende Checks dokumentiert werden:

### Netzwerk-Konnektivität
```
1. Ping-Test zum VPN-Gateway: ping vpn.company.com
2. Traceroute zum Gateway: tracert vpn.company.com
3. DNS-Auflösung prüfen: nslookup vpn.company.com
```

### VPN-Client-Status
```
1. VPN-Client-Version prüfen (sollte aktuellste sein)
2. Logs des VPN-Clients einsehen (meist in C:\ProgramData\VPN\logs)
3. Zertifikats-Gültigkeit prüfen
```

### Firewall/Antivirus
```
1. Windows Firewall: VPN-Client als Ausnahme hinzufügen
2. Antivirus: VPN-Verbindung erlauben
3. Unternehmens-Firewall: Ports 1194 (OpenVPN) oder 500/4500 (IPsec) offen?
```

## Lösungsschritte-Standard für VPN-Probleme

Ein typischer VPN-Troubleshooting-Flow sollte diese Struktur haben:

```
1. VPN-Client neu starten
   - Rechtsklick auf VPN-Icon im System Tray → "Beenden"
   - VPN-Client neu öffnen → Verbindung erneut versuchen

2. Netzwerkadapter zurücksetzen
   - Eingabeaufforderung als Administrator öffnen
   - Befehle ausführen:
     ipconfig /release
     ipconfig /renew
     ipconfig /flushdns

3. VPN-Profil neu importieren
   - Altes Profil löschen (falls vorhanden)
   - Neues Profil importieren aus: \\fileserver\vpn\profiles\company-vpn.ovpn
   - Verbindung testen

4. VPN-Client neu installieren (falls Problem weiterhin besteht)
   - Deinstallation über Systemsteuerung
   - Neueste Version herunterladen von: https://intranet.company.com/software/vpn
   - Installation ausführen
   - Profil importieren

5. Eskalation (falls alle Schritte erfolglos)
   - Ticket an Network Team eskalieren mit vollständigen Logs
```

## VPN-spezifische Titel

Gute VPN-KBA-Titel folgen diesem Pattern:

- **[Problem] + [Kontext] + [Betriebssystem]**
- Beispiele:
  - ✅ "VPN-Verbindungsfehler 'Timeout' unter Windows 11 beheben"
  - ✅ "VPN-Client stürzt beim Start ab (macOS Sonoma)"
  - ✅ "VPN langsam: Verbindungsgeschwindigkeit optimieren"
  - ❌ "VPN funktioniert nicht" (zu unspezifisch)

## Tags für VPN-KBAs

**Pflicht-Tags:**
- `vpn`
- `network`

**Zusätzliche Tags je nach Kontext:**
- Betriebssystem: `windows`, `macos`, `linux`, `ios`, `android`
- Problem-Typ: `connection-error`, `timeout`, `authentication`, `performance`, `installation`
- Client: `openvpn`, `cisco-anyconnect`, `pulse-secure`
- Fehlercode (falls spezifisch): `error-800`, `error-619`

**Beispiel-Tag-Set:**
```
vpn, windows, openvpn, timeout, connection-error
```

## Verwandte Tickets

Bei VPN-KBAs sollten ähnliche Tickets referenziert werden:
- Andere VPN-Probleme mit gleichem Fehlercode
- Massenvorfälle (z.B. "VPN-Gateway-Ausfall am 2026-01-15")
- Verwandte Netzwerkprobleme

**Beispiel:**
```
INC0001234, INC0002456, INC0003789
```

## Zusätzliche Hinweise für VPN-KBAs

### Prävention
- VPN-Client immer aktuell halten (Auto-Update aktivieren)
- Passwort-Ablauf beachten (Push-Benachrichtigungen aktivieren)
- Bei Homeoffice: Router regelmäßig neu starten

### Bekannte Limitationen
- VPN funktioniert nicht über öffentliche Hotelwifi mit Captive Portal → Alternative: Mobile Hotspot
- Split-Tunneling bei manchen Profilen deaktiviert → Alle Internetanfragen gehen über VPN (kann langsam sein)

### Wann eskalieren?
- Mehr als 3 Verbindungsversuche fehlgeschlagen
- Fehlermeldung "Certificate invalid" oder "Server certificate verification failed"
- VPN-Client zeigt keine Logs
- Problem betrifft mehrere Benutzer gleichzeitig (möglicher Gateway-Ausfall)

## Sicherheitshinweise

In VPN-KBAs sollten **keine** sensiblen Informationen stehen:
- ❌ IP-Adressen von VPN-Gateways (nur Hostnames)
- ❌ Authentifizierungs-Token oder Zertifikats-Inhalte
- ❌ Firewall-Regeln im Detail
- ✅ Allgemeine Troubleshooting-Schritte

## Beispiel eines VPN-KBA

```
Titel: "VPN-Verbindungsfehler 'Timeout' unter Windows 11 beheben"

Problembeschreibung:
Benutzer können sich nicht mit dem Unternehmens-VPN verbinden. 
Der OpenVPN-Client zeigt die Fehlermeldung "Connection attempt timed out". 
Das Problem tritt sporadisch auf, hauptsächlich morgens zwischen 8-10 Uhr.

Lösungsschritte:
1. VPN-Client neu starten (Rechtsklick auf Icon im System Tray → "Beenden" → Neu öffnen)
2. Windows-Netzwerkadapter zurücksetzen:
   - Eingabeaufforderung als Admin öffnen
   - Befehle ausführen: ipconfig /release && ipconfig /renew && ipconfig /flushdns
3. VPN-Profil neu importieren:
   - Altes Profil löschen (falls vorhanden)
   - Neues Profil importieren: \\fileserver\vpn\profiles\company-vpn.ovpn
   - Verbindung erneut versuchen
4. Windows Firewall prüfen:
   - Systemsteuerung → Windows Defender Firewall → App-Kommunikation zulassen
   - OpenVPN als erlaubte App hinzufügen (falls nicht vorhanden)
5. Falls Problem weiterhin besteht:
   - VPN-Client-Logs sammeln (C:\ProgramData\OpenVPN\log\)
   - Ticket eskalieren an Network Team mit Logs

Zusätzliche Hinweise:
Timeout-Fehler treten häufig bei instabiler Internetverbindung auf.
Präventiv: VPN-Client auf Auto-Reconnect konfigurieren (Einstellungen → Verbindung → "Automatisch wiederverbinden" aktivieren).
Bekannte Limitation: Bei öffentlichen Hotelwifis mit Captive Portal funktioniert VPN erst nach Browser-Login im Portal.
Eskalation: Bei mehr als 3 Fehlversuchen oder wenn Fehler "Server certificate verification failed" erscheint.

Tags: vpn, openvpn, timeout, connection-error, windows, network

Verwandte Tickets: INC0001234, INC0002456, INC0005678
```

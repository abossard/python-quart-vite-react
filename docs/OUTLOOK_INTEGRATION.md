# Outlook-Kalender Integration - Roadmap

## ⚠️ WICHTIG: Platzhalter-System für Outlook-Integration

**Aktueller Stand:** Funktionierendes Booking-System mit .ics-Datei-Download  
**Dateinamen:** `PLATZHALTER-OUTLOOK-*.ics` (macht deutlich: Temporäre Lösung)

### Schnell finden für Outlook-API-Integration:

**Backend-Dateien (suche nach "TODO OUTLOOK-INTEGRATION"):**
- `backend/app.py` - Zeile ~196: Download-Endpoint für .ics
- `backend/operations.py` - Zeile ~80: Booking-Operationen
- `backend/operations.py` - Zeile ~130: `generate_ics_content()` Funktion

**Frontend-Dateien:**
- `frontend/src/App.jsx` - Zeile ~390: Buchungsformular mit Download-Button

**Suche im Code:**
```bash
grep -r "TODO OUTLOOK-INTEGRATION" backend/
grep -r "Platzhalter.*Outlook" frontend/
```

## Status
**Aktuell:** Platzhalter-Template mit In-Memory-Speicherung  
**Geplant:** Vollständige Microsoft Outlook/Exchange Calendar Integration

## Aktuelles Booking-System

Das aktuelle System dient als **funktionaler Platzhalter** für die spätere Outlook-Anbindung:

- **Frontend**: Buchungsformular in `frontend/src/App.jsx`
- **Backend**: REST-API in `backend/app.py` und `backend/operations.py`
- **Datenmodell**: `BookingCreate` und `Booking` Pydantic-Models
- **Speicherung**: Temporär In-Memory (`_bookings_db`)

## Geplante Outlook-Features

### 1. Microsoft Graph API Integration
- Anbindung an Microsoft 365/Outlook Calendar
- OAuth 2.0 Authentifizierung
- Zugriff auf Benutzer-Kalender

### 2. Verfügbarkeits-Prüfung
- Echtzeit-Check gegen Outlook-Kalender
- Anzeige nur verfügbarer Zeitslots
- Konflikterkennung mit bestehenden Terminen

### 3. Automatische Termin-Erstellung
- Direkte Erstellung von Outlook-Events
- Automatischer Versand von Einladungs-E-Mails
- Meeting-Links (Teams) optional

### 4. Synchronisation
- Bidirektionale Sync zwischen App und Outlook
- Aktualisierung bei Terminänderungen
- Absagen/Stornierungen

## Implementierungs-Schritte

### Phase 1: Microsoft Graph Setup
```python
# Benötigte Packages
pip install msal msgraph-core msgraph-sdk
```

- Azure AD App Registration
- API-Permissions konfigurieren (Calendars.ReadWrite)
- Client ID & Secret in `.env` speichern

### Phase 2: Backend-Erweiterung
```python
# backend/outlook_service.py
from msgraph import GraphServiceClient
from azure.identity import ClientSecretCredential

class OutlookCalendarService:
    async def get_availability(self, start_date, end_date):
        """Check calendar availability"""
        pass
    
    async def create_event(self, booking_data):
        """Create Outlook calendar event"""
        pass
    
    async def send_invitation(self, event_id, attendees):
        """Send meeting invitation"""
        pass
```

### Phase 3: Frontend-Anpassung
- Slots dynamisch aus Outlook-Verfügbarkeit laden
- Ladezeiten/Spinner für API-Calls
- Erfolgs-/Fehlerbehandlung für Outlook-Operationen

### Phase 4: Erweiterte Features
- Raumbuchung (Exchange Rooms)
- Ressourcen-Verwaltung (Hardware)
- Reminder/Notifications
- Teams-Meeting-Links

## API-Endpunkte (Geplant)

### GET /api/outlook/availability
Verfügbare Slots aus Outlook-Kalender abrufen
```json
{
  "start_date": "2026-02-20",
  "end_date": "2026-02-20",
  "duration_minutes": 20
}
```

### POST /api/outlook/book
Termin direkt in Outlook erstellen
```json
{
  "slot": "08:00",
  "attendee": {
    "name": "...",
    "email": "..."
  },
  "send_invitation": true
}
```

## Sicherheit & Compliance

- OAuth 2.0 Token-Management
- GDPR-konforme Datenspeicherung
- Audit-Logging für Kalenderzugriffe
- Rate-Limiting für Graph API-Calls

## Ressourcen

- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [MSAL Python Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-python)
- [Graph SDK for Python](https://github.com/microsoftgraph/msgraph-sdk-python)

## Timeline (Vorschlag)

1. **Woche 1-2**: Azure AD Setup, Graph API Zugriff testen
2. **Woche 3-4**: Backend Outlook-Service implementieren
3. **Woche 5**: Frontend-Integration, Verfügbarkeits-Anzeige
4. **Woche 6**: Testing, Fehlerbehandlung, Refinement
5. **Woche 7+**: Erweiterte Features (Teams, Räume, etc.)

---

**Hinweis**: Das aktuelle Template bleibt funktional - neue Outlook-Features werden schrittweise integriert.

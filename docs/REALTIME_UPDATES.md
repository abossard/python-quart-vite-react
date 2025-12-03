# Echtzeit-Updates Implementierung

## Übersicht

Das System unterstützt jetzt **Echtzeit-Updates** für alle Benutzer. Wenn ein Benutzer eine Änderung vornimmt (z.B. ein Gerät ausleiht), sehen alle anderen Benutzer die Änderung **sofort**, ohne die Seite neu laden zu müssen.

## Technische Implementierung

### Backend: Server-Sent Events (SSE)

**Neue Dateien:**
- `backend/events.py` - Event Manager mit Queue-System für Broadcasting

**Neuer Endpoint:**
- `GET /api/events-stream` - SSE-Stream für Echtzeit-Updates

**Event-Typen:**

**Geräte:**
- `device:created` - Neues Gerät erstellt
- `device:updated` - Gerät aktualisiert
- `device:deleted` - Gerät gelöscht
- `device:borrowed` - Gerät ausgeliehen
- `device:returned` - Gerät zurückgegeben
- `device:missing` - Gerät als vermisst gemeldet

**Benutzer:**
- `user:created` - Neuer Benutzer erstellt
- `user:updated` - Benutzer aktualisiert
- `user:deleted` - Benutzer gelöscht

**Departments:**
- `department:created` - Department erstellt
- `department:updated` - Department aktualisiert
- `department:deleted` - Department gelöscht

**Ämter:**
- `amt:created` - Amt erstellt
- `amt:updated` - Amt aktualisiert
- `amt:deleted` - Amt gelöscht

### Frontend: Automatisches Neu-Laden

**Aktualisierte Dateien:**
- `frontend/src/services/api.js` - `connectToEventsStream()` Funktion
- `frontend/src/features/devices/DeviceList.jsx` - Auto-Refresh bei device-Events
- `frontend/src/features/users/UserList.jsx` - Auto-Refresh bei user-Events
- `frontend/src/features/departments/DepartmentList.jsx` - Auto-Refresh bei department-Events
- `frontend/src/features/amts/AmtList.jsx` - Auto-Refresh bei amt/department-Events

**Funktionsweise:**
1. Jede Liste-Komponente verbindet sich beim Laden mit dem Events-Stream
2. Wenn ein relevantes Event empfangen wird, lädt die Komponente die Daten neu
3. Alle offenen Browser-Tabs erhalten die Updates gleichzeitig

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Quart)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │  devices.py │────▶│  events.py   │───▶│ EventManager │  │
│  │  app.py     │     │              │    │   (Queue)    │  │
│  └─────────────┘     └──────────────┘    └──────┬───────┘  │
│                                                    │          │
│                      /api/events-stream ◀─────────┘          │
│                                                               │
└───────────────────────────────────────┬───────────────────────┘
                                        │ SSE Stream
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │   Browser Tab 1  │ │   Browser Tab 2  │ │   Browser Tab 3  │
         ├──────────────────┤ ├──────────────────┤ ├──────────────────┤
         │  DeviceList      │ │  UserList        │ │  DepartmentList  │
         │  ├─ useEffect    │ │  ├─ useEffect    │ │  ├─ useEffect    │
         │  └─ Event Listener│ │  └─ Event Listener│ │  └─ Event Listener│
         └──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Event-Broadcasting in Services

### Beispiel: Device ausleihen

```python
# backend/devices.py
async def borrow_device(self, device_id: int, data: DeviceBorrow, user_id: int):
    # ... Gerät ausleihen ...
    
    device_updated = await self.get_device(device_id)
    
    # Broadcast Event an ALLE verbundenen Clients
    await broadcast_event(EventType.DEVICE_BORROWED, device_updated.model_dump(mode='json'))
    
    return device_updated
```

### Beispiel: User erstellen

```python
# backend/app.py
async def create_user():
    # ... User erstellen ...
    
    user = await authenticate_user_by_id(user_id, db)
    
    # Broadcast Event
    await broadcast_event(EventType.USER_CREATED, user.model_dump(mode='json'))
    
    return jsonify(user.model_dump(mode='json')), 201
```

## Frontend Event-Listening

### Beispiel: DeviceList

```javascript
// frontend/src/features/devices/DeviceList.jsx
useEffect(() => {
  loadData()
  
  // Verbindung zum Events-Stream herstellen
  const cleanup = connectToEventsStream(
    (event) => {
      // Bei device-Events neu laden
      if (event.type && event.type.startsWith('device:')) {
        console.log('Device event received:', event.type)
        loadDevices()
        loadStats()
      }
    },
    (error) => {
      console.error('Events stream error:', error)
    }
  )
  
  // Cleanup beim Unmount
  return cleanup
}, [])
```

## Testing

### Backend Test

```bash
# SSE-Stream testen
curl -N http://localhost:5001/api/events-stream
# Ausgabe: data: {"type": "connected", "timestamp": "..."}

# In anderem Terminal: Gerät ausleihen
curl -X POST http://localhost:5001/api/devices/1/borrow \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"borrower_name":"Test","borrower_email":"test@example.com",...}'

# Im ersten Terminal erscheint sofort:
# data: {"type": "device:borrowed", "data": {...}, "timestamp": "..."}
```

### Frontend Test

1. Öffnen Sie zwei Browser-Tabs mit der Geräte-Liste
2. Leihen Sie in Tab 1 ein Gerät aus
3. Tab 2 aktualisiert **automatisch** die Liste - ohne Refresh!

## Performance

- **EventManager**: Queue-basiert mit automatischer Cleanup bei langsamen Clients
- **Max Queue Size**: 100 Events pro Client
- **Timeout**: 0.1 Sekunden pro Event-Broadcast
- **Connection Cleanup**: Automatisch bei Disconnect oder Fehler

## Browser-Kompatibilität

Server-Sent Events werden von allen modernen Browsern unterstützt:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅

## Skalierung

Für Produktions-Umgebungen mit vielen gleichzeitigen Benutzern:

1. **Redis PubSub**: Events über Redis verteilen für Multi-Server-Setups
2. **WebSocket**: Alternative zu SSE für bidirektionale Kommunikation
3. **Event Batching**: Mehrere Events zusammenfassen bei hoher Last
4. **Selective Broadcasting**: Nur relevante Events an bestimmte User-Gruppen

## Fehlerbehebung

**Events kommen nicht an:**
```bash
# Server-Logs prüfen
tail -f /tmp/backend.log | grep "broadcast"

# Event-Stream direkt testen
curl -N http://localhost:5001/api/events-stream
```

**Browser Console:**
```javascript
// Event-Listening manuell testen
const es = new EventSource('/api/events-stream')
es.onmessage = (e) => console.log('Event:', JSON.parse(e.data))
```

**Häufige Probleme:**
- Browser-Tab im Hintergrund → Events werden gepuffert
- Ad-Blocker → Kann SSE blockieren
- Firewalls → Müssen lange HTTP-Verbindungen erlauben

## Erweiterungen

Um neue Events hinzuzufügen:

1. **Event-Typ definieren** in `backend/events.py`:
   ```python
   class EventType(str, Enum):
       LOCATION_CREATED = "location:created"
   ```

2. **Event senden** im Service:
   ```python
   await broadcast_event(EventType.LOCATION_CREATED, location_data)
   ```

3. **Event empfangen** im Frontend:
   ```javascript
   if (event.type && event.type.startsWith('location:')) {
     loadLocations()
   }
   ```

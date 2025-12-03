# Authentication & Authorization - Schritt 3 Dokumentation

## Übersicht

Die Authentifizierung und Autorisierung für Grabit ist vollständig implementiert und funktional.

## Implementierte Module

### 1. `backend/auth.py`
- **Password Hashing**: SHA-256 für Passwort-Hashing (hash_password, verify_password)
- **Session Management**: In-Memory Session Store mit Ablaufzeit
  - `create_session()`: Erstellt neue Session mit 24h Ablauf
  - `get_session()`: Ruft Session ab und prüft Ablauf
  - `destroy_session()`: Löscht Session
  - `refresh_session()`: Verlängert Session
- **Role-Based Access Control (RBAC)**:
  - Rolle-Hierarchie: servicedesk < user < editor < redakteur < admin
  - `has_role()`: Prüft ob User ausreichende Rechte hat
  - `get_current_user()`: Holt aktuellen User aus Session
- **Decorators für Endpunkte**:
  - `@require_auth`: Erfordert Authentifizierung (401 wenn nicht)
  - `@require_role(role)`: Erfordert spezifische Rolle (403 wenn nicht)
  - Convenience: `@require_admin`, `@require_editor`, etc.
- **Helper Functions**:
  - `authenticate_user()`: Authentifiziert User mit Username/Passwort
  - `get_session_info()`: Gibt SessionInfo zurück

### 2. `backend/database.py`
- **SQLite Integration** (Dev-Phase, später MySQL/MariaDB):
  - `init_db()`: Initialisiert Datenbank und erstellt Schema
  - `close_db()`: Schließt Datenbankverbindung
  - `get_db()`: Gibt aktive DB-Connection zurück
  - `db_transaction()`: Context Manager für Transaktionen
- **Schema-Auto-Creation**: Erstellt alle Tabellen wenn nicht vorhanden
- **Seed Data**: Standard-User (admin/testuser) und Referenzdaten

### 3. `backend/app.py` - Auth Endpoints

#### POST `/api/auth/login`
**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "session_id": "HKlWUILXg5DkRx4b2s0tawBh_GpQGvRRyToYTsK1pOw",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "location_id": null,
    "department_id": null,
    "amt_id": null,
    "created_at": "2025-11-27T13:16:54",
    "location": null,
    "department": null,
    "amt": null
  }
}
```

**Cookies:** Setzt `session_id` HTTP-only Cookie (24h)

**Errors:**
- 401: Invalid username or password
- 400: Validation error

#### POST `/api/auth/logout`
**Requires:** `@require_auth` (session cookie)

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Cookies:** Löscht `session_id` Cookie

#### GET `/api/auth/me`
**Requires:** `@require_auth` (session cookie)

**Response (200):**
```json
{
  "user": { ... },
  "session": {
    "session_id": "...",
    "expires_at": "2025-11-28T13:16:54"
  }
}
```

**Errors:**
- 401: Authentication required

#### GET `/api/auth/check`
**No Auth Required** (prüft nur ob authentifiziert)

**Response (200) - Authenticated:**
```json
{
  "authenticated": true,
  "user": { ... }
}
```

**Response (200) - Not Authenticated:**
```json
{
  "authenticated": false
}
```

## Features

### Sicherheit
- ✅ HTTP-only Cookies (verhindert XSS)
- ✅ SameSite=Lax (verhindert CSRF)
- ✅ SHA-256 Password Hashing
- ✅ Session Expiration (24h)
- ✅ Secure Flag (für Production mit HTTPS)

### Session Management
- ✅ In-Memory Store (später Redis für Production)
- ✅ Automatisches Ablaufen nach 24h
- ✅ Session-Refresh möglich
- ✅ Session-ID: Secure Token (32 Bytes, URL-safe)

### Role-Based Access Control
- ✅ 5 Rollen mit Hierarchie
- ✅ Dekorator-basierte Autorisierung
- ✅ Granulare Rechteverwaltung

## Datenbank-Schema

**users Table:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    location_id INTEGER,
    department_id INTEGER,
    amt_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (amt_id) REFERENCES amt(id)
);
```

## Standard-Credentials

**Admin User:**
- Username: `admin`
- Password: `admin123`
- Role: `admin`

**Test User:**
- Username: `testuser`
- Password: `test123`
- Role: `user`
- Location: Bollwerk
- Department: EDI
- Amt: BIT

## Testing

### Login Test
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt
```

### Check Auth Test
```bash
curl -b cookies.txt http://localhost:5001/api/auth/check
```

### Logout Test
```bash
curl -X POST http://localhost:5001/api/auth/logout -b cookies.txt
```

## Nächste Schritte (Schritt 4)

Die Auth-Grundlage ist fertig. Jetzt können wir Device Management APIs implementieren:
- CRUD Endpoints für Geräte
- Ausleihe/Rückgabe mit Auth-Check
- Vermisst-Meldung
- Transaction-Logging

Alle Device-Endpoints werden `@require_auth` oder `@require_role()` verwenden!

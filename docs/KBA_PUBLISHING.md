# KBA Publishing Feature

## Übersicht

Das Publishing-Feature ermöglicht es, validierte KBA-Drafts in eine Knowledge Base zu veröffentlichen. Die Implementierung folgt dem Adapter-Pattern und unterstützt verschiedene Ziel-Systeme.

## Architektur

### Komponenten

1. **KB Adapters** (`kb_adapters.py`)
   - `BaseKBAdapter`: Abstract base class für alle Adapter
   - `FileSystemKBAdapter`: Publiziert KBAs als Markdown-Dateien (MVP)
   - Stub-Adapter: SharePoint, ITSM, Confluence (für zukünftige Implementierung)
   - `get_kb_adapter()`: Factory-Funktion

2. **KBA Service** (`kba_service.py`)
   - `publish_draft()`: Hauptmethode für Publishing mit Validierung und Idempotenz
   - `_get_adapter_config()`: Lädt Adapter-Konfiguration

3. **API Endpoint** (`app.py`)
   - `POST /api/kba/drafts/<draft_id>/publish`
   - Request Body: `KBAPublishRequest`
   - Response: `KBAPublishResult`

### Status-Übergänge

```
DRAFT → (auto-review) → REVIEWED → PUBLISHED
                                  ↘ FAILED
```

- **DRAFT**: Initial generiert, kann direkt publiziert werden (auto-review)
- **REVIEWED**: Manuell geprüft oder auto-reviewed
- **PUBLISHED**: Erfolgreich in KB übernommen
- **FAILED**: Publishing fehlgeschlagen

## API Usage

### Publish Request

```bash
POST /api/kba/drafts/{draft_id}/publish
Content-Type: application/json

{
  "target_system": "file",
  "category": "VPN",
  "visibility": "internal",
  "user_id": "admin@example.com"
}
```

**Parameter:**
- `target_system`: `file`, `sharepoint`, `itsm`, `confluence`
- `category`: Optional - KB-Kategorie/Ordner
- `visibility`: `internal`, `public`, `restricted`
- `user_id`: Benutzer-ID für Audit-Trail

### Publish Response (Success)

```json
{
  "success": true,
  "published_id": "KB-A1B2C3D4",
  "published_url": "file:///kb/published/VPN/KB-A1B2C3D4-vpn-connection.md",
  "message": "KBA successfully published to file"
}
```

### Publish Response (Already Published - Idempotent)

```json
{
  "success": true,
  "published_id": "KB-A1B2C3D4",
  "published_url": "file:///kb/published/VPN/KB-A1B2C3D4-vpn-connection.md",
  "message": "KBA was already published on 2026-03-03 10:30"
}
```

### Error Response

```json
{
  "error": "PublishFailedError",
  "message": "Failed to publish to sharepoint: Authentication failed",
  "type": "publish_failed"
}
```

## Implementierung Features

### ✅ Idempotenz

Publishing ist idempotent - mehrfaches Publizieren desselben Drafts gibt das existierende Ergebnis zurück ohne Fehler:

```python
# Erster Aufruf: Veröffentlicht
result1 = await service.publish_draft(draft_id, request)
# result1.success = True, result1.published_id = "KB-..."

# Zweiter Aufruf: Gibt gleiches Ergebnis zurück
result2 = await service.publish_draft(draft_id, request)
# result2.success = True, result2.published_id = "KB-..." (gleich)
# result2.message = "... already published ..."
```

### ✅ Auto-Review

Drafts im Status `DRAFT` werden automatisch zu `REVIEWED` transitioniert:

```python
draft.status = "draft"  # Initial

await service.publish_draft(draft_id, request)

# Nach Publishing:
# draft.status = "published"
# draft.reviewed_by = request.user_id
```

### ✅ Audit Trail

Alle Publishing-Aktionen werden geloggt:

```python
# Success
audit.log_event(
    draft_id=draft_id,
    event_type=KBAAuditEventType.DRAFT_PUBLISHED,
    user_id=user_id,
    details={
        "target_system": "file",
        "published_url": "...",
        "published_id": "KB-...",
        "metadata": {...}
    }
)

# Failure
audit.log_event(
    draft_id=draft_id,
    event_type=KBAAuditEventType.PUBLISH_FAILED,
    user_id=user_id,
    details={
        "target_system": "sharepoint",
        "error": "Authentication failed"
    }
)
```

### ✅ Error Handling

```python
# Draft nicht gefunden
raise DraftNotFoundError("Draft {id} not found")

# Falscher Status (FAILED)
raise InvalidStatusError("Cannot publish draft in FAILED status")

# Adapter-Fehler
raise PublishFailedError("Failed to publish: {error}")
```

## Adapter-System

### FileSystemKBAdapter (MVP)

Publiziert KBAs als Markdown-Dateien im lokalen Dateisystem oder Netzwerk-Share.

**Konfiguration:**

```python
config = {
    "base_path": "./kb_published",      # Zielverzeichnis
    "create_categories": True           # Kategorie-Unterordner erstellen
}

adapter = FileSystemKBAdapter(config)
```

**Generierte Dateien:**

```
kb_published/
├── VPN/
│   └── KB-A1B2C3D4-vpn-connection-failed.md
├── PASSWORD_RESET/
│   └── KB-B2C3D4E5-password-reset-procedure.md
└── NETWORK/
    └── KB-C3D4E5F6-network-troubleshooting.md
```

**Markdown-Format:**

```markdown
# VPN Connection Failed

---
**KB-ID:** KB-A1B2C3D4
**Ticket:** INC0001234
**Published:** 2026-03-03 10:30
**Visibility:** internal
**Tags:** vpn, network
---

## Symptome / Fehlerbild

- Cannot connect to VPN
- Error: Connection timeout

## Ursache

Firewall blocking port 443

## Lösung

1. Check firewall settings
2. Open port 443
3. Restart VPN client

## Validierung

- Test VPN connection
- Verify access to internal resources

## ⚠️ Wichtige Hinweise

- Requires administrator rights
- Backup configuration before changes
```

### Stub-Adapter (Zukünftig)

SharePoint, ITSM (ServiceNow), Confluence - Geben aktuell Fehlermeldung zurück:

```python
adapter = get_kb_adapter("sharepoint")
result = await adapter.publish(draft_dict)
# result.success = False
# result.error_message = "SharePoint publishing not yet implemented. Use 'file' adapter for MVP."
```

## Testing

### Unit Tests

```bash
# Alle Publishing-Tests
pytest backend/tests/test_kba_publishing.py -v

# Nur erfolgreiche Publishes
pytest backend/tests/test_kba_publishing.py -k "success" -v

# FileSystem Adapter Tests
pytest backend/tests/test_kba_publishing.py::TestFileSystemAdapter -v
```

### Test Coverage

- ✅ Erfolgreiches Publishing (FileSystem)
- ✅ Idempotenz (mehrfaches Publishing)
- ✅ Auto-Review von DRAFT → REVIEWED
- ✅ Draft nicht gefunden
- ✅ Falscher Status (FAILED)
- ✅ Adapter-Fehler
- ✅ Unerwartete Exceptions
- ✅ FileSystem-Adapter: Datei-Generierung
- ✅ FileSystem-Adapter: Kategorie-Ordner
- ✅ FileSystem-Adapter: Invalid Path
- ✅ Adapter Factory

**Test-Ergebnisse:** 13/13 passed ✅

## Integration mit Frontend

### React Component (Beispiel)

```jsx
async function publishDraft(draftId) {
  try {
    const response = await fetch(
      `/api/kba/drafts/${draftId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_system: 'file',
          category: 'VPN',
          visibility: 'internal',
          user_id: currentUser.email
        })
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(`Published: ${result.published_url}`);
    } else {
      showError(result.message);
    }
  } catch (error) {
    showError(`Publishing failed: ${error.message}`);
  }
}
```

### Publish Button

```jsx
<button
  onClick={() => publishDraft(draft.id)}
  disabled={draft.status === 'published' || draft.status === 'failed'}
  className="btn btn-primary"
>
  {draft.status === 'published' ? 'Already Published' : 'Publish to KB'}
</button>

{draft.published_url && (
  <a href={draft.published_url} target="_blank" className="btn btn-link">
    View in KB
  </a>
)}
```

## Konfiguration (Production)

### Environment Variables

```bash
# FileSystem Adapter
KB_FILE_BASE_PATH=/mnt/kb_share
KB_FILE_CREATE_CATEGORIES=true

# SharePoint Adapter (zukünftig)
KB_SHAREPOINT_SITE_URL=https://company.sharepoint.com/sites/KB
KB_SHAREPOINT_CLIENT_ID=...
KB_SHAREPOINT_CLIENT_SECRET=...

# ITSM Adapter (zukünftig)
KB_ITSM_INSTANCE_URL=https://company.service-now.com
KB_ITSM_USERNAME=...
KB_ITSM_PASSWORD=...
```

### Adapter Config laden

```python
import os

def _get_adapter_config(self, target_system: str) -> dict:
    """Load adapter config from environment"""
    if target_system == "file":
        return {
            "base_path": os.getenv("KB_FILE_BASE_PATH", "./kb_published"),
            "create_categories": os.getenv("KB_FILE_CREATE_CATEGORIES", "true").lower() == "true"
        }
    # ... weitere Adapter
```

## Erweiterung: Neue Adapter

### 1. Adapter-Klasse erstellen

```python
class MyKBAdapter(BaseKBAdapter):
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """Implementierung für MyKB"""
        try:
            # API-Call zu MyKB
            response = await self._call_api(draft_dict)
            
            return KBPublishResult(
                success=True,
                published_id=response["id"],
                published_url=response["url"]
            )
        except Exception as e:
            return KBPublishResult(
                success=False,
                error_message=str(e)
            )
    
    async def verify_connection(self) -> bool:
        """Verbindung testen"""
        try:
            await self._ping()
            return True
        except:
            return False
```

### 2. Factory erweitern

```python
# In kb_adapters.py
def get_kb_adapter(target_system: str, config: Optional[dict] = None):
    adapters = {
        "file": FileSystemKBAdapter,
        "sharepoint": SharePointKBAdapter,
        "itsm": ITSMKBAdapter,
        "confluence": ConfluenceKBAdapter,
        "mykb": MyKBAdapter,  # NEU
    }
    # ...
```

### 3. Tests schreiben

```python
class TestMyKBAdapter:
    @pytest.mark.anyio
    async def test_publish_success(self):
        adapter = MyKBAdapter({"api_key": "test"})
        result = await adapter.publish(draft_dict)
        assert result.success is True
```

## Bekannte Limitationen

- ☑️ FileSystem-Adapter erfordert Schreibrechte auf Zielverzeichnis
- ☑️ Keine automatische Konfliktauflösung bei gleichem Dateinamen
- ☑️ SharePoint/ITSM/Confluence noch nicht implementiert (Stubs)
- ☑️ Keine Versionierung von publizierten KBAs
- ☑️ Keine Rücknahme (un-publish) Funktion

## Roadmap

### Phase 1 (MVP) ✅
- ✅ Adapter-Pattern Infrastruktur
- ✅ FileSystem-Adapter
- ✅ Idempotenz
- ✅ Auto-Review
- ✅ Comprehensive Tests

### Phase 2 (Planned)
- ⏳ SharePoint Online Adapter
- ⏳ ITSM (ServiceNow) Adapter
- ⏳ Confluence Adapter
- ⏳ Un-publish Funktion
- ⏳ Versionierung

### Phase 3 (Future)
- 📋 Automatisches Re-Publishing bei Änderungen
- 📋 Bulk-Publishing
- 📋 Publishing-Approval-Workflow
- 📋 Mehrsprachige KBAs

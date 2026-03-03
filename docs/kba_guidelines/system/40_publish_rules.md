---
title: Publishing Rules & Workflow
version: 1.0.0
enabled: true
priority: 40
---

# Publishing-Regeln und Workflow

Diese Guideline definiert den **Workflow** vom Draft bis zur Veröffentlichung.

## Status-Lifecycle

Ein KBA-Draft durchläuft folgende Stati:

```
draft → reviewed → published
         ↓
      rejected (bei Qualitätsmängeln)
```

### Status: `draft`
- **Initialer Status** nach LLM-Generierung
- KBA wurde noch **nicht** von einem Menschen geprüft
- Kann editiert werden
- **Nicht** für Publishing freigegeben

**Erlaubte Aktionen:**
- ✅ Editieren (PATCH `/kba/drafts/{id}`)
- ✅ Löschen (DELETE `/kba/drafts/{id}`)
- ❌ Veröffentlichen (Publishing blockiert)

---

### Status: `reviewed`
- KBA wurde **manuell geprüft** und für korrekt befunden
- Alle Qualitätskriterien erfüllt (siehe 30_quality_checks.md)
- Bereit für Publishing

**Erlaubte Aktionen:**
- ✅ Veröffentlichen (POST `/kba/drafts/{id}/publish`)
- ✅ Editieren (setzt Status zurück auf `draft`)
- ✅ Löschen

**Übergang:**
- Manuell durch Support-Mitarbeiter
- Button "Als geprüft markieren" im Frontend
- Backend: PATCH mit `{"status": "reviewed", "reviewed_by": "user@example.com"}`

---

### Status: `published`
- KBA wurde in die Knowledge Base übernommen
- **Nicht mehr editierbar** (nur Read-Only)
- Referenz zur veröffentlichten Knowledge Base ID gespeichert

**Erlaubte Aktionen:**
- ✅ Lesen (GET `/kba/drafts/{id}`)
- ❌ Editieren (blockiert)
- ❌ Löschen (blockiert)

**Übergang:**
- POST `/kba/drafts/{id}/publish` mit `{"target_system": "file", "user_id": "..."}`
- Automatisch: KBA wird exportiert (Markdown, HTML, JSON)

---

### Status: `rejected` (optional)
- KBA wurde geprüft und für **nicht veröffentlichungswürdig** befunden
- Qualitätsmängel oder fehlende Informationen

**Erlaubte Aktionen:**
- ✅ Editieren (setzt Status zurück auf `draft`)
- ✅ Löschen

---

## Workflow-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Generierung: POST /kba/drafts                            │
│    Input: ticket_id, user_id                                │
│    Output: KBA Draft mit status="draft"                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Manuelle Review (Frontend)                               │
│    - Support liest Draft                                    │
│    - Prüft gegen Qualitätskriterien (30_quality_checks.md)  │
│    - Editiert falls nötig (PATCH /kba/drafts/{id})          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ✅ Approved             ❌ Rejected
         │                       │
         ▼                       ▼
┌────────────────────┐  ┌────────────────────┐
│ 3a. Mark Reviewed  │  │ 3b. Reject / Delete│
│ PATCH {...status:  │  │ PATCH {...status:  │
│   "reviewed"}      │  │   "rejected"}      │
└────────┬───────────┘  └────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Publishing: POST /kba/drafts/{id}/publish                │
│    Input: target_system ("file", "confluence", etc.)        │
│    Output: KBA ID/URL in target system                      │
│    → Status wird automatisch auf "published" gesetzt        │
└─────────────────────────────────────────────────────────────┘
```

---

## Publishing-Voraussetzungen (Checklist)

Ein KBA darf nur veröffentlicht werden, wenn:

### Pflicht (Blockierend)
- [ ] **Status = `reviewed`** (manuell geprüft)
- [ ] **Alle Pflichtfelder ausgefüllt** (title, symptoms, resolution_steps, tags)
- [ ] **Keine Spekulation** in resolution_steps ("vielleicht", "könnte")
- [ ] **Keine Halluzinationen** (alle Infos aus Ticket ableitbar)
- [ ] **Titel ist spezifisch** (enthält Keywords + Kontext)
- [ ] **Lösungsschritte sind umsetzbar** (konkret, nicht abstrakt)

### Empfohlen (Warnung, aber nicht blockierend)
- [ ] **Root Cause dokumentiert** (falls vorhanden in Ticket)
- [ ] **Validierungsschritte definiert** (validation_checks ausgefüllt)
- [ ] **Bei Unsicherheiten**: `confidence_notes` ausgefüllt
- [ ] **Bei Warnungen**: `warnings`-Feld ausgefüllt

---

## Publishing-Ziele (Target Systems)

Aktuell unterstützte Ziele:

### 1. `file` (Markdown/JSON export)
- Exportiert KBA als Markdown-Datei
- Speichert im lokalen Filesystem
- Pfad: `backend/data/kba_published/{draft_id}.md`
- **Empfohlen für:** Testing, Prototyping

### 2. `confluence` (Atlassian Confluence)
- Erstellt neue Confluence-Page im KBA-Space
- Konvertiert Markdown → Confluence Storage Format
- **Voraussetzung:** Confluence API-Token konfiguriert
- **Status:** TODO (nicht implementiert)

### 3. `sharepoint` (Microsoft SharePoint)
- Upload als Dokument in SharePoint-Bibliothek
- **Voraussetzung:** SharePoint API-Credentials
- **Status:** TODO (nicht implementiert)

---

## Rechteprüfung (Authorization)

Folgende Rollen haben Publishing-Rechte:

| Rolle               | draft erstellen | editieren | review | publish |
|---------------------|----------------|-----------|--------|---------|
| **Support Agent**   | ✅             | ✅        | ❌     | ❌      |
| **Senior Support**  | ✅             | ✅        | ✅     | ❌      |
| **KBA Admin**       | ✅             | ✅        | ✅     | ✅      |

**Hinweis:** Aktuell sind Rechte noch nicht implementiert (TODO im Frontend markiert).

---

## Audit Trail

Jede Änderung am KBA wird im Audit-Log gespeichert:

```json
{
  "draft_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "status_change",
  "user_id": "user@example.com",
  "timestamp": "2025-10-22T14:35:20Z",
  "old_value": "draft",
  "new_value": "reviewed",
  "ip_address": "10.0.0.42"
}
```

**Abruf:** GET `/kba/drafts/{id}/audit`

---

## Beispiel: Kompletter Workflow

### Schritt 1: Generierung
```bash
POST /api/kba/drafts
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "support@example.com"
}

Response:
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "draft",
  "title": "VPN-Verbindung schlägt fehl mit Timeout",
  ...
}
```

### Schritt 2: Manuelle Review
- Support-Mitarbeiter liest Draft im Frontend
- Prüft Qualität (siehe 30_quality_checks.md)
- Optional: Editiert Felder (PATCH `/kba/drafts/{id}`)

### Schritt 3: Mark as Reviewed
```bash
PATCH /api/kba/drafts/123e4567-e89b-12d3-a456-426614174000
{
  "status": "reviewed",
  "reviewed_by": "senior-support@example.com"
}
```

### Schritt 4: Publishing
```bash
POST /api/kba/drafts/123e4567-e89b-12d3-a456-426614174000/publish
{
  "target_system": "file",
  "user_id": "kba-admin@example.com"
}

Response:
{
  "success": true,
  "draft_id": "123e4567-e89b-12d3-a456-426614174000",
  "published_id": "KBA-2025-001",
  "published_url": "file://backend/data/kba_published/123e4567.md",
  "published_at": "2025-10-22T14:35:20Z"
}
```

### Schritt 5: Audit Trail abrufen
```bash
GET /api/kba/drafts/123e4567-e89b-12d3-a456-426614174000/audit

Response:
[
  {
    "action": "created",
    "user_id": "support@example.com",
    "timestamp": "2025-10-22T14:30:00Z"
  },
  {
    "action": "status_change",
    "old_value": "draft",
    "new_value": "reviewed",
    "user_id": "senior-support@example.com",
    "timestamp": "2025-10-22T14:34:00Z"
  },
  {
    "action": "published",
    "user_id": "kba-admin@example.com",
    "timestamp": "2025-10-22T14:35:20Z"
  }
]
```

---

## Fehlerbehandlung

### Fehler: Publishing ohne `reviewed` Status
```bash
POST /api/kba/drafts/{id}/publish
→ 400 Bad Request: "Cannot publish draft with status 'draft'. Must be 'reviewed' first."
```

### Fehler: Editieren nach Publishing
```bash
PATCH /api/kba/drafts/{id}
→ 400 Bad Request: "Cannot edit published draft. Status is 'published'."
```

### Fehler: Fehlende Pflichtfelder
```bash
POST /api/kba/drafts/{id}/publish
→ 400 Bad Request: "Validation failed: 'title' is required"
```

---

**Ziel:** Sicherstellen, dass nur geprüfte, qualitativ hochwertige KBAs veröffentlicht werden.

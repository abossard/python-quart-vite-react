# KBA Drafter - Feature Overview

> **Status:** ✅ Production Ready (MVP)

## Was ist der KBA Drafter?

Der KBA Drafter ist ein **LLM-unterstütztes Tool zur automatischen Generierung von Knowledge Base Articles (KBAs)** aus IT-Support-Tickets. Er analysiert Ticketdaten aus CSV-Exports und erstellt strukturierte, prüfbare KBA-Entwürfe in Deutsch.

## Warum KBA Drafter?

**Problem:** IT-Support-Teams verbringen Stunden damit, manuelle KBA-Artikel aus gelösten Tickets zu erstellen.

**Lösung:** Der KBA Drafter automatisiert den ersten Entwurf:
- ⚡ Generiert KBA in ~2-5 Sekunden
- 📋 Strukturierte Ausgabe mit Symptomen, Ursache, Lösung
- ✏️ Editierbar und manuell prüfbar
- 📚 Nutzt Guidelines für konsistente Qualität
- 🔒 Veröffentlichung nur nach Review

## Architektur-Übersicht

```
┌─────────────┐
│   React UI  │ KBADrafterPage.jsx
└──────┬──────┘
       │ REST
       ▼
┌─────────────┐
│ Quart API   │ /api/kba/drafts
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ KBAService  │ Business Logic + Validation
└──┬────┬─────┘
   │    │
   │    └─────────────┐
   │                  ▼
   │            ┌─────────────┐
   │            │  Ollama     │ LLM (llama3.2:1b)
   │            │  Service    │
   │            └─────────────┘
   │
   ├─────────────┐
   │             ▼
   │       ┌─────────────┐
   │       │ Guidelines  │ Markdown-Dateien
   │       │ Loader      │ (system/, categories/)
   │       └─────────────┘
   │
   ├─────────────┐
   │             ▼
   │       ┌─────────────┐
   │       │ CSV Ticket  │ data.csv Parser
   │       │ Service     │
   │       └─────────────┘
   │
   └─────────────┐
                 ▼
           ┌─────────────┐
           │ KB Adapters │ FileSystem, SharePoint, etc.
           └─────────────┘
```

## Komponenten-Stack

### Backend (Python/Quart)

| Komponente | Datei | Zweck |
|------------|-------|-------|
| **KBA Service** | `kba_service.py` | Hauptlogik für Draft-Generierung und Publishing |
| **Ollama Service** | `ollama_service.py` | HTTP-Client für lokales LLM |
| **Structured Output Parser** | `ollama_structured_output.py` | JSON-Parsing mit Retry und Repair |
| **KB Adapters** | `kb_adapters.py` | Publishing zu verschiedenen KB-Systemen |
| **Guidelines Loader** | `guidelines_loader.py` | Lädt Markdown-Guidelines mit Frontmatter |
| **CSV Service** | `csv_data.py` | Parst Ticket-CSV (BMC Remedy Format) |
| **Audit Service** | `kba_audit.py` | Logging aller KBA-Aktionen |
| **API Endpoints** | `app.py` | REST API für Frontend |

### Frontend (React/FluentUI)

| Komponente | Datei | Zweck |
|------------|-------|-------|
| **KBA Drafter Page** | `KBADrafterPage.jsx` | Haupt-UI-Komponente |
| **API Service** | `api.js` | REST-Client-Funktionen |

### Datenmodelle (Pydantic)

| Modell | Zweck |
|--------|-------|
| `KBADraft` | Vollständiger KBA-Entwurf |
| `KBADraftCreate` | DTO für Erstellung |
| `KBADraftUpdate` | DTO für Updates (partial) |
| `KBAPublishRequest` | DTO für Publishing |
| `KBAPublishResult` | Response vom Publishing |

### Status-Lifecycle

```
┌────────┐      ┌──────────┐      ┌───────────┐
│ DRAFT  │─────>│ REVIEWED │─────>│ PUBLISHED │
└────────┘      └──────────┘      └───────────┘
     │                                    
     └───────────────────────────────────>│
                                      FAILED
```

## Hauptfunktionen

### 1. KBA Generierung

**Eingabe:** Ticket-UUID aus CSV  
**Ausgabe:** Strukturierter KBA-Entwurf

**Generierte Felder:**
- `title`: SEO-optimierter Titel
- `symptoms`: Liste von Symptomen/Fehlern
- `cause`: Root-Cause-Analyse
- `resolution_steps`: Schritt-für-Schritt-Lösung
- `validation_checks`: Verifikations-Schritte
- `warnings`: Wichtige Hinweise
- `tags`: Suchbegriffe
- `confidence_notes`: LLM-Unsicherheiten

**Beispiel:**
```python
draft = await kba_service.generate_draft(
    KBADraftCreate(
        ticket_id="550e8400-e29b-41d4-a716-446655440000",
        user_id="admin@example.com"
    )
)
# draft.title = "VPN Connection Failed After Windows Update"
# draft.symptoms = ["Cannot connect to VPN", "Error: Connection timeout"]
# draft.llm_generation_time_ms = 2847
```

### 2. Strukturiertes Output-Parsing

**Problem:** LLMs geben manchmal ungültiges JSON zurück  
**Lösung:** 4-stufiger Fallback-Parser + automatisches Retry

```python
parser = StructuredOutputParser(schema=KBA_OUTPUT_SCHEMA)

# Versucht automatisch:
# 1. Tool-Call-Format
# 2. Markdown-Code-Block
# 3. JSON-Extraktion aus Text
# 4. Full-Response-Parse

# Bei Fehler: Retry mit Repair-Prompt
result = await parser.parse_with_retry(
    ollama_response=response,
    retry_fn=ollama_retry,
    max_retries=1
)
```

### 3. Guidelines-System

**Struktur:**
```
docs/kba_guidelines/
├── system/                    # Immer geladen
│   ├── 00_system_role.md      # LLM-Persona
│   ├── 10_kba_structure.md    # Feldformat
│   ├── 20_writing_style.md    # Sprache/Ton
│   ├── 30_quality_checks.md   # Validierung
│   └── 40_publish_rules.md    # Workflow
└── categories/                # Selektiv geladen
    ├── GENERAL.md
    ├── VPN.md
    ├── PASSWORD_RESET.md
    └── NETWORK.md
```

**YAML Frontmatter:**
```yaml
---
title: "KBA Structure Guide"
version: "1.0"
enabled: true
priority: 10
---
```

### 4. Publishing-System

**Adapter-Pattern:**
- `FileSystemKBAdapter`: Markdown-Dateien (MVP) ✅
- `SharePointKBAdapter`: Microsoft SharePoint (Stub)
- `ITSMKBAdapter`: ServiceNow KB (Stub)
- `ConfluenceKBAdapter`: Atlassian Confluence (Stub)

**Beispiel (FileSystem):**
```python
result = await kba_service.publish_draft(
    draft_id=uuid,
    publish_req=KBAPublishRequest(
        target_system="file",
        category="VPN",
        visibility="internal",
        user_id="admin@example.com"
    )
)
# result.published_url = "file:///kb/published/VPN/KB-A1B2C3D4-vpn-connection.md"
```

### 5. Audit-Trail

Alle Aktionen werden geloggt:
```python
audit.log_event(
    draft_id=draft_id,
    event_type=KBAAuditEventType.DRAFT_GENERATED,
    user_id="admin@example.com",
    details={
        "ticket_id": "...",
        "generation_time_ms": 2847,
        "guidelines_used": ["system", "VPN"]
    }
)
```

**Retrievable via API:**
```bash
GET /api/kba/drafts/{draft_id}/audit
```

## API-Endpoints

| Endpoint | Methode | Zweck |
|----------|---------|-------|
| `/api/kba/health` | GET | Ollama-Status prüfen |
| `/api/kba/drafts` | POST | KBA generieren |
| `/api/kba/drafts` | GET | Drafts auflisten (mit Filtern) |
| `/api/kba/drafts/{id}` | GET | Draft abrufen |
| `/api/kba/drafts/{id}` | PATCH | Draft editieren |
| `/api/kba/drafts/{id}/publish` | POST | Draft veröffentlichen |
| `/api/kba/drafts/{id}/audit` | GET | Audit-Trail abrufen |
| `/api/kba/guidelines` | GET | Alle Guidelines auflisten |
| `/api/kba/guidelines/{category}` | GET | Guideline abrufen |

## Konfiguration

### Ollama

```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT=60
```

**Supported Models:**
- `llama3.2:1b` - Schnell, 1GB RAM (~2s Generation)
- `llama3.2:3b` - Balanced, 3GB RAM (~5s)
- `llama3.1:8b` - Beste Qualität, 8GB RAM (~10s)

### Knowledge Base

```bash
# .env
KB_FILE_BASE_PATH=./kb_published
KB_FILE_CREATE_CATEGORIES=true
```

### Guidelines

```bash
# .env
GUIDELINES_PATH=./docs/kba_guidelines
```

## Testing

### Unit Tests (Backend)

```bash
# Alle KBA Tests
pytest backend/tests/test_kba_publishing.py -v

# Structured Output Parser Tests
pytest backend/tests/test_ollama_structured_output.py -v

# Combined
pytest backend/tests/test_kba*.py backend/tests/test_ollama*.py -v
```

**Coverage:** 45/45 Tests ✅

### E2E Tests (Frontend)

```bash
# Playwright E2E
npm run test:e2e
```

## Limitation & Known Issues

### MVP-Phase

- ☑️ **Nur FileSystem-Adapter produktiv** (SharePoint/ITSM/Confluence sind Stubs)
- ☑️ **Keine Rechteprüfung** (TODO: Integration mit Auth-System)
- ☑️ **Keine Versionierung** von publizierten KBAs
- ☑️ **Kein Un-publish** (einmal publiziert = permanent)
- ☑️ **Single-User** (keine Concurrent-Editing-Locks)
- ☑️ **Deutsch-only** (Guidelines sind auf DE optimiert)

### Technische Constraints

- **LLM lokal:** Ollama muss installiert und laufend sein
- **CSV-Format:** Erwartet BMC Remedy ITSM Export-Format
- **UUID-Pflicht:** Tickets müssen UUID als ID haben
- **Synchrone Generation:** UI blockiert während LLM-Generierung (~2-5s)

## Performance

### Benchmarks (llama3.2:1b auf 8-Core CPU)

| Operation | Durchschnitt | P95 |
|-----------|-------------|-----|
| Draft-Generierung | 2.8s | 5.2s |
| Draft-Speichern | 15ms | 35ms |
| Draft-Laden | 8ms | 20ms |
| Publishing (FileSystem) | 25ms | 60ms |
| Guidelines-Loading | 120ms | 200ms |

## Roadmap

### Phase 2 (Q2 2026)
- [ ] SharePoint Adapter (Microsoft Graph API)
- [ ] ITSM/ServiceNow Adapter
- [ ] Rechtemanagement (kba.generate, kba.publish)
- [ ] Versionierung (KBA-History)
- [ ] Un-publish Funktion

### Phase 3 (Q3 2026)
- [ ] Mehrsprachigkeit (EN, FR)
- [ ] Bulk-Publishing
- [ ] Auto-Update bei Ticket-Änderungen
- [ ] Quality-Scoring (LLM-Confidence-Metriken)
- [ ] A/B-Testing verschiedener Prompts

### Future
- [ ] Confluence Adapter
- [ ] Realtime Collaborative Editing
- [ ] Approval Workflows
- [ ] Template System
- [ ] Analytics Dashboard

## Quick Links

- **[Quick Start Guide](KBA_DRAFTER_QUICKSTART.md)** - Schnellste Installation
- **[Technical Documentation](KBA_DRAFTER.md)** - Vollständige Architektur
- **[Publishing Guide](KBA_PUBLISHING.md)** - Publishing-Details
- **[Implementation Notes](KBA_DRAFTER_IMPLEMENTATION.md)** - Entwickler-Notizen
- **[Main README](../README.md)** - Repo-Overview

## Support & Contribution

### Häufige Fragen

**Q: Ollama startet nicht?**  
A: Prüfe `ollama serve` und Port 11434. Siehe [Troubleshooting](../docs/TROUBLESHOOTING.md)

**Q: KBA-Qualität schlecht?**  
A: Guidelines anpassen in `docs/kba_guidelines/`. Test mit `ollama run llama3.2:1b`

**Q: Wie füge ich einen neuen KB-Adapter hinzu?**  
A: Siehe [KBA_PUBLISHING.md](KBA_PUBLISHING.md) Sektion "Erweiterung: Neue Adapter"

**Q: Kann ich GPT-4 statt Ollama verwenden?**  
A: Ja, erstelle `OpenAIService` analog zu `OllamaService`. API-Kompatibel.

### Development

```bash
# Backend Tests
pytest backend/tests/test_kba*.py -v

# Type Checking
mypy backend/kba_service.py

# Linting
ruff check backend/kba*.py

# Frontend Tests
cd frontend && npm test
```

## License & Credits

Part of the **python-quart-vite-react** teaching repository.

- **LLM:** Ollama (Meta's Llama 3.2)
- **Backend:** Quart, Pydantic, SQLModel
- **Frontend:** React, FluentUI v9
- **Architecture:** "Grokking Simplicity" + "A Philosophy of Software Design"

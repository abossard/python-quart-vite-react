---
title: KBA Guidelines System Documentation
version: 1.0.0
last_updated: 2026-03-03
---

# KBA Guidelines System Dokumentation

Dieses Dokument erklärt vollständig, wie der KBA Drafter funktioniert, wie Guidelines geladen werden, und wie Sie das System anpassen können.

## 📚 Inhaltsverzeichnis

- [Überblick](#überblick)
- [Kompletter Ablauf](#kompletter-ablauf)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Auto-Detection System](#auto-detection-system)
- [Bestehende Guidelines](#bestehende-guidelines)
- [Neue Guidelines hinzufügen](#neue-guidelines-hinzufügen)
- [Anpassungen vornehmen](#anpassungen-vornehmen)
- [Ticket-Beispiele](#ticket-beispiele)
- [Testing](#testing)
- [Konfiguration](#konfiguration)
- [Verwandte Dokumentation](#verwandte-dokumentation)

---

## Überblick

### Was ist der KBA Drafter?

Der KBA Drafter ist ein **LLM-basiertes System**, das automatisch Knowledge Base Articles (KBAs) aus bestehenden Support-Tickets generiert. Er nutzt OpenAI's strukturierte Output-Funktion in Kombination mit maßgeschneiderten Guidelines, um qualitativ hochwertige, standardisierte Lösungsdokumentationen zu erstellen.

### Rolle der Guidelines

Guidelines sind **Markdown-Dateien**, die dem LLM (Large Language Model) präzise Anweisungen geben:

- **System Guidelines** (immer geladen): Definieren Struktur, Schreibstil, Qualitätskriterien
- **Category Guidelines** (kontextabhängig): Spezifische Regeln für VPN, Netzwerk, Passwort-Reset, etc.

Der LLM erhält diese Guidelines als Kontext und generiert KBAs, die den definierten Standards entsprechen.

### Warum Guidelines wichtig sind

✅ **Konsistenz**: Alle KBAs folgen dem gleichen Format und Schreibstil  
✅ **Qualität**: Klare Validierungsregeln verhindern vage oder unvollständige Artikel  
✅ **Spezialisierung**: Kategorie-spezifische Guidelines für VPN vs. Passwort-Reset  
✅ **Anpassbarkeit**: Einfach neue Guidelines hinzufügen ohne Code zu ändern  

---

## Kompletter Ablauf

### 🔄 Flow-Diagramm: API → LLM → Output

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                                 │
│    Frontend: POST /api/kba/drafts { ticket_id, categories? }   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. API LAYER (backend/app.py)                                   │
│    - Empfängt Request                                           │
│    - Validiert Input (KBADraftCreate)                           │
│    - Ruft Operation auf                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SERVICE LAYER (backend/kba_service.py)                       │
│    generate_draft():                                            │
│    ├─ Lädt Ticket aus CSV (csv_data.py)                        │
│    ├─ Prüft auf Duplikate                                      │
│    ├─ Detektiert passende Guidelines ────────┐                 │
│    ├─ Baut LLM-Prompt                        │                 │
│    ├─ Ruft LLM auf                           │                 │
│    ├─ Validiert Output                       │                 │
│    ├─ Speichert in Datenbank                 │                 │
│    └─ Erstellt Audit-Log                     │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                         ┌──────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. GUIDELINES LOADER (backend/guidelines_loader.py)             │
│    detect_categories_from_ticket():                             │
│    ├─ Liest operational_category_tier1 + tier2                 │
│    ├─ Sucht in CATEGORY_MAP                                     │
│    ├─ Keyword-Matching im Summary (Fallback)                   │
│    └─ Lädt .md-Dateien aus docs/kba_guidelines/                │
│                                                                 │
│    Geladene Guidelines:                                         │
│    ├─ system/*.md (5 Dateien, immer)                           │
│    └─ categories/*.md (auto-detektiert)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PROMPT BUILDER (backend/kba_prompts.py)                      │
│    build_kba_prompt():                                          │
│    ├─ Kombiniert System-Rolle + Guidelines                     │
│    ├─ Fügt Ticket-Daten ein (Summary, Notes, Resolution)       │
│    └─ Hängt Output-Schema an                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. LLM SERVICE (backend/llm_service.py)                         │
│    structured_chat():                                           │
│    ├─ OpenAI API Call: beta.chat.completions.parse()           │
│    ├─ Model: gpt-4o-mini oder gpt-4o                           │
│    ├─ Native Pydantic Parsing                                  │
│    └─ Timeout: 60s default                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. OUTPUT VALIDATION (backend/kba_output_models.py)             │
│    KBAOutputSchema (Pydantic):                                  │
│    ├─ Validiert Feldlängen                                     │
│    ├─ Prüft Tag-Format                                         │
│    ├─ Validiert Ticket-ID-Format                               │
│    └─ Konvertiert zu KBADraft                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. DATABASE & AUDIT (backend/kba_service.py, kba_audit.py)     │
│    ├─ Speichert KBADraft in SQLite                             │
│    ├─ Status: 'draft'                                          │
│    ├─ Metadata: llm_model, generation_time_ms                  │
│    └─ Audit-Event: draft_generated                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. API RESPONSE                                                 │
│    → Frontend erhält KBADraft mit ID                            │
│    → User kann Draft bearbeiten → reviewed → published         │
└─────────────────────────────────────────────────────────────────┘
```

### Wichtige Komponenten

| Komponente | Datei | Verantwortung |
|------------|-------|---------------|
| **API Layer** | `backend/app.py` | REST Endpoints (10 KBA Routes) |
| **Operations** | `backend/operations.py` | DTO-Validierung, DB-Session |
| **KBA Service** | `backend/kba_service.py` | Hauptorchestrator, Business Logic |
| **Guidelines Loader** | `backend/guidelines_loader.py` | Auto-Detection, Guidelines laden |
| **Prompt Builder** | `backend/kba_prompts.py` | LLM-Prompt konstruieren |
| **LLM Service** | `backend/llm_service.py` | OpenAI API Client |
| **Output Models** | `backend/kba_output_models.py` | Pydantic Schema, Validierung |
| **Audit Service** | `backend/kba_audit.py` | Event-Logging |

---

## Verzeichnisstruktur

```
docs/kba_guidelines/
├── README.md                    # Diese Datei
│
├── system/                      # System Guidelines (IMMER geladen)
│   ├── 00_system_role.md       # LLM Persona & Grundprinzipien
│   ├── 10_kba_structure.md     # Feldformat & Struktur
│   ├── 20_writing_style.md     # Sprache & Ton
│   ├── 30_quality_checks.md    # Validierungskriterien
│   └── 40_publish_rules.md     # Workflow & Status-Lifecycle
│
└── categories/                  # Category Guidelines (AUTO-DETEKTIERT)
    ├── GENERAL.md              # Basis-Regeln (immer dabei)
    ├── VPN.md                  # VPN-spezifische Regeln
    ├── NETWORK.md              # Netzwerk-Probleme
    └── PASSWORD_RESET.md       # Passwort/Account-Probleme
```

### Frontmatter-Format

Jede Guideline-Datei beginnt mit YAML Frontmatter:

```yaml
---
title: "System Role & Persona"
version: 1.0.0
enabled: true        # true/false: Guideline aktivieren/deaktivieren
priority: 0          # Laderreihenfolge (niedrigere = früher)
---
```

### Laderreihenfolge

**System Guidelines**: Alphabetisch nach Dateinamen (00, 10, 20, 30, 40)  
**Category Guidelines**: Alphabetisch nach Dateinamen

Der kombinierte Kontext wird so an das LLM übergeben:

```
# SYSTEM GUIDELINES

[Inhalt von 00_system_role.md]
[Inhalt von 10_kba_structure.md]
[...]

================================================================================

# CATEGORY-SPECIFIC GUIDELINES

[Inhalt von GENERAL.md]
[Inhalt von VPN.md]  # Nur wenn detektiert
[...]
```

---

## Auto-Detection System

### Das CATEGORY_MAP

Die automatische Guideline-Auswahl basiert auf dem **CATEGORY_MAP** in [`backend/guidelines_loader.py`](../../backend/guidelines_loader.py#L44-L63):

```python
CATEGORY_MAP = {
    "Network Access": {
        "VPN": "VPN",                    # → VPN.md
        "WiFi": "NETWORK",               # → NETWORK.md
        "LAN": "NETWORK",                # → NETWORK.md
        "Remote Access": "VPN",          # → VPN.md
    },
    "Security": {
        "Password Reset": "PASSWORD_RESET",      # → PASSWORD_RESET.md
        "Account Locked": "PASSWORD_RESET",      # → PASSWORD_RESET.md
        "Account Management": "PASSWORD_RESET",  # → PASSWORD_RESET.md
    },
    "Network": {
        "Internet": "NETWORK",           # → NETWORK.md
        "WLAN": "NETWORK",               # → NETWORK.md
        "Ethernet": "NETWORK",           # → NETWORK.md
        "DNS": "NETWORK",                # → NETWORK.md
    },
    # Add more mappings as needed
}
```

### Detection-Logik

Die Funktion `detect_categories_from_ticket()` folgt diesem Algorithmus:

```python
def detect_categories_from_ticket(ticket: Ticket) -> list[str]:
    categories = ["GENERAL"]  # IMMER dabei!
    
    # 1. CSV-Felder prüfen
    tier1 = ticket.operational_category_tier1  # z.B. "Network Access"
    tier2 = ticket.operational_category_tier2  # z.B. "VPN"
    
    # 2. CATEGORY_MAP lookup
    if tier1 in CATEGORY_MAP:
        if tier2 in CATEGORY_MAP[tier1]:
            guideline = CATEGORY_MAP[tier1][tier2]
            categories.append(guideline)  # → ["GENERAL", "VPN"]
    
    # 3. Keyword-Fallback im Summary
    summary = ticket.summary.lower()
    
    if "vpn" in summary and "VPN" not in categories:
        categories.append("VPN")
    
    if any(word in summary for word in ["password", "passwort", "kennwort"]):
        if "PASSWORD_RESET" not in categories:
            categories.append("PASSWORD_RESET")
    
    if any(word in summary for word in ["network", "netzwerk", "wifi"]):
        if "NETWORK" not in categories:
            categories.append("NETWORK")
    
    return categories
```

### Datenquelle: CSV

Die Ticket-Daten stammen aus [`CSV/data.csv`](../../CSV/data.csv), einem BMC Remedy/ITSM-Export:

**Relevante Spalten:**
- `Incident ID*+`: Eindeutige Ticket-ID (z.B. INC000016300803)
- `Summary*`: Kurzbeschreibung des Problems
- `Notes`: Detaillierte Notizen
- `Resolution`: Lösungsbeschreibung
- `Operational Categorization Tier 1+`: Hauptkategorie (z.B. "Network Access")
- `Operational Categorization Tier 2`: Unterkategorie (z.B. "VPN")
- `Status*`: New/Assigned/In Progress/Resolved/Closed
- `Priority*`: 1-Critical, 2-High, 3-Medium, 4-Low

### Entscheidungsbaum: Beispiel

```
Ticket: INC000016300803
├─ Summary: "VPN-Verbindung schlägt fehl mit Timeout"
├─ Tier1: "Network Access"
├─ Tier2: "VPN"
│
└─ Detection:
   ├─ Step 1: GENERAL hinzufügen ✓
   ├─ Step 2: CATEGORY_MAP["Network Access"]["VPN"] → "VPN" ✓
   ├─ Step 3: Keyword "vpn" in summary → Bereits hinzugefügt
   │
   └─ Final: ["GENERAL", "VPN"]
```

**Alternative:** Wenn Tier2 fehlt oder nicht im Mapping:

```
Ticket: INC000099999999
├─ Summary: "Kann mein Passwort nicht zurücksetzen"
├─ Tier1: "IT Support"  # Nicht im CATEGORY_MAP
├─ Tier2: ""
│
└─ Detection:
   ├─ Step 1: GENERAL hinzufügen ✓
   ├─ Step 2: CATEGORY_MAP lookup → Kein Match ✗
   ├─ Step 3: Keyword "passwort" in summary → "PASSWORD_RESET" ✓
   │
   └─ Final: ["GENERAL", "PASSWORD_RESET"]
```

---

## Bestehende Guidelines

### System Guidelines (5 Dateien)

#### 1. [00_system_role.md](system/00_system_role.md)
**Zweck:** LLM Persona & Grundprinzipien

**Inhalte:**
- Rolle: Technischer Redakteur für IT-Support-KBAs
- Aufgabe: Strukturierte Dokumentation aus Ticket-Daten
- Constraints: Keine Halluzinationen, nur Ticket-Fakten verwenden
- Ton: Neutral, faktisch, Schweizer Hochdeutsch

**Wann bearbeiten:** Wenn Sie die Grundphilosophie oder Sprache des Drafters ändern wollen

---

#### 2. [10_kba_structure.md](system/10_kba_structure.md)
**Zweck:** Feldformat & Struktur-Anforderungen

**Inhalte:**
- `title`: 10-150 Zeichen, SEO-optimiert, beschreibend
- `symptoms`: Array von beobachtbaren Fehlern/Symptomen
- `resolution_steps`: 1-15 konkrete, actionable Steps
- `tags`: 1-10 lowercase Keywords mit Bindestrichen
- `cause`: Optional, Root-Cause-Analyse
- `validation_checks`: Kritische Blocker vs. Warnings

**Wann bearbeiten:** Wenn Sie Feldlängen oder Anzahl-Constraints anpassen wollen

---

#### 3. [20_writing_style.md](system/20_writing_style.md)
**Zweck:** Sprache & Ton-Regeln

**Inhalte:**
- Imperativ-Verben, aktive Stimme
- Kurze Sätze, konkrete Anweisungen
- Deutsch (Schweizer Hochdeutsch bevorzugt)
- Vermeidung von Fachjargon ohne Erklärung
- Screenshots/Verweise auf Anhänge

**Wann bearbeiten:** Wenn Sie den Schreibstil oder Sprachpräferenzen ändern wollen

---

#### 4. [30_quality_checks.md](system/30_quality_checks.md)
**Zweck:** Validierungskriterien

**Inhalte:**
- **Kritische Blocker**: Fehlende Pflichtfelder, Halluzinationen, vage Titel
- **Warnings**: Unvollständige Infos, ungeprüfte Lösungen, fehlende Tags
- Qualitätsschwellen für Veröffentlichung

**Wann bearbeiten:** Wenn Sie strengere/lockerere Validierung wollen

---

#### 5. [40_publish_rules.md](system/40_publish_rules.md)
**Zweck:** Workflow & Status-Lifecycle

**Inhalte:**
- Status-Übergang: `draft` → `reviewed` → `published`
- Publikation nur nach manuellem Review
- Versionierung bei Änderungen
- Archivierung veralteter KBAs

**Wann bearbeiten:** Wenn Sie den Workflow oder Publishing-Prozess ändern wollen

---

### Category Guidelines (4 Dateien)

#### 1. [GENERAL.md](categories/GENERAL.md)
**Zweck:** Universelle KBA-Struktur-Regeln

**Inhalt:**
- Anwendbar auf alle Ticket-Typen
- Allgemeine Best Practices
- Standardformat-Anforderungen

**Wann geladen:** IMMER (in jeder KBA-Generierung)

---

#### 2. [VPN.md](categories/VPN.md)
**Zweck:** VPN-spezifische Diagnostik & Troubleshooting

**Inhalt:**
- Häufige VPN-Fehler (Timeout, Authentication Failed, etc.)
- Diagnostik-Schritte (Netzwerk prüfen, Credentials verifizieren)
- VPN-Client-spezifische Anleitungen
- Firewall/Proxy-Checks

**Wann geladen:** 
- Tier1="Network Access" + Tier2="VPN"
- ODER Keyword "vpn" im Summary

---

#### 3. [NETWORK.md](categories/NETWORK.md)
**Zweck:** Netzwerk-Konnektivitätsprobleme

**Inhalt:**
- DNS-Probleme
- WLAN/LAN-Konnektivität
- Internet-Zugang
- Router/Switch-Diagnostik

**Wann geladen:**
- Tier1="Network" + Tier2="Internet/WLAN/DNS"
- Tier1="Network Access" + Tier2="WiFi/LAN"
- ODER Keywords "network", "netzwerk", "wifi", "internet" im Summary

---

#### 4. [PASSWORD_RESET.md](categories/PASSWORD_RESET.md)
**Zweck:** Passwort/Account-Prozeduren

**Inhalt:**
- Self-Service-Portal-Anleitung
- Account-Unlock-Prozess
- Passwort-Reset-Workflows
- Security-Fragen

**Wann geladen:**
- Tier1="Security" + Tier2="Password Reset/Account Locked"
- ODER Keywords "password", "passwort", "kennwort" im Summary

---

## Neue Guidelines hinzufügen

### Schritt-für-Schritt: Email-Kategorie hinzufügen

Angenommen, Sie möchten eine neue Guideline für **Email-Probleme** (Outlook, Exchange) hinzufügen:

#### 1. Guideline-Datei erstellen

Erstellen Sie `docs/kba_guidelines/categories/EMAIL.md`:

```markdown
---
title: Email & Outlook Guidelines
version: 1.0.0
enabled: true
priority: 20
---

# Email-spezifische KBA-Guidelines

## Typische Email-Probleme

1. **Kann keine Emails senden**
   - SMTP-Verbindungsprobleme
   - Authentifizierung fehlgeschlagen
   - Postfachgröße überschritten

2. **Kann keine Emails empfangen**
   - IMAP/POP3-Verbindung
   - Postfach voll
   - Filterregeln

3. **Outlook startet nicht**
   - Profilkorruption
   - Add-In-Konflikte
   - OST-Datei beschädigt

## Diagnostik-Schritte

### Verbindung prüfen
1. Outlook-Verbindungsstatus öffnen
2. SMTP/IMAP-Server-Einstellungen verifizieren
3. Netzwerk-Konnektivität testen

### Profil überprüfen
1. Outlook-Profil im Safe Mode starten
2. Neues Profil erstellen (Test)
3. OST-Datei neu synchronisieren

## Resolution-Struktur

**Symptoms:**
- Fehlercode angeben (z.B. 0x80040115)
- Fehlermeldung wörtlich zitieren

**Resolution Steps:**
1. Outlook schließen
2. Control Panel > Mail > Profile
3. [Spezifische Schritte...]

**Tags:**
- Immer: `outlook`, `email`
- Optional: `smtp`, `imap`, `exchange`, `ost-datei`

## Warnings

⚠️ Warnung ausgeben wenn:
- OST-Datei gelöscht werden soll (Datenverlust-Risiko)
- Profil gelöscht wird ohne Backup
- Exchange-Server-Änderungen erforderlich sind
```

#### 2. CATEGORY_MAP erweitern

Bearbeiten Sie [`backend/guidelines_loader.py`](../../backend/guidelines_loader.py#L44):

```python
CATEGORY_MAP = {
    # ... existing entries ...
    
    # NEU: Email-Kategorie hinzufügen
    "Email": {
        "Outlook": "EMAIL",
        "Exchange": "EMAIL",
        "Thunderbird": "EMAIL",
    },
    
    # Oder zu bestehender Kategorie hinzufügen
    "Software": {
        "Outlook": "EMAIL",
        "Office 365": "EMAIL",
    },
}
```

#### 3. (Optional) Keyword-Fallback hinzufügen

In [`backend/guidelines_loader.py`](../../backend/guidelines_loader.py#L335-L350), ergänzen Sie:

```python
# In detect_categories_from_ticket()
summary_lower = ticket.summary.lower()

# ... existing keywords ...

# NEU: Email-Keywords
if any(word in summary_lower for word in ["outlook", "email", "e-mail", "exchange"]):
    if "EMAIL" not in categories:
        categories.append("EMAIL")
        logger.debug("Added EMAIL category from summary")
```

#### 4. Service neu starten

```bash
# Backend neu starten (falls läuft)
# Strg+C im Terminal, dann:
cd /home/cp000350/python-quart-vite-react
source .venv/bin/activate
./start-dev.sh
```

#### 5. Testen

Testen Sie mit einem Email-Ticket:

```bash
# Im Backend-Ordner
cd backend
python -c "
from tickets import Ticket
from guidelines_loader import get_guidelines_loader

# Test-Ticket erstellen
ticket = Ticket(
    id='INC000099999999',
    summary='Outlook startet nicht mit Fehlercode 0x80040115',
    operational_category_tier1='Email',
    operational_category_tier2='Outlook',
    # ... andere Felder ...
)

# Guidelines detektieren
loader = get_guidelines_loader()
categories = loader.detect_categories_from_ticket(ticket)
print(f'Detected categories: {categories}')
# Erwartung: ['GENERAL', 'EMAIL']
"
```

---

## Anpassungen vornehmen

### 1. LLM-Parameter ändern

#### Model wechseln (höhere Qualität)

**Environment Variable** (`.env`):
```bash
# Von gpt-4o-mini (schneller, günstiger)
OPENAI_MODEL=gpt-4o-mini

# Zu gpt-4o (höhere Qualität, teurer)
OPENAI_MODEL=gpt-4o
```

#### Timeout erhöhen

**Code** ([`backend/llm_service.py`](../../backend/llm_service.py#L58)):
```python
# Von 60s zu 120s
response = await self.client.beta.chat.completions.parse(
    model=self.model,
    messages=messages,
    response_format=output_schema,
    timeout=120,  # Erhöht von 60
)
```

---

### 2. Output-Schema anpassen

#### Neues Feld hinzufügen

**Datei:** [`backend/kba_output_models.py`](../../backend/kba_output_models.py#L15)

```python
class KBAOutputSchema(BaseModel):
    # ... existing fields ...
    
    # NEU: Severity-Level hinzufügen
    severity: Optional[str] = Field(
        default=None,
        description="Schweregrad: low, medium, high, critical"
    )
    
    # NEU: Affected Systems
    affected_systems: Optional[list[str]] = Field(
        default=None,
        description="Betroffene Systeme/Services"
    )
    
    # Validator für Severity
    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["low", "medium", "high", "critical"]
        if v.lower() not in allowed:
            raise ValueError(f"Severity must be one of {allowed}")
        return v.lower()
```

**Wichtig:** Nach Schema-Änderung auch [`backend/kba_models.py`](../../backend/kba_models.py) anpassen, um neue Felder in DB zu speichern!

---

### 3. Feld-Constraints ändern

#### Beispiel: Längere Titel erlauben

**Datei:** [`backend/kba_output_models.py`](../../backend/kba_output_models.py)

```python
# Von 10-150
title: str = Field(
    min_length=10,
    max_length=150,
    description="..."
)

# Zu 20-300
title: str = Field(
    min_length=20,   # Erhöht von 10
    max_length=300,  # Erhöht von 150
    description="..."
)
```

**Vergessen Sie nicht**, auch [`system/10_kba_structure.md`](system/10_kba_structure.md) zu aktualisieren!

---

### 4. Prompt-Engineering anpassen

#### Zusätzliche Anweisungen hinzufügen

**Datei:** [`backend/kba_prompts.py`](../../backend/kba_prompts.py#L18)

```python
def build_kba_prompt(
    ticket: Ticket,
    guidelines: str,
    schema: type[BaseModel]
) -> list[dict]:
    
    # ... existing code ...
    
    # NEU: Zusätzliche Anweisungen
    custom_instructions = """
    WICHTIG:
    - Fokussiere auf präventive Maßnahmen
    - Erwähne immer Security-Implications
    - Füge Links zu internen KB-Artikeln hinzu (wenn im Ticket vorhanden)
    """
    
    system_message = f"""
{guidelines}

{custom_instructions}

## OUTPUT SCHEMA
{schema_str}
"""
```

---

### 5. Guideline-Gewichtung ändern

#### Priorität anpassen

**Frontmatter** in Guideline-Datei:

```yaml
---
title: "VPN Guidelines"
version: 1.0.0
enabled: true
priority: 5  # Niedriger = früher geladen, höher gewichtet
---
```

**Effekt:** Guidelines mit niedrigerer Priorität werden früher im Kontext platziert und haben mehr Einfluss auf das LLM.

---

### 6. Guideline temporär deaktivieren

```yaml
---
title: "Network Guidelines"
version: 1.0.0
enabled: false  # Deaktiviert
---
```

**Nutzung beim Testen:** Neue Guideline isoliert testen ohne andere zu beeinflussen.

---

## Ticket-Beispiele

### Beispiel 1: VPN-Problem

**CSV-Daten:**
```csv
Incident ID: INC000016300803
Summary: VPN-Verbindung schlägt fehl mit Timeout-Fehler
Operational Categorization Tier 1: Network Access
Operational Categorization Tier 2: VPN
Status: Resolved
Priority: 2-High
Resolution: VPN-Client neu installiert, Firewall-Regel angepasst
```

**Auto-Detection:**
1. GENERAL ✓ (immer)
2. CATEGORY_MAP["Network Access"]["VPN"] → VPN ✓
3. Keyword "vpn" in summary → Bereits vorhanden

**Geladene Guidelines:** `["GENERAL", "VPN"]`

**Generierter KBA:**
```json
{
  "title": "VPN-Verbindung schlägt fehl mit Timeout-Fehler",
  "symptoms": [
    "VPN-Client zeigt Timeout-Fehler beim Verbindungsaufbau",
    "Keine Netzwerkverbindung zu Unternehmensressourcen"
  ],
  "resolution_steps": [
    "VPN-Client deinstallieren über Systemsteuerung",
    "Neueste Version von Corporate VPN Client herunterladen",
    "VPN-Client mit Admin-Rechten installieren",
    "Firewall-Regel für VPN-Port 443 überprüfen",
    "Verbindung mit neuen Credentials testen"
  ],
  "tags": ["vpn", "timeout", "netzwerk", "firewall"],
  "cause": "Veraltete VPN-Client-Version nicht kompatibel mit Firewall-Update"
}
```

---

### Beispiel 2: Passwort-Reset

**CSV-Daten:**
```csv
Incident ID: INC000016312744
Summary: Benutzer kann sich nicht mehr anmelden, Passwort vergessen
Operational Categorization Tier 1: Security
Operational Categorization Tier 2: Password Reset
Status: Closed
Priority: 3-Medium
Resolution: Self-Service-Portal verwendet, Passwort erfolgreich zurückgesetzt
```

**Auto-Detection:**
1. GENERAL ✓ (immer)
2. CATEGORY_MAP["Security"]["Password Reset"] → PASSWORD_RESET ✓
3. Keyword "passwort" in summary → Bereits vorhanden

**Geladene Guidelines:** `["GENERAL", "PASSWORD_RESET"]`

**Generierter KBA:**
```json
{
  "title": "Passwort vergessen: Self-Service-Portal verwenden",
  "symptoms": [
    "Login-Fehler: Ungültige Credentials",
    "Account nicht gesperrt, Passwort nicht bekannt"
  ],
  "resolution_steps": [
    "Self-Service-Portal öffnen: https://password.company.ch",
    "Corporate ID eingeben",
    "'Passwort vergessen' auswählen",
    "Sicherheitsfragen beantworten oder SMS-Code eingeben",
    "Neues Passwort gemäß Richtlinien erstellen",
    "Mit neuem Passwort anmelden"
  ],
  "tags": ["passwort", "login", "self-service", "account"],
  "preventive_measures": [
    "Passwort-Manager verwenden",
    "Zwei-Faktor-Authentifizierung aktivieren"
  ]
}
```

---

### Beispiel 3: Fallback auf Keywords

**CSV-Daten:**
```csv
Incident ID: INC000016313031
Summary: WiFi-Verbindung instabil, häufige Disconnects
Operational Categorization Tier 1: IT Support  # Nicht im CATEGORY_MAP!
Operational Categorization Tier 2: General
Status: Resolved
Priority: 4-Low
```

**Auto-Detection:**
1. GENERAL ✓ (immer)
2. CATEGORY_MAP["IT Support"] → Nicht vorhanden ✗
3. Keyword "wifi" in summary → NETWORK ✓

**Geladene Guidelines:** `["GENERAL", "NETWORK"]`

**Effekt:** Trotz fehlerhafter Kategorisierung wird die richtige Guideline geladen!

---

## Testing

### Lokaler Test-Workflow

#### 1. Guidelines validieren

```bash
# Markdown-Syntax prüfen (falls markdownlint installiert)
markdownlint docs/kba_guidelines/**/*.md

# Frontmatter validieren
python -c "
from guidelines_loader import get_guidelines_loader
loader = get_guidelines_loader()

# Alle Guidelines laden
system = loader.load_system_guidelines()
categories = loader.get_combined(['GENERAL', 'VPN'])

print(f'System guidelines: {len(system)} chars')
print(f'Category guidelines: {len(categories)} chars')
"
```

#### 2. Category-Detection testen

```bash
cd backend
python -c "
from tickets import Ticket
from guidelines_loader import get_guidelines_loader

# Test verschiedener Ticket-Typen
test_cases = [
    {'tier1': 'Network Access', 'tier2': 'VPN', 'summary': 'VPN error'},
    {'tier1': 'Security', 'tier2': 'Password Reset', 'summary': 'Cannot login'},
    {'tier1': 'Unknown', 'tier2': '', 'summary': 'WiFi not working'},
]

loader = get_guidelines_loader()

for case in test_cases:
    ticket = Ticket(id='TEST', summary=case['summary'], 
                    operational_category_tier1=case['tier1'],
                    operational_category_tier2=case['tier2'])
    categories = loader.detect_categories_from_ticket(ticket)
    print(f'{case} → {categories}')
"
```

#### 3. KBA generieren (Integration Test)

```bash
# Backend starten
./start-dev.sh

# In neuem Terminal: API-Call
curl -X POST http://localhost:5000/api/kba/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "INC000016300803",
    "categories": ["GENERAL", "VPN"]
  }'

# Response prüfen:
# - generation_time_ms < 10000 (unter 10s)?
# - Alle Pflichtfelder vorhanden?
# - Tags korrekt formatiert?
# - Keine Halluzinationen?
```

#### 4. Guideline-Effektivität prüfen

**Checkliste:**
- ✅ Generierter KBA folgt Struktur aus Guidelines?
- ✅ Spezifische Keywords aus Category-Guideline verwendet?
- ✅ Qualitäts-Checks aus `30_quality_checks.md` erfüllt?
- ✅ Schreibstil entspricht `20_writing_style.md`?

**Iteratives Tuning:**
1. KBA generieren
2. Qualität bewerten
3. Guideline anpassen
4. Neu generieren
5. Vergleichen → Repeat

---

### Unit Tests schreiben

**Datei:** `backend/tests/test_guidelines_loader.py`

```python
import pytest
from guidelines_loader import get_guidelines_loader
from tickets import Ticket

def test_email_category_detection():
    """Test neue EMAIL-Kategorie"""
    loader = get_guidelines_loader()
    
    ticket = Ticket(
        id='TEST001',
        summary='Outlook startet nicht',
        operational_category_tier1='Email',
        operational_category_tier2='Outlook',
    )
    
    categories = loader.detect_categories_from_ticket(ticket)
    
    assert 'GENERAL' in categories
    assert 'EMAIL' in categories
    assert len(categories) == 2

def test_email_keyword_fallback():
    """Test Keyword-Fallback für Email"""
    loader = get_guidelines_loader()
    
    ticket = Ticket(
        id='TEST002',
        summary='Exchange-Server antwortet nicht',
        operational_category_tier1='Unknown',
        operational_category_tier2='',
    )
    
    categories = loader.detect_categories_from_ticket(ticket)
    
    assert 'EMAIL' in categories

# Test ausführen
# pytest backend/tests/test_guidelines_loader.py::test_email_category_detection -v
```

---

## Konfiguration

### Environment Variables

**Datei:** `.env` (im Projekt-Root)

```bash
# === REQUIRED ===

# OpenAI API Key (für LLM-Generierung)
OPENAI_API_KEY=sk-proj-...

# === OPTIONAL ===

# OpenAI Model (default: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
# Alternativen: gpt-4o (höhere Qualität, teurer)

# OpenAI Base URL (für custom endpoints)
# OPENAI_BASE_URL=https://custom-openai-proxy.example.com/v1

# Database URL (SQLite default)
KBA_DATABASE_URL=sqlite:///./data/kba.db

# Log Level
LOG_LEVEL=INFO  # DEBUG für mehr Details
```

### Code-Level Settings

#### Guidelines-Verzeichnis ändern

**Datei:** [`backend/guidelines_loader.py`](../../backend/guidelines_loader.py#L66)

```python
# Default
loader = GuidelinesLoader()  # docs/kba_guidelines/

# Custom
loader = GuidelinesLoader(guidelines_dir="/path/to/custom/guidelines")
```

#### LLM-Timeout anpassen

**Datei:** [`backend/llm_service.py`](../../backend/llm_service.py)

```python
# In structured_chat()
timeout=60  # Sekunden, erhöhen bei slow responses
```

#### Duplicate-Check deaktivieren

**Datei:** [`backend/kba_service.py`](../../backend/kba_service.py#L88)

```python
# Bei API-Call
force_create=True  # Ignoriert Duplikate
```

---

## Verwandte Dokumentation

### Andere KBA-Dokumente

- **[KBA_DRAFTER_OVERVIEW.md](../KBA_DRAFTER_OVERVIEW.md)**: Architektur-Diagramm, Komponenten-Stack
- **[KBA_DRAFTER_QUICKSTART.md](../KBA_DRAFTER_QUICKSTART.md)**: Installation & OpenAI-Setup
- **[KBA_OPENAI_INTEGRATION.md](../KBA_OPENAI_INTEGRATION.md)**: OpenAI Structured Output, Pydantic-Validierung
- **[KBA_PUBLISHING.md](../KBA_PUBLISHING.md)**: Publishing-Workflow, Adapter (File, SharePoint, etc.)
- **[KBA_DRAFTER_IMPLEMENTATION.md](../KBA_DRAFTER_IMPLEMENTATION.md)**: Technische Implementation-Details

### Backend Code

- **[backend/kba_service.py](../../backend/kba_service.py)**: Hauptorchestrator, Business Logic
- **[backend/guidelines_loader.py](../../backend/guidelines_loader.py)**: Guidelines-System, Auto-Detection
- **[backend/kba_prompts.py](../../backend/kba_prompts.py)**: Prompt-Engineering
- **[backend/llm_service.py](../../backend/llm_service.py)**: OpenAI Client
- **[backend/kba_output_models.py](../../backend/kba_output_models.py)**: Pydantic Output-Schema
- **[backend/kba_models.py](../../backend/kba_models.py)**: SQLModel Database-Models

### Frontend

- **[frontend/src/features/kba-drafter/](../../frontend/src/features/kba-drafter/)**: React-Komponenten
- **API-Calls**: `api.js` → `/api/kba/...`

### Tests

- **[backend/tests/test_kba_schema.py](../../backend/tests/test_kba_schema.py)**: Schema-Validierung
- **[backend/tests/test_kba_publishing.py](../../backend/tests/test_kba_publishing.py)**: Publishing-Tests
- **[backend/tests/test_guidelines_loader.py](../../backend/tests/test_guidelines_loader.py)**: Guidelines-Tests

---

## Troubleshooting

### Problem: Guidelines werden nicht geladen

**Symptome:** KBA enthält keine kategorie-spezifischen Inhalte

**Lösungen:**
1. Prüfen Sie, ob Guideline-Datei existiert: `ls docs/kba_guidelines/categories/`
2. Frontmatter `enabled: true` gesetzt?
3. CATEGORY_MAP korrekt erweitert?
4. Backend neu gestartet nach Änderungen?

```bash
# Debug-Logging aktivieren
LOG_LEVEL=DEBUG ./start-dev.sh

# Guidelines-Loader testen
cd backend
python -c "from guidelines_loader import get_guidelines_loader; print(get_guidelines_loader().detect_categories_from_ticket(...))"
```

---

### Problem: LLM generiert falsche Struktur

**Symptome:** Pydantic ValidationError, fehlende Felder

**Lösungen:**
1. Prüfen Sie `system/10_kba_structure.md`: Feldformat klar definiert?
2. Output-Schema in `kba_output_models.py` zu strikt?
3. LLM-Model zu schwach? → Wechsel zu `gpt-4o`
4. Prompt zu lang? → Guidelines kürzen

```bash
# Prompt-Länge prüfen
cd backend
python -c "
from guidelines_loader import get_guidelines_loader
loader = get_guidelines_loader()
context = loader.get_full_context(ticket)
print(f'Prompt length: {len(context)} chars')
# Empfohlen: < 10000 chars für gpt-4o-mini
"
```

---

### Problem: Falsche Kategorie detektiert

**Symptome:** VPN-Ticket bekommt NETWORK-Guideline

**Lösungen:**
1. CSV-Daten prüfen: `Operational Categorization Tier 1/2` korrekt?
2. CATEGORY_MAP erweitern für fehlende Mappings
3. Keyword-Fallback verbessern in `detect_categories_from_ticket()`

```python
# Debug: Welche Categories werden detektiert?
cd backend
python -c "
from csv_data import get_csv_service
from guidelines_loader import get_guidelines_loader

csv = get_csv_service()
ticket = csv.get_ticket_by_incident_id('INC000016300803')

loader = get_guidelines_loader()
categories = loader.detect_categories_from_ticket(ticket)

print(f'Ticket: {ticket.summary}')
print(f'Tier1: {ticket.operational_category_tier1}')
print(f'Tier2: {ticket.operational_category_tier2}')
print(f'Detected: {categories}')
"
```

---

## FAQ

**Q: Kann ich Guidelines in anderen Sprachen schreiben?**  
A: Ja! Das LLM passt sich der Guideline-Sprache an. Ändern Sie `20_writing_style.md` entsprechend.

**Q: Wie viele Guidelines kann ich laden?**  
A: LLM-Context-Limit: ~128k tokens (gpt-4o). Empfehlung: Max. 10 Guidelines, < 50k chars total.

**Q: Kann ich Guidelines dynamisch zur Laufzeit ändern?**  
A: Ja, aber Backend-Neustart erforderlich. Singleton-Cache leert sich nicht automatisch.

**Q: Unterstützt das System mehrere CSV-Quellen?**  
A: Aktuell nur eine CSV. Erweiterung möglich in `csv_data.py` → `CSVService`.

**Q: Kann ich eigene Felder im Output-Schema hinzufügen?**  
A: Ja! `kba_output_models.py` anpassen + `kba_models.py` für DB-Persistenz erweitern.

---

## Changelog

| Version | Datum | Änderungen |
|---------|-------|-----------|
| 1.0.0 | 2026-03-03 | Vollständige Dokumentation mit Flow, Auto-Detection, Customization |

---

## Lizenz & Support

Dieses Projekt ist eine **Lernumgebung** für CSV-Ticketdaten-Verarbeitung.

**Support:**
- Issues: GitHub Issues (falls Repository vorhanden)
- Docs: Siehe [Verwandte Dokumentation](#verwandte-dokumentation)

**Beiträge:**
- Neue Guidelines: Pull Request mit `.md`-Datei + CATEGORY_MAP-Update
- Bug Reports: Mit Log-Output und Test-Case

---

**Happy KBA Drafting! 🚀**

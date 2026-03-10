---
title: KBA Learning Mechanism - Implementation Plan
version: 1.0.0
status: Planned (Not Implemented)
last_updated: 2026-03-03
---

# KBA Learning Mechanism - Implementierungsplan

Dieses Dokument beschreibt ein vollständiges Learning-System für den KBA Drafter, das kontinuierlich aus User-Feedback und Nutzungsmustern lernt, um die Guidelines automatisch zu verbessern.

## 🎯 Ziel

**Aktueller Zustand:** Der KBA Drafter generiert KBAs basierend auf statischen Guidelines. Es gibt KEIN Feedback-System und KEINE automatische Verbesserung.

**Geplanter Zustand:** Ein Learning-Loop, der:
- ✅ User-Ratings erfasst (1-5 Sterne)
- ✅ Menschliche Edits analysiert (Was wird häufig korrigiert?)
- ✅ Patterns erkennt ("80% der VPN-Drafts erhalten manuell Step X")
- ✅ Guidelines semi-automatisch verbessert (mit manueller Review)
- ✅ Effektivität misst (Ratings vor/nach Guideline-Update)

---

## 📊 Aktueller Zustand (Research-Findings)

### Was existiert bereits?

✅ **Audit-Trail** (backend/kba_audit.py)
- Lifecycle-Events: DRAFT_GENERATED, DRAFT_EDITED, DRAFT_PUBLISHED
- details JSON-Feld für Metadata

✅ **Status-Workflow** (backend/kba_models.py)
- draft → reviewed → published

✅ **Modifizierbare Guidelines**
- Markdown-Dateien in docs/kba_guidelines/
- Frontmatter-Support für Metadata

### Was fehlt?

❌ **Keine User-Ratings**
- Kein user_rating Feld in KBADraft
- Keine Rating-UI im Frontend

❌ **Kein Original-Output-Tracking**
- LLM-Output wird überschrieben bei User-Edits
- Vergleich Original vs. Edited unmöglich

❌ **Keine Edit-Metriken**
- Audit-Log speichert nur geänderte Feldnamen, nicht Before/After
- Keine Diff-Berechnung
- Keine Pattern-Aggregation

❌ **Keine Analytics**
- Keine Aggregation von Quality-Metrics
- Kein Dashboard
- Keine Guideline-Effektivitäts-Messung

❌ **Keine programmatische Guideline-Updates**
- Guidelines sind nur manuell editierbar
- Kein API-Endpoint für Updates
- Kein Versioning-System

---

## 🧠 Drei Learning-Ansätze

### 1. brain.md - Manueller Learning-Accumulator

**Konzept:**
- Neue System-Guideline: docs/kba_guidelines/system/50_brain.md
- Sammelt beobachtete Patterns und Learnings
- Wird automatisch in jeden LLM-Prompt geladen
- Manuell gepflegt von Admins

**Beispiel brain.md Struktur:**

```markdown
---
title: Learning Brain
version: 1.0.0
enabled: true
priority: 50
---

# KBA Drafter Learning Brain

## Observed Patterns

### VPN Category
- Finding: 73% of VPN drafts have "Firewall-Regel prüfen" step added manually
- Source: Edit analysis, 2024-03-01 to 2024-03-07
- Action Taken: Added to VPN.md v1.2 on 2024-03-10
- Result: Manual additions dropped to 15%

### Password Reset
- Finding: Users frequently add "Wait 15 minutes" warning
- Source: 41 of 58 drafts (71%)
- Status: Pending - Review guideline update
```

**Vorteile:**
- ⚡ Sofort implementierbar (nur neue .md Datei)
- 🎯 Niedrige Komplexität
- 🧪 Kann manuell getestet werden
- 📈 Grundlage für Automatisierung

**Nachteile:**
- 👤 Erfordert manuelle Pflege
- 📊 Keine automatische Datenerfassung


---

### 2. User-Rating System - Automatisches Feedback

**Konzept:**
- User bewerten jeden KBA-Draft nach Review (1-5 Sterne)
- Optional: Kommentar für schlechte Ratings
- Ratings aggregiert nach Category/Guideline-Version
- Dashboard zeigt Quality-Trends

**Technische Implementierung:**

#### DB Schema-Änderungen (backend/kba_models.py)
```python
from sqlmodel import Field
from typing import Optional
from datetime import datetime

class KBADraft(SQLModel, table=True):
    # ... existing fields ...
    user_rating: Optional[int] = Field(default=None, ge=1, le=5)
    rating_comment: Optional[str] = Field(default=None, max_length=500)
    rated_at: Optional[datetime] = Field(default=None)
    rated_by: Optional[str] = Field(default=None)
    
    # Track guideline versions used
    guidelines_version: Optional[str] = Field(default=None)  # e.g. "VPN:1.2,GENERAL:1.0"
```

#### API Endpoint (backend/app.py)
```python
@app.post("/api/kba/drafts/{draft_id}/rate", response_model=dict)
async def rate_kba_draft(
    draft_id: int,
    rating: int = Body(..., ge=1, le=5),
    comment: Optional[str] = Body(None),
    user_id: str = Body(...)
) -> dict:
    """Rate a KBA draft after review."""
    async with get_session() as session:
        draft = await session.get(KBADraft, draft_id)
        if not draft:
            raise HTTPException(404, "Draft not found")
        
        # Update rating
        draft.user_rating = rating
        draft.rating_comment = comment
        draft.rated_at = datetime.utcnow()
        draft.rated_by = user_id
        
        session.add(draft)
        await session.commit()
        
        # Log audit event
        await log_audit_event(
            event_type="DRAFT_RATED",
            draft_id=draft_id,
            user_id=user_id,
            details={"rating": rating, "comment": comment}
        )
        
        return {"status": "success", "rating": rating}
```

#### Analytics Service (backend/kba_analytics.py - NEU)
```python
from sqlmodel import select, func
from typing import Dict, List
from datetime import datetime, timedelta

class KBAAnalytics:
    """Aggregiert Quality-Metrics für Guidelines."""
    
    async def get_category_ratings(
        self, 
        category: str, 
        days: int = 30
    ) -> Dict:
        """Durchschnitts-Rating pro Category."""
        since = datetime.utcnow() - timedelta(days=days)
        
        async with get_session() as session:
            result = await session.exec(
                select(
                    func.avg(KBADraft.user_rating).label("avg_rating"),
                    func.count(KBADraft.id).label("total_drafts"),
                    func.sum(
                        case((KBADraft.user_rating >= 4, 1), else_=0)
                    ).label("high_ratings")
                )
                .where(KBADraft.category == category)
                .where(KBADraft.rated_at >= since)
            )
            row = result.one()
            
            return {
                "category": category,
                "avg_rating": round(row.avg_rating, 2) if row.avg_rating else None,
                "total_drafts": row.total_drafts,
                "high_rating_percentage": (
                    round(row.high_ratings / row.total_drafts * 100, 1)
                    if row.total_drafts > 0 else 0
                )
            }
    
    async def get_guideline_effectiveness(
        self, 
        guideline_file: str
    ) -> Dict:
        """Vergleicht Ratings vor/nach Guideline-Update."""
        # Assumes guidelines_version field format: "VPN:1.2,GENERAL:1.0"
        async with get_session() as session:
            # Get versions of this guideline
            versions = await self._get_guideline_versions(session, guideline_file)
            
            stats = {}
            for version in versions:
                result = await session.exec(
                    select(
                        func.avg(KBADraft.user_rating).label("avg_rating"),
                        func.count(KBADraft.id).label("count")
                    )
                    .where(KBADraft.guidelines_version.contains(f"{guideline_file}:{version}"))
                )
                row = result.one()
                stats[version] = {
                    "avg_rating": round(row.avg_rating, 2) if row.avg_rating else None,
                    "sample_size": row.count
                }
            
            return {
                "guideline": guideline_file,
                "versions": stats
            }
```

#### Frontend Rating Widget (frontend/src/features/kba/RatingWidget.jsx - NEU)
```jsx
import { Rating } from '@fluentui/react-components';
import { useState } from 'react';

export function KBARatingWidget({ draftId, onRate }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    await fetch(`/api/kba/drafts/${draftId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        rating, 
        comment: comment || null,
        user_id: currentUser.id 
      })
    });
    setSubmitted(true);
    onRate?.(rating);
  };

  if (submitted) {
    return <div>✅ Danke für dein Feedback!</div>;
  }

  return (
    <div className="kba-rating-widget">
      <h4>Wie zufrieden bist du mit diesem Draft?</h4>
      <Rating 
        value={rating} 
        onChange={(e, data) => setRating(data.value)} 
        max={5} 
      />
      {rating <= 2 && (
        <textarea
          placeholder="Was könnte verbessert werden?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      <button onClick={handleSubmit} disabled={rating === 0}>
        Rating abschicken
      </button>
    </div>
  );
}
```

**Vorteile:**
- 📊 Objektive Quality-Metriken
- 🎯 Guideline-Effektivität messbar
- 🔄 Feedback-Loop automatisch

**Nachteile:**
- 🏗️ Erfordert DB/API/UI Änderungen
- 👥 Abhängig von User-Beteiligung
- ⏱️ Dauert Wochen für signifikante Daten


---

### 3. Edit-Analysis - Automatisches Pattern-Lernen

**Konzept:**
- System speichert Original-LLM-Output
- Bei User-Edit: Diff zwischen Original und Final
- Pattern-Detection: "Was wird häufig hinzugefügt/entfernt?"
- Aggregation nach Category

**Technische Implementierung:**

#### Original-Output-Tracking (backend/kba_models.py)
```python
class KBADraft(SQLModel, table=True):
    # ... existing fields ...
    
    # Store LLM original output
    original_title: Optional[str] = Field(default=None)
    original_summary: Optional[str] = Field(default=None)
    original_description: Optional[str] = Field(default=None)
    original_solution: Optional[str] = Field(default=None)
    
    # Edit metadata
    edit_count: int = Field(default=0)
    first_edited_at: Optional[datetime] = Field(default=None)
    last_edited_at: Optional[datetime] = Field(default=None)
```

#### Save Original auf Generation (backend/kba_service.py)
```python
async def generate_draft(...):
    # ... existing code ...
    
    # After LLM response
    draft = KBADraft(
        ticket_id=ticket_id,
        category=category,
        # Current fields
        title=llm_output.title,
        summary=llm_output.summary,
        description=llm_output.description,
        solution=llm_output.solution,
        # NEW: Store originals
        original_title=llm_output.title,
        original_summary=llm_output.summary,
        original_description=llm_output.description,
        original_solution=llm_output.solution,
    )
    
    return draft
```

#### Update mit Diff-Tracking (backend/kba_service.py)
```python
import difflib
from typing import List, Dict

async def update_draft(draft_id: int, updates: dict, user_id: str):
    """Update draft and track edits."""
    async with get_session() as session:
        draft = await session.get(KBADraft, draft_id)
        
        changed_fields = []
        edit_details = {}
        
        for field, new_value in updates.items():
            if field in ['title', 'summary', 'description', 'solution']:
                old_value = getattr(draft, field)
                original_value = getattr(draft, f"original_{field}")
                
                if old_value != new_value:
                    changed_fields.append(field)
                    
                    # Compute diff
                    diff = compute_diff(original_value, new_value)
                    edit_details[field] = {
                        "original_length": len(original_value or ""),
                        "edited_length": len(new_value or ""),
                        "diff": diff,
                        "edit_type": classify_edit(diff)
                    }
                    
                    setattr(draft, field, new_value)
        
        # Update edit metadata
        draft.edit_count += 1
        if draft.first_edited_at is None:
            draft.first_edited_at = datetime.utcnow()
        draft.last_edited_at = datetime.utcnow()
        
        session.add(draft)
        await session.commit()
        
        # Log detailed audit
        await log_audit_event(
            event_type="DRAFT_EDITED",
            draft_id=draft_id,
            user_id=user_id,
            details={
                "changed_fields": changed_fields,
                "edits": edit_details
            }
        )

def compute_diff(original: str, edited: str) -> Dict:
    """Compute semantic diff between texts."""
    differ = difflib.Differ()
    diff = list(differ.compare(original.split(), edited.split()))
    
    additions = [w[2:] for w in diff if w.startswith('+ ')]
    deletions = [w[2:] for w in diff if w.startswith('- ')]
    
    return {
        "additions": " ".join(additions),
        "deletions": " ".join(deletions),
        "addition_count": len(additions),
        "deletion_count": len(deletions)
    }

def classify_edit(diff: Dict) -> str:
    """Classify edit type."""
    if diff["addition_count"] > diff["deletion_count"] * 2:
        return "content_addition"
    elif diff["deletion_count"] > diff["addition_count"] * 2:
        return "content_removal"
    else:
        return "content_refinement"
```

#### Pattern Detection Service (backend/kba_learning.py - NEU)
```python
from collections import Counter
from sqlmodel import select
import re

class KBALearningService:
    """Detects patterns in user edits."""
    
    async def detect_common_additions(
        self, 
        category: str, 
        min_occurrences: int = 5
    ) -> List[Dict]:
        """Find frequently added text patterns."""
        async with get_session() as session:
            # Get all audit events for edits in this category
            result = await session.exec(
                select(KBAAuditLog.details)
                .join(KBADraft, KBAAuditLog.draft_id == KBADraft.id)
                .where(KBADraft.category == category)
                .where(KBAAuditLog.event_type == "DRAFT_EDITED")
            )
            
            all_additions = []
            for audit in result:
                if audit.details and 'edits' in audit.details:
                    for field, edit_info in audit.details['edits'].items():
                        if edit_info.get('edit_type') == 'content_addition':
                            # Extract meaningful phrases (3+ words)
                            additions = edit_info['diff']['additions']
                            phrases = self._extract_phrases(additions)
                            all_additions.extend(phrases)
            
            # Count frequency
            counter = Counter(all_additions)
            common = counter.most_common(20)
            
            return [
                {
                    "phrase": phrase,
                    "occurrences": count,
                    "percentage": round(count / len(all_additions) * 100, 1)
                }
                for phrase, count in common
                if count >= min_occurrences
            ]
    
    def _extract_phrases(self, text: str, min_words: int = 3) -> List[str]:
        """Extract meaningful phrases from text."""
        sentences = re.split(r'[.!?]\s+', text)
        phrases = []
        
        for sentence in sentences:
            words = sentence.strip().split()
            if len(words) >= min_words:
                # Sliding window for n-grams
                for i in range(len(words) - min_words + 1):
                    phrase = " ".join(words[i:i+min_words])
                    phrases.append(phrase.lower())
        
        return phrases
    
    async def generate_insights(self, category: str) -> Dict:
        """Generate actionable insights for a category."""
        additions = await self.detect_common_additions(category)
        
        # Find high-impact patterns
        insights = {
            "category": category,
            "timestamp": datetime.utcnow().isoformat(),
            "findings": []
        }
        
        for item in additions[:5]:  # Top 5
            if item['percentage'] > 10:  # Present in >10% of edits
                insights['findings'].append({
                    "type": "frequent_addition",
                    "text": item['phrase'],
                    "frequency": item['occurrences'],
                    "recommendation": f"Consider adding to {category}.md guideline",
                    "priority": "high" if item['percentage'] > 30 else "medium"
                })
        
        return insights
```

**Vorteile:**
- 🤖 Vollautomatisch
- 📈 Findet tatsächliche Nutzungsmuster
- 💡 Konkrete Verbesserungsvorschläge

**Nachteile:**
- 🔧 Komplexe Implementierung
- 💾 Mehr DB-Storage
- 🧪 Erfordert signifikante Datenmenge


---

## 🚀 Implementierungsplan - 5 Phasen

### Phase 1: Foundation (2-3 Tage)

**Ziel:** Basis-Infrastruktur für Learning-System

**Tasks:**
1. ✅ DB Schema erweitern (KBADraft)
   - `user_rating`, `rating_comment`, `rated_at`, `rated_by`
   - `original_title`, `original_summary`, `original_description`, `original_solution`
   - `guidelines_version`, `edit_count`, `first_edited_at`, `last_edited_at`

2. ✅ Migration schreiben
   ```bash
   alembic revision --autogenerate -m "Add learning fields to KBADraft"
   alembic upgrade head
   ```

3. ✅ Original-Output Tracking aktivieren
   - Anpassen: `backend/kba_service.py::generate_draft()`
   - Beim LLM-Call: Originals speichern

4. ✅ Audit-Log verbessern
   - Anpassen: `backend/kba_service.py::update_draft()`
   - Details erweitern: Field-Diffs speichern

**Deliverables:**
- Migration-File
- Angepasste Models
- Erweiterte Service-Funktionen

**Aufwand:** 2-3 Developer-Days

---

### Phase 2: UI & Analytics (3-4 Tage)

**Ziel:** User können Feedback geben, Admins sehen Metrics

**Tasks:**
1. ✅ Rating-Endpoint
   - `POST /api/kba/drafts/{id}/rate`
   - Validation, Persistence, Audit-Log

2. ✅ Frontend Rating-Widget
   - Component: `frontend/src/features/kba/RatingWidget.jsx`
   - Integration in KBA-Editor nach Review

3. ✅ Analytics Service
   - Datei: `backend/kba_analytics.py`
   - Funktionen:
     - `get_category_ratings(category, days=30)`
     - `get_guideline_effectiveness(guideline_file)`
     - `get_rating_trends(category, weeks=12)`

4. ✅ Analytics-Endpoints
   - `GET /api/kba/analytics/categories/{category}/ratings`
   - `GET /api/kba/analytics/guidelines/{file}/effectiveness`

5. ✅ Admin Dashboard (Optional)
   - Simple Tabellen-Ansicht
   - Charts mit recharts/nivo

**Deliverables:**
- Rating-API
- Frontend Widget
- Analytics Service
- Dashboard (Basic)

**Aufwand:** 3-4 Developer-Days

---

### Phase 3: brain.md System (2 Tage)

**Ziel:** Manuell kuratierte Learnings als Guideline

**Tasks:**
1. ✅ brain.md erstellen
   - Datei: `docs/kba_guidelines/system/50_brain.md`
   - Initial-Content mit Struktur (s.o.)
   - Frontmatter: `priority: 50` (lädt nach anderen System-Guidelines)

2. ✅ Guidelines-Loader anpassen
   - Bestätigen: `backend/guidelines_loader.py` lädt `50_brain.md` automatisch
   - Test: brain.md Inhalt erscheint in Prompt

3. ✅ CLI Tool für Brain-Updates
   - Script: `backend/kba_brain_updater.py`
   - Funktion: `add_finding(category, finding, source, status="pending")`
   - Funktion: `mark_implemented(category, finding, guideline, impact)`

**CLI Tool Beispiel:**
```python
# backend/kba_brain_updater.py
import click
from pathlib import Path
from datetime import datetime

BRAIN_PATH = Path(__file__).parent.parent / "docs/kba_guidelines/system/50_brain.md"

@click.group()
def cli():
    """Manage brain.md learning accumulator."""
    pass

@cli.command()
@click.argument("category")
@click.argument("finding")
@click.option("--source", default="Manual observation")
def add_finding(category: str, finding: str, source: str):
    """Add new finding to brain.md."""
    brain_content = BRAIN_PATH.read_text()
    
    # Parse and find category section
    new_entry = f"""
### {category}
- **Finding:** {finding}
- **Source:** {source}
- **Status:** Pending - Review guideline update
- **Date:** {datetime.now().strftime("%Y-%m-%d")}
"""
    
    # Insert into "## Pending Improvements"
    # (Simplified - real version needs proper markdown parsing)
    updated = brain_content.replace(
        "## Pending Improvements",
        f"## Pending Improvements\n{new_entry}"
    )
    
    BRAIN_PATH.write_text(updated)
    click.echo(f"✅ Added finding to {category}")

@cli.command()
@click.argument("category")
@click.argument("finding_id")
@click.argument("guideline")
@click.option("--impact", required=True)
def mark_implemented(category: str, finding_id: str, guideline: str, impact: str):
    """Mark finding as implemented and track impact."""
    # Move from Pending to Recent Adjustments table
    # (Implementation omitted for brevity)
    click.echo(f"✅ Marked as implemented in {guideline}")

if __name__ == "__main__":
    cli()
```

**Usage:**
```bash
python backend/kba_brain_updater.py add-finding \
  VPN \
  "Users add 'Check firewall exceptions' step in 73% of cases" \
  --source "Edit analysis 2026-03-01 to 2026-03-07"

python backend/kba_brain_updater.py mark-implemented \
  VPN finding-001 VPN.md \
  --impact "Manual edits dropped from 73% to 15%"
```

**Deliverables:**
- brain.md Datei
- CLI Tool
- Documentation

**Aufwand:** 2 Developer-Days

---

### Phase 4: Automated Insights (4-5 Tage)

**Ziel:** System schlägt Guideline-Verbesserungen vor

**Tasks:**
1. ✅ Learning Service implementieren
   - Datei: `backend/kba_learning.py`
   - Class: `KBALearningService`
   - Methoden:
     - `detect_common_additions(category, min_occurrences=5)`
     - `detect_common_deletions(category)`
     - `generate_insights(category)`

2. ✅ Scheduled Insight-Generator
   - Script: `backend/kba_insight_generator.py`
   - Runs weekly (cron/scheduled task)
   - Output: JSON-Report oder brain.md-Update

**Insight Generator Beispiel:**
```python
# backend/kba_insight_generator.py
import asyncio
from kba_learning import KBALearningService
from kba_brain_updater import add_finding
import json

async def generate_weekly_insights():
    """Analyze edits and generate insights."""
    learning = KBALearningService()
    categories = ["VPN", "NETWORK", "PASSWORD_RESET", "GENERAL"]
    
    all_insights = {}
    for category in categories:
        insights = await learning.generate_insights(category)
        all_insights[category] = insights
        
        # Auto-add high-priority findings to brain.md
        for finding in insights['findings']:
            if finding['priority'] == 'high':
                add_finding(
                    category=category,
                    finding=f"Frequent addition: '{finding['text']}' ({finding['frequency']} times)",
                    source=f"Automated analysis ({insights['timestamp']})"
                )
    
    # Save full report
    report_path = f"data/insights_report_{datetime.now().strftime('%Y%m%d')}.json"
    with open(report_path, 'w') as f:
        json.dump(all_insights, f, indent=2)
    
    print(f"✅ Generated insights report: {report_path}")

if __name__ == "__main__":
    asyncio.run(generate_weekly_insights())
```

3. ✅ Insight-Review UI (Optional)
   - Admin-Page: `/admin/learning-insights`
   - Zeigt Vorschläge
   - Action: "Add to brain.md" / "Update guideline" / "Dismiss"

**Deliverables:**
- Learning Service
- Insight Generator Script
- Cron/Scheduled Task
- (Optional) Review UI

**Aufwand:** 4-5 Developer-Days

---

### Phase 5: Feedback Loop & Versioning (3-4 Tage)

**Ziel:** Guideline-Updates tracken und Effektivität messen

**Tasks:**
1. ✅ Guideline-Versioning
   - Frontmatter erweitern: `version: 1.2.0`
   - Bei Generation: `guidelines_version` speichern
   - Format: "VPN:1.2,GENERAL:1.0,NETWORK:1.1"

2. ✅ Guideline-Update-Tracking
   - Neue Tabelle: `GuidelineVersion`
   ```python
   class GuidelineVersion(SQLModel, table=True):
       id: Optional[int] = Field(default=None, primary_key=True)
       file_name: str  # e.g. "VPN.md"
       version: str  # e.g. "1.2.0"
       changes: str  # Summary of changes
       updated_at: datetime
       updated_by: str
       
       # Impact tracking
       avg_rating_before: Optional[float]
       avg_rating_after: Optional[float]
       sample_size_before: int = 0
       sample_size_after: int = 0
   ```

3. ✅ Impact-Messung automatisieren
   - Nach Guideline-Update: Baseline speichern
   - Nach N Generationen (z.B. 20): Before/After vergleichen
   - Visualisierung: Dashboard-Graph

4. ✅ Rollback-Mechanismus
   - Git-basiert: Guidelines sind in Version-Control
   - Bei negativem Impact: `git revert` + brain.md-Note

**Deliverables:**
- Versioning-System
- Impact-Tracking
- Rollback-Prozess

**Aufwand:** 3-4 Developer-Days

---

## 📊 Vollständiger Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  1. Generate KBA Draft      │
          │  - Load guidelines          │
          │  - LLM generates            │
          │  - Store ORIGINAL + CURRENT │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  2. User Reviews & Edits    │
          │  - Modify fields            │
          │  - System tracks DIFF       │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  3. User Rates (1-5 stars) │
          │  - Optional comment         │
          │  - Store rating + timestamp │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  4. Analytics Aggregation   │
          │  - Category ratings         │
          │  - Guideline effectiveness  │
          │  - Edit patterns            │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  5. Weekly Insight Job      │
          │  - Detect common additions  │
          │  - Generate recommendations │
          │  - Auto-update brain.md     │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  6. Admin Reviews Insights  │
          │  - Approve brain.md update  │
          │  - OR: Update guideline     │
          │  - Track version            │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  7. Impact Measurement      │
          │  - Compare ratings before/  │
          │    after guideline update   │
          │  - Validate improvement     │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  8. Continuous Refinement   │
          │  - Loop back to Step 1      │
          │  - Incremental improvements │
          └─────────────────────────────┘
```


---

## ⏱️ Timeline & Aufwand

### Gesamtübersicht

| Phase | Beschreibung | Aufwand | Schwierigkeit |
|-------|-------------|---------|---------------|
| 1 | Foundation (DB, Tracking) | 2-3 Tage | ⭐⭐ Mittel |
| 2 | UI & Analytics | 3-4 Tage | ⭐⭐⭐ Hoch |
| 3 | brain.md System | 2 Tage | ⭐ Einfach |
| 4 | Automated Insights | 4-5 Tage | ⭐⭐⭐ Hoch |
| 5 | Feedback Loop & Versioning | 3-4 Tage | ⭐⭐ Mittel |
| **TOTAL** | **Full Learning Loop** | **14-18 Tage** | |

### Quick-Win-Strategie

Wenn Zeit/Ressourcen limitiert:

**Minimum Viable Learning (Phase 1-3): 7-9 Tage**
- ✅ Foundation + brain.md + Rating UI
- ✅ Manuelle Insights (kein Automated Analysis)
- ✅ Bereits nützlich für iterative Verbesserung

**Recommended (Phase 1-4): 11-14 Tage**
- ✅ Alle oben + Automated Insights
- ✅ System schlägt Verbesserungen vor
- ❌ Ohne Impact-Tracking

**Full Implementation (Phase 1-5): 14-18 Tage**
- ✅ Kompletter Learning-Loop
- ✅ Impact-Messung
- ✅ Production-ready

---

## ⚠️ Risiken & Mitigation

### Technische Risiken

1. **DB Schema-Migration schlägt fehl**
   - **Risk:** Produktionsdaten beschädigt
   - **Mitigation:** 
     - Backup vor Migration
     - Test auf Staging-Environment
     - Rollback-Script vorbereiten

2. **LLM-Output-Drift**
   - **Risk:** LLM ändert Verhalten, Original-Output nicht mehr vergleichbar
   - **Mitigation:**
     - Model-Version tracken
     - Separate Analyse pro LLM-Version
     - Nur gleiche Versionen vergleichen

3. **Diff-Algorithmus zu simpel**
   - **Risk:** Sinnvolle Edits werden nicht erkannt
   - **Mitigation:**
     - Semantic Diff statt String-Diff
     - Use NLP-Libraries (spaCy, sentence-transformers)
     - Manuelle Review von Insights

### Operational Risiken

4. **User geben keine Ratings**
   - **Risk:** Zu wenige Daten für valide Insights
   - **Mitigation:**
     - Rating als "required" markieren vor Publish
     - Gamification (Badges, Leaderboard)
     - Erinnerungs-Benachrichtigungen

5. **brain.md wird nicht gepflegt**
   - **Risk:** Veraltete oder falsche Learnings
   - **Mitigation:**
     - Automated Insights generieren Vorschläge
     - Review-Prozess etablieren (wöchentlich)
     - Ownership zuweisen (KBA-Admin-Rolle)

6. **Guideline-Überladung**
   - **Risk:** Zu viele Details, LLM-Performance sinkt
   - **Mitigation:**
     - brain.md auf Top-5-Findings beschränken
     - Alte Learnings zu Hauptguideline migrieren
     - Regelmäßig konsolidieren

---

## 🎯 Success Metrics

### KPIs für Learning-System

1. **Rating Improvement**
   - Target: Durchschnitts-Rating steigt von X zu X+0.5 innerhalb 3 Monaten
   - Measure: `SELECT AVG(user_rating) FROM kba_drafts GROUP BY MONTH`

2. **Edit Reduction**
   - Target: Durchschnittliche Edits pro Draft sinken um 30%
   - Measure: `SELECT AVG(edit_count) FROM kba_drafts WHERE created_at > ...`

3. **Time-to-Publish**
   - Target: Zeit von Generation bis Publish sinkt um 20%
   - Measure: `published_at - created_at` durchschnittlich

4. **User Satisfaction**
   - Target: 80% der Drafts erhalten Rating >= 4
   - Measure: `COUNT(*) WHERE user_rating >= 4 / COUNT(*)`

5. **Guideline Effectiveness**
   - Target: Nach Update: Rating steigt um >= 0.3
   - Measure: Compare `avg_rating_before` vs `avg_rating_after`

---

## 🔄 Maintenance & Iteration

### Wöchentlich
- [ ] Insight-Generator-Job ausführen
- [ ] Neue Findings in brain.md reviewen
- [ ] Rating-Trends prüfen

### Monatlich
- [ ] Guideline-Effectiveness-Report
- [ ] brain.md konsolidieren (alte Entries zu Guidelines migrieren)
- [ ] Success-Metrics analysieren

### Quartalsweise
- [ ] Große Guideline-Updates basierend auf Learnings
- [ ] Versioning + Impact-Messung
- [ ] Learnings dokumentieren

---

## 💡 Alternatives & Consider

### Alternative: LLM-basiertes Guideline-Update

**Konzept:**
- LLM liest brain.md Findings + Analytics
- LLM schlägt konkrete Guideline-Änderungen vor
- Admin reviewed + merged

**Prompt-Beispiel:**
```
You are a guideline optimizer for a KBA drafting system.

Current VPN.md content:
[... full VPN.md ...]

Observed patterns from user edits (last 30 days):
- 73% of users add "Check firewall exceptions" step
- 41% of users add specific VPN client version numbers
- Low rating (2.3/5) with comments mentioning "missing troubleshooting"

Task: Propose specific additions/changes to VPN.md to address these patterns.
Output format: Markdown with clear before/after sections.
```

**Pros:**
- 🤖 Fully automated guideline proposals
- 📝 Natural language explanations
- 🎯 Context-aware suggestions

**Cons:**
- 🔐 Requires careful prompt engineering
- ⚠️ Risk of hallucinations
- 👥 Still needs human review

### Alternative: Reinforcement Learning

**Konzept:**
- Treat guideline selection as RL problem
- Reward: High ratings + low edits
- Learn optimal guideline combination per ticket-type

**Pros:**
- 🧠 True adaptive learning
- 🎯 Optimal guideline selection

**Cons:**
- 🚀 Very complex implementation
- 📊 Requires massive data
- 🔬 Research-level project

**Decision:** For this project, **rule-based + LLM-assisted** approach is more practical.

---

## 📚 Related Documentation

- [KBA Guidelines README](./README.md) - Vollständige Guideline-System-Dokumentation
- [AGENTS.md](../AGENTS.md) - Agent-System-Architektur
- [KBA_DRAFTER_OVERVIEW.md](../KBA_DRAFTER_OVERVIEW.md) - KBA Drafter Gesamtübersicht
- [PYDANTIC_ARCHITECTURE.md](../PYDANTIC_ARCHITECTURE.md) - Output-Validation

---

## 📝 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-03 | GitHub Copilot | Initial implementation plan |

---

## ✅ Next Steps

**Wenn du dieses Learning-System implementieren möchtest:**

1. **Start with Phase 1-2** (Foundation + Ratings)
   ```bash
   # Create DB migration
   cd backend
   alembic revision --autogenerate -m "Add learning fields"
   alembic upgrade head
   
   # Update service
   # Edit: backend/kba_service.py
   # - Save originals on generation
   # - Compute diffs on update
   ```

2. **Deploy Rating UI**
   ```bash
   # Create component
   # File: frontend/src/features/kba/RatingWidget.jsx
   npm install @fluentui/react-components
   ```

3. **Create brain.md** (Quick Win!)
   ```bash
   # Even without automation, brain.md is immediately useful
   cp docs/kba_guidelines/system/00_system_role.md \
      docs/kba_guidelines/system/50_brain.md
   
   # Edit with findings from manual observation
   ```

4. **After 2-4 Weeks:** Implement Phase 4 (Automated Insights)
   - Sufficient data collected
   - Patterns emerge
   - Automated analysis becomes valuable

---

**Questions? Issues?**
- See [README.md](./README.md) for KBA system overview
- Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues


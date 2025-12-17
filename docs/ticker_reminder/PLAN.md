# Ticker Reminder Implementation Plan

## Phase 1: Backend - Business Logic

- [x] 1. Create `reminder.py` with models and SLA calculations ✅ DONE
  - Extracted from `tickets.py` to `backend/reminder.py`
  - Models: `ReminderCandidate`, `ReminderRequest`, `ReminderResult`
  - Calculations: `get_sla_deadline_minutes`, `is_ticket_overdue`, `is_assigned_without_assignee`
  - Helpers: `build_reminder_candidate`, `filter_reminder_candidates`

- [x] 2. Remove duplicated code from `tickets.py` ✅ DONE
  - Removed models + calculations, re-exported from `reminder.py`

## Phase 2: Backend - API Endpoints

- [x] 3. Create REST endpoints in `app.py` ✅ DONE
  - `GET /api/reminder/candidates` → returns 26 unassigned tickets with SLA status
  - `POST /api/reminder/send` → validates ticket IDs, ready for email integration
  - Tested: SLA calculations correct (HIGH=120min, MEDIUM=240min, etc.)

- [x] 4. Register MCP operations via `@operation` decorator ✅ DONE
  - `op_get_reminder_candidates` - returns overdue tickets
  - `op_send_reminders` - sends reminders + saves to outbox

## Phase 3: Frontend - State & API

- [ ] 5. Add API functions in `services/api.js`
  - `fetchReminderCandidates()`
  - `sendReminders(ticketIds)`

- [ ] 6. Create localStorage helpers in `services/reminderStorage.js`
  - `getSelectedTickets() -> string[]`
  - `toggleTicketSelection(ticketId) -> void`
  - `clearSelections() -> void`
  - Key: `reminder_selected_tickets`

- [ ] 7. Create `TicketReminder.jsx` component
  - Local state: `candidates`, `selections` (from localStorage), `selectedTicket`
  - On mount: fetch candidates + load selections from localStorage
  - Checkbox click → update localStorage immediately
  - After "Remind NOW" success → clear localStorage

## Phase 4: Frontend - UI Implementation

- [ ] 8. Implement master grid with selection column
  - FluentUI DataGrid with checkbox column
  - Row highlighting for `was_reminded_before` tickets
  - Sortable columns per UI_MOCKUP.md

- [ ] 9. Implement detail panel
  - Left: ticket metadata (group, date, customer, notes, service)
  - Right: worklog table (Type, Notes, Submit Date, Submitter)

- [ ] 10. Implement action buttons
  - "Get Reminder Tickets" → refresh candidates
  - "Remind NOW" → send for selected, show toast, clear localStorage, refresh

## Phase 5: Backend - Reminder Outbox

- [x] 11. Create SQLite schema for reminder outbox ✅ DONE
  - Table: `reminder_outbox`
  - Location: `backend/data/reminder_outbox.db`
  - Columns: `id`, `ticket_id`, `recipient`, `markdown_content`, `sent_at`

- [x] 12. Create `reminder_outbox.py` module ✅ DONE
  - `init_outbox_db()` - create table if not exists
  - `save_sent_reminder(ticket_id, recipient, markdown, sent_at) -> OutboxEntry`
  - `get_outbox_entries(limit=50) -> list[OutboxEntry]`
  - `get_entries_for_ticket(ticket_id) -> list[OutboxEntry]`

- [x] 13. Define Pydantic models for outbox ✅ DONE
  - `OutboxEntry` (id, ticket_id, recipient, markdown_content, sent_at)
  - `OutboxCreate` (ticket_id, recipient, markdown_content)

- [x] 14. Create REST endpoints for outbox ✅ DONE
  - `GET /api/reminder/outbox` → list sent reminders
  - `GET /api/reminder/outbox/{ticket_id}` → reminders for specific ticket

## Phase 6: Frontend - Outbox UI

- [ ] 15. Add outbox API functions in `services/api.js`
  - `fetchOutboxEntries()`
  - `fetchOutboxForTicket(ticketId)`

- [ ] 16. Add outbox view to `TicketReminder.jsx`
  - Tab or collapsible section showing sent reminders
  - Table: Ticket ID, Recipient, Sent Date, Preview (truncated markdown)
  - Click to expand full markdown content

## Phase 7: Integration & Testing

- [ ] 17. Add E2E tests in `tests/e2e/reminder.spec.js`
  - Load candidates, select tickets, send reminder, verify localStorage cleared
  - Verify reminder appears in outbox after send

- [ ] 18. Initialize sample reminder data
  - Extend `tickets.py` sample data with overdue tickets

---

## API Contract Summary

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| GET | `/api/reminder/candidates` | - | `{candidates: ReminderCandidate[]}` |
| POST | `/api/reminder/send` | `{ticket_ids: []}` | `{sent: int, failed: []}` |
| GET | `/api/reminder/outbox` | - | `{entries: OutboxEntry[]}` |
| GET | `/api/reminder/outbox/{ticket_id}` | - | `{entries: OutboxEntry[]}` |

## Outbox SQLite Schema

```sql
CREATE TABLE reminder_outbox (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
    sent_at TEXT NOT NULL
);
CREATE INDEX idx_outbox_ticket ON reminder_outbox(ticket_id);
CREATE INDEX idx_outbox_sent_at ON reminder_outbox(sent_at DESC);
```

## localStorage Schema

```javascript
// Key: "reminder_selected_tickets"
// Value: JSON array of ticket IDs
["ticket-id-1", "ticket-id-2", "ticket-id-3"]
```

## SLA Rules (from RULES_EN.md)

| Priority | Deadline |
|----------|----------|
| Critical | 30 min |
| High | 2 hours |
| Medium | 4 hours |
| Low/Standard | 8 hours |

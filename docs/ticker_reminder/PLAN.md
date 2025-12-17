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

- [ ] 3. Create REST endpoints in `app.py`
  - `GET /api/reminder/candidates` → list tickets needing reminders (filtered by SLA rules)
  - `POST /api/reminder/send` → send reminders for provided ticket IDs

- [ ] 4. Register MCP operations via `@operation` decorator
  - `op_get_reminder_candidates`
  - `op_send_reminders`

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

## Phase 5: Integration & Testing

- [ ] 11. Add E2E tests in `tests/e2e/reminder.spec.js`
  - Load candidates, select tickets, send reminder, verify localStorage cleared

- [ ] 12. Initialize sample reminder data
  - Extend `tickets.py` sample data with overdue tickets

---

## API Contract Summary

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| GET | `/api/reminder/candidates` | - | `{candidates: ReminderCandidate[]}` |
| POST | `/api/reminder/send` | `{ticket_ids: []}` | `{sent: int, failed: []}` |

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

# Ticker Reminder Implementation Plan

## Phase 1: Backend - Data Layer

- [ ] 1. Create SQLite database schema for reminder selections
  - Table: `reminder_selections` with columns: `ticket_id` (PK), `selected_at` (timestamp)
  - Location: `backend/data/reminder_selections.db`

- [ ] 2. Create `reminder_storage.py` module
  - Pure functions for DB operations (no side effects in logic)
  - `init_db()` - create table if not exists
  - `add_selection(ticket_id: str) -> bool`
  - `remove_selection(ticket_id: str) -> bool`
  - `get_all_selections() -> list[str]`
  - `clear_all_selections() -> int`

## Phase 2: Backend - Business Logic

- [ ] 3. Create `reminder_service.py` with SLA calculations
  - `get_sla_deadline(priority: str) -> timedelta` (30m/2h/4h/8h)
  - `is_ticket_overdue(ticket: Ticket) -> bool`
  - `was_reminded_before(ticket: TicketWithWorkLogs) -> bool` (check worklogs for `log_type: reminder`)
  - `get_reminder_candidates(tickets: list) -> list[ReminderCandidate]`

- [ ] 4. Define Pydantic models in `reminder_models.py`
  - `ReminderCandidate` (ticket + `is_overdue`, `was_reminded`, `reminder_count`)
  - `SelectionRequest` (ticket_id: str, selected: bool)
  - `ReminderBatchRequest` (ticket_ids: list[str])
  - `ReminderBatchResponse` (sent_count, failed_ids)

## Phase 3: Backend - API Endpoints

- [ ] 5. Create REST endpoints in `app.py`
  - `GET /api/reminder/candidates` → list tickets needing reminders (filtered by SLA rules)
  - `GET /api/reminder/selections` → get all selected ticket IDs
  - `POST /api/reminder/selections` → toggle selection `{ticket_id, selected}`
  - `DELETE /api/reminder/selections` → clear all selections
  - `POST /api/reminder/send` → send reminders for selected tickets

- [ ] 6. Register MCP operations via `@operation` decorator
  - `op_get_reminder_candidates`
  - `op_toggle_reminder_selection`
  - `op_send_reminders`

## Phase 4: Frontend - State & API

- [ ] 7. Add API functions in `services/api.js`
  - `fetchReminderCandidates()`
  - `getSelections()`
  - `toggleSelection(ticketId, selected)`
  - `sendReminders(ticketIds)`

- [ ] 8. Create `TicketReminder.jsx` component
  - Local state: `candidates`, `selections` (Set), `selectedTicket`
  - On mount: fetch candidates + selections
  - Checkbox click → immediate API call to persist

## Phase 5: Frontend - UI Implementation

- [ ] 9. Implement master grid with selection column
  - FluentUI DataGrid with checkbox column
  - Row highlighting for `was_reminded_before` tickets
  - Sortable columns per UI_MOCKUP.md

- [ ] 10. Implement detail panel
  - Left: ticket metadata (group, date, customer, notes, service)
  - Right: worklog table (Type, Notes, Submit Date, Submitter)

- [ ] 11. Implement action buttons
  - "Get Reminder Tickets" → refresh candidates
  - "Remind NOW" → send for selected, show toast, refresh

## Phase 6: Integration & Testing

- [ ] 12. Add E2E tests in `tests/e2e/reminder.spec.js`
  - Load candidates, select tickets, persist selection, send reminder

- [ ] 13. Initialize sample reminder data
  - Extend `tickets.py` sample data with overdue tickets

---

## API Contract Summary

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| GET | `/api/reminder/candidates` | - | `{candidates: ReminderCandidate[]}` |
| GET | `/api/reminder/selections` | - | `{ticket_ids: string[]}` |
| POST | `/api/reminder/selections` | `{ticket_id, selected}` | `{success: bool}` |
| DELETE | `/api/reminder/selections` | - | `{cleared: int}` |
| POST | `/api/reminder/send` | `{ticket_ids: []}` | `{sent: int, failed: []}` |

## SLA Rules (from RULES_EN.md)

| Priority | Deadline |
|----------|----------|
| Critical | 30 min |
| High | 2 hours |
| Medium | 4 hours |
| Low/Standard | 8 hours |

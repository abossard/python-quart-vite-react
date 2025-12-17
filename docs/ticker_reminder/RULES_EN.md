# Feature Canvas C5: "Assigned without Assignee" Ticket Reminder

## Current Situation

- Tickets are created and assigned to a Support Group based on priority {`assigned_group`, `priority`}
- Each ticket must be taken **In Progress** within priority-based deadlines {`status`, `priority`, `created_at`}:
  - **Critical**: max 30 minutes {`priority`: "critical"}
  - **High**: max 2 hours {`priority`: "high"}
  - **Medium**: max 4 hours {`priority`: "medium"}
  - **Standard**: max 8 hours {`priority`: "low"}
- When deadlines expire, Incident Management sends email reminders to Support Group Leads (SGL)

## Current Manual Process

1. Open filter **[Assigned without Assignee] → [All]** {`assignee`: null, `assigned_group`: not null}
2. Sort by **Last Modified Date** column (oldest tickets first) to track priority deadlines {`updated_at`}
3. Manually review each ticket:
   - Check worklog entries {`work_logs`}
   - Verify if ticket was already reminded before {`work_logs.log_type`, `work_logs.summary`}
4. Send email reminder to Support Group Lead via Remedy email system
   - Template: *Incident / Reminder Ticket ohne Assignee*
5. Repeat steps 3-4 for each ticket

## Desired Solution

### UI Requirements

- **Automatic ticket selection** with suggested reminders on button click/page load
- Apply filtering criteria:
  - "Assigned without Assignee" status {`assignee`: null, `status`: "assigned"}
  - Priority-based deadline thresholds {`priority`, `created_at`}
- Display potential tickets in a **list view** {`id`, `summary`, `priority`, `status`, `assigned_group`, `created_at`}

### Ticket Detail View

- Click on a ticket → show **preview/detail view** {`id`, `summary`, `description`, `priority`, `status`, `service`, `city`, `requester_name`, `requester_email`}
- Display recent worklog entries (newest first) {`work_logs[]`: `created_at`, `log_type`, `summary`, `details`, `author`}

### Selection & Actions

- **Select/Deselect** functionality to mark tickets for reminder
- **"Remind Now" button** to send reminders for selected tickets

### Visual Indicators

- Tickets **already reminded once** but still unprocessed should be **visually highlighted** (different color) {`work_logs` filtered by `log_type`: "reminder"}

---

## Available Ticket Fields (Reference)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique ticket identifier |
| `summary` | string | Short ticket title |
| `description` | string | Detailed issue description |
| `status` | enum | new, assigned, in_progress, pending, resolved, closed, cancelled |
| `priority` | enum | critical, high, medium, low |
| `assignee` | string/null | Assigned agent name |
| `assigned_group` | string | Support group name |
| `created_at` | datetime | Ticket creation timestamp |
| `updated_at` | datetime | Last modification timestamp |
| `service` | string | Affected service |
| `city` | string | Location |
| `requester_name` | string | Reporter name |
| `requester_email` | string | Reporter email |
| `work_logs` | array | Worklog entries with `log_type`, `summary`, `author`, `created_at` |

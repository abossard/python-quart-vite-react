# CSV Ticket Guidance For AI Agents

This project exposes ticket data from `csv/data.csv` through REST, MCP, and agent tools.
Use this guide when building prompts or automation for usecase demo idea generation.

## 1. Data Source Rules

- Source of truth: `csv/data.csv` (read-only in current implementation).
- Backend normalizes many BMC headers into the typed `Ticket` model (`backend/tickets.py`).
- Do not assume every CSV column is mapped. Use only exposed normalized fields.
- Always treat missing values as unknown, not false.

## 2. Recommended Tool Order (MCP Or Agent)

1. Call `csv_ticket_fields` to discover available fields.
2. Call `csv_ticket_stats` to get high-level distribution (status, priority, city, group).
3. Narrow data with `csv_list_tickets` filters (`status`, `assigned_group`, `has_assignee`).
4. Use `csv_search_tickets` for text scenarios (problem patterns, products, cities, notes).
5. Call `csv_get_ticket` only for deep dives on specific IDs.

## 3. MCP Tools Added In This Repo

- `csv_ticket_fields`
- `csv_ticket_stats`
- `csv_list_tickets`
- `csv_search_tickets`
- `csv_get_ticket`

All tools are available via `POST /mcp` (`tools/list` and `tools/call`).

## 4. Prompting Guidance For Usecase Demo Ideas

When generating project ideas:

- Start from real evidence in tickets (priority, volume, repeated keywords, bottlenecks).
- Explicitly reference ticket IDs used as evidence.
- Prefer one menu point per project idea.
- Return both:
  - Human summary
  - Structured rows (JSON) for table rendering

Suggested output schema:

```json
{
  "rows": [
    {
      "menu_point": "Smart Routing",
      "project_name": "Auto Assignment Optimizer",
      "summary": "Reduces unassigned high-priority incidents.",
      "agent_prompt": "Analyze unassigned critical/high tickets and propose routing rules.",
      "ticket_ids": "id1,id2,id3",
      "csv_evidence": "24 high-priority tickets without assignee in top 2 groups."
    }
  ]
}
```

## 5. Guardrails

- Never invent tickets, IDs, or field values.
- If the dataset is insufficient, say so clearly.
- Keep responses deterministic and auditable: include filtering logic used.
- Prefer concise tables over long prose when showing candidate projects.

# Copilot Instructions

## Purpose

This repository is a **learning environment** for processing and visualizing CSV ticket data using Copilot.

## Scope Boundaries

**Do:**

- Work with `csv/data.csv` and related parsing logic (`backend/csv_data.py`)
- Write/adjust small, focused Python scripts or notebooks for data exploration (pandas, matplotlib, seaborn, plotly)
- Compute summaries, statistics, filters, aggregations on ticket data
- Propose visualizations and queries to understand ticket patterns
- Help interpret CSV schema and column mappings

**Do NOT:**

- Change backend architecture (`backend/app.py`, `operations.py`, decorators)
- Modify Pydantic models (`tickets.py`, `tasks.py`) or core services
- Alter REST/MCP endpoints, React frontend structure, or tests
- Touch `UNIFIED_ARCHITECTURE.md`, `README.md`, or Playwright tests

## CSV Data Structure

Primary source: `csv/data.csv` (BMC Remedy/ITSM export).
Key columns:

- Identifiers: `Entry ID`, `Incident ID*+`, `Corporate ID`
- Summary: `Summary*`, `Notes`, `Resolution`
- Status/Priority: `Status*`, `Priority*`, `Urgency*`, `Impact*`
- Assignment: `Assignee+`, `Assigned Group*+`, `Owner Group+`
- Requester: `Full Name`, `First Name+`, `Last Name+`, `Internet E-mail`
- Location: `City`, `Country`, `Site ID`, `Company`
- Timestamps: `Reported Date+`, `Last Modified Date`, `Closed Date`
- Categories: `Operational Categorization Tier 1+/2/3`, `Product Categorization Tier 1/2/3`

Reference implementation: `backend/csv_data.py` (column mapping, status/priority mapping, date parsing).

## Working with the Data

- Load: `pd.read_csv("csv/data.csv", encoding="latin-1")`
- Dates: parse `DD.MM.YYYY HH:MM:SS` (e.g., `22.10.2025 11:53:33`)
- Status mapping: New, Assigned, In Progress, Pending, Resolved, Closed, Cancelled
- Priority mapping: 1-Critical, 2-High, 3-Medium, 4-Low
- Prefer notebooks for exploration; keep scripts small and focused

## Conventions

- Follow “Grokking Simplicity”: separate data (CSV), calculations (pure), actions (I/O)
- Keep changes minimal, targeted, and reversible
- No broad refactors; prioritize clarity for learners
- Document findings inline (markdown cells/comments)

## KBA Draft Builder

To change the KBA Draft Builder behavior, update these files:

- **Agent system prompt** (controls what the LLM generates): `backend/agents.py` → search for `if request.agent_type == "kba_assistant"` inside `run_agent()`. The `system_prompt` string there defines the Markdown structure, tone, language, and rules.
- **Tool descriptions** (controls how the agent discovers/uses tools): `backend/agents.py` → `_build_csv_tools()`, specifically the `description` kwarg for `csv_get_ticket` and `csv_search_tickets`.
- **Default user prompt** (the pre-filled INC number): `frontend/src/features/usecase-demo/demoDefinitions.js` → `KBA_DEFAULT_PROMPT` constant.
- **Result rendering** (how the Markdown is displayed): `frontend/src/features/usecase-demo/resultViews.jsx` → `ResultKBAMarkdownView` component and its `useKbaStyles`.

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

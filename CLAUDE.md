# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup
```bash
./setup.sh               # Bootstrap: creates .venv, installs deps, installs Playwright
source .venv/bin/activate
```

### Run (Development)
```bash
./start-dev.sh           # Starts backend (port 5001) + frontend (port 3001) together

# Or manually:
# Terminal 1 - Backend:
source .venv/bin/activate && cd backend && python app.py

# Terminal 2 - Frontend:
cd frontend && npm run dev
```

### Run (Production / Docker)
```bash
docker build -t quart-react-demo .
docker run -p 5001:5001 quart-react-demo
# Quart serves both API + built frontend on port 5001
```

### Tests
```bash
# E2E tests (Playwright - requires both servers running or auto-started)
npm run test:e2e              # Run all E2E tests (chromium, firefox, webkit)
npm run test:e2e:ui           # Interactive UI mode
npm run test:e2e:report       # View last HTML report
npx playwright test tests/e2e/workbench.spec.js --project=chromium  # Single file + browser

# Backend unit tests (pytest)
cd backend
pytest                        # All backend tests
pytest agent_builder/tests/   # 132 agent framework tests
pytest test_agents.py -v      # Single file, verbose
```

### Frontend Build
```bash
cd frontend && npm install && npm run build   # Outputs to frontend/dist/
```

## Architecture

### Overview
Full-stack teaching app: **Quart** (async Python ASGI, port 5001) + **React/Vite** (port 3001 in dev). In development, Vite proxies `/api/*` to the Quart backend. In production, Quart serves the built frontend statically.

### Backend (`backend/`)

**Key pattern — Unified Operation System** (`api_decorators.py`):
```python
@operation("create_task", "Create a task", http_method="POST", mcp_enabled=True)
def op_create_task(data: TaskCreate) -> Task:
    return TaskService.create_task(data)
```
The `@operation` decorator auto-generates: REST endpoint, MCP JSON-RPC method, JSON schema, and LangChain `StructuredTool`. Define once, used everywhere. Operations are registered in `operations.py`.

**Deep module pattern**: Business logic consolidated into service classes (`TaskService`, `WorkbenchService`, `CSVTicketService`, `KBAService`) rather than scattered thin functions.

**Key files:**
- `app.py` — Quart app, route/blueprint registration, SSE streams, LLM config
- `api_decorators.py` — `@operation` decorator implementation
- `operations.py` — All operation definitions
- `tasks.py` — SQLModel task models + `TaskService` (SQLite via `data/tasks.db`)
- `csv_data.py` — `CSVTicketService`: loads CSV (`CSV/data.csv`), date parsing (German format `DD.MM.YYYY HH:MM:SS`), filtering, pagination
- `tickets.py` — Pydantic ticket models + enums (Status, Priority, Urgency, Impact)
- `agent_builder/` — Full agent lifecycle: `service.py` (WorkbenchService), `engine/` (ReAct loop), `persistence/` (SQLite repos), `tools/` (ToolRegistry, MCP adapters), `routes.py` (Blueprint at `/api/workbench/*`)
- `kba_service.py` — Knowledge Base Article generation pipeline

**LLM config**: GitHub Copilot is default (uses device flow or GITHUB_TOKEN); OpenAI is optional override. Config via `.env`.

**MCP**: Backend exposes both REST and MCP JSON-RPC from the same `@operation` handlers. `mcp_handler.py` routes JSON-RPC to operations.

### Frontend (`frontend/src/`)

**Feature-first structure**: `features/<name>/` contains page component, subcomponents, utils, and local state. All backend calls go through `services/api.js`.

**Key features:**
- `workbench/` — Agent Fabric: create/run/inspect ReAct agents with live schema editor
- `csvtickets/` — Browse/filter/sort/paginate the CSV ticket dataset
- `tickets/` — Nivo chart visualizations (bar, sankey, stream)
- `usecase-demo/` — Pre-built demo agent runs with custom result renderers
- `kba-drafter/` — KBA generation UI (draft list, editor, audit trail)
- `dashboard/` — Real-time updates via Server-Sent Events (`/api/time-stream`)
- `agent/` — One-shot agent chat interface

**UI**: FluentUI v9 (`@fluentui/react-components`) throughout. Charts via `@nivo/*`.

### Testing

E2E tests (`tests/e2e/`) use Playwright. `playwright.config.js` auto-starts backend + frontend via `webServer`. Tests use `data-testid` attributes. Three browser projects: chromium, firefox, webkit.

Backend tests use pytest. `agent_builder/tests/` has 132 tests covering the agent framework.

## Environment

Copy `.env.example` to `.env`. Key variables:
```
# GitHub Copilot (default — uses GITHUB_TOKEN or device flow)
COPILOT_MODEL=gpt-4o

# OpenAI (optional override)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# KBA publishing path
KB_FILE_BASE_PATH=./kb_published
```

## Ports
- Backend (Quart): `http://localhost:5001`
- Frontend dev (Vite): `http://localhost:3001`
- In production: single port `5001` (Quart serves everything)

## Docs
- `docs/QUICKSTART.md` — 5-minute setup
- `docs/AGENT_BUILDER.md` — Agent framework architecture with diagrams
- `docs/UNIFIED_ARCHITECTURE.md` — REST + MCP integration patterns
- `docs/LEARNING.md` — Design principles (Grokking Simplicity, deep modules)
- `docs/TROUBLESHOOTING.md` — Common issues

# Copilot Instructions

## Purpose

Teaching-oriented full-stack app: Python Quart backend + React/FluentUI frontend, with CSV ticket data processing and a config-driven LangGraph agent builder. Designed to demonstrate "Grokking Simplicity" (actions vs. calculations vs. data) and "A Philosophy of Software Design" (deep modules).

## Commands

```bash
# Setup
./setup.sh                    # One-command bootstrap (venv, deps, Playwright)
./start-dev.sh                # Start backend + frontend together

# Backend
source .venv/bin/activate && cd backend && python app.py   # Backend on :5001
cd backend && pytest                                        # All backend tests
cd backend && pytest tests/test_tickets.py                  # Single test file
cd backend && pytest tests/test_tickets.py::test_name -v    # Single test
cd backend && pytest agent_builder/tests/                   # Agent builder tests

# Frontend
cd frontend && npm run dev     # Vite dev server on :3001
cd frontend && npm run build   # Production build

# E2E (from repo root; auto-starts servers)
npm run test:e2e                                             # All Playwright tests
npx playwright test tests/e2e/app.spec.js --project=chromium # Single spec
npm run test:e2e:ui                                          # Interactive UI mode
```

## Architecture

### Unified Operation System (the core pattern)

The `@operation` decorator in `api_decorators.py` is the central abstraction. Defining a function with `@operation` once automatically generates:
- A REST endpoint (Quart route)
- An MCP JSON-RPC tool
- A LangChain `StructuredTool` for agents

All operations live in `operations.py`. Pydantic models provide type validation, schema generation, and serialization — defined once, used across all interfaces.

```
@operation("create_task", http_method="POST")
def create_task(data: TaskCreate) -> Task:
    return _task_service.create_task(data)
# → POST /api/create_task + MCP tool + LangChain tool, all auto-generated
```

### Backend layers

- `tasks.py`, `tickets.py` — Pydantic/SQLModel models + business logic
- `api_decorators.py` — `@operation` decorator and `Operation` registry
- `operations.py` — All operation definitions (single source of truth)
- `app.py` — Quart routes, MCP JSON-RPC handler, SSE streams
- `app.py` — Quart routes, MCP JSON-RPC handler, SSE streams
- `csv_data.py` — CSV ticket parsing (BMC Remedy format)
- `agent_builder/` — Config-driven LangGraph agents (models, engine, persistence, tools, routes)

### Frontend layers

- Feature-first structure under `frontend/src/features/` (workbench, tickets, tasks, agent, etc.)
- All API calls go through `frontend/src/services/api.js` (`fetchJSON` centralizes error handling)
- FluentUI v9 components + design tokens for theming
- Nivo charts for data visualization
- React Router v7, React hooks for state (no Redux)

### Agent Builder

Config-driven LLM agents built with LangGraph. Agents are defined in the UI (system prompt, tools, output schema), stored in SQLite, and run as ReAct agents. The `ToolRegistry` auto-discovers all `@operation`-decorated functions. See `docs/AGENTS.md` and `docs/AGENT_BUILDER.md`.

## Conventions

- **Grokking Simplicity**: separate data (models/CSV), calculations (pure functions), and actions (I/O/side effects). `services/api.js` is actions; component logic is calculations.
- **Deep modules**: `TaskService` etc. have simple interfaces but hide complex implementations. Don't add thin wrapper layers.
- **Pydantic-first**: all data shapes use Pydantic models. Adding a field to a model automatically propagates to REST, MCP, and agent tool schemas.
- **SQLModel for persistence**: single class serves as both Pydantic model and SQLAlchemy ORM table.
- **Backend tests**: pytest with `asyncio_mode = auto`. Tests live in `backend/tests/` and `backend/agent_builder/tests/`.
- **E2E tests**: Playwright with auto-server startup. Tests use `data-testid` attributes for selectors.
- **Keep changes minimal and reversible** — this is a learning repo. Prioritize clarity for learners.

## CSV Data

Primary source: `csv/data.csv` (BMC Remedy/ITSM export). Reference: `backend/csv_data.py`.

- Load: `pd.read_csv("csv/data.csv", encoding="latin-1")`
- Date format: `DD.MM.YYYY HH:MM:SS`
- Key columns: `Incident ID*+`, `Summary*`, `Status*`, `Priority*`, `Assignee+`, `Assigned Group*+`, `Reported Date+`, `Operational Categorization Tier 1+/2/3`
- Status values: New, Assigned, In Progress, Pending, Resolved, Closed, Cancelled
- Priority values: 1-Critical, 2-High, 3-Medium, 4-Low

## Environment

- Backend: Python 3.10+, Quart on port 5001
- Frontend: Node 18+, Vite on port 3001
- OpenAI API key in `.env` for LLM features (`OPENAI_API_KEY`, `OPENAI_MODEL`)

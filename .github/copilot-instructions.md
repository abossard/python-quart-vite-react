# Copilot Instructions

##Test

## Architecture 

- `backend/app.py` hosts both REST (`/api/*`) and MCP JSON-RPC (`/mcp`) on port 5001; every new capability should be exposed via the shared `@operation` decorator so both interfaces stay in sync.
- Business logic lives in `backend/tasks.py` (`TaskService` plus Pydantic models) backed by an in-memory `_tasks_db`; keep it the single source of truth and seed demo data via `TaskService.initialize_sample_data()`.
- The React side is feature-first: `frontend/src/App.jsx` just switches tabs while each folder under `frontend/src/features` owns its state, calculations, and FluentUI layout; `frontend/src/services/api.js` is the only place that should issue network calls.

## Backend Patterns

- Define operations with `@operation` (see `op_create_task`, `op_get_task`): annotate parameters with Pydantic models or enums so MCP schemas and REST validation are generated automatically, then build thin Quart wrappers that only handle HTTP concerns.
- Keep methods like `TaskService.create_task` and `TaskService.update_task` “deep”: they already validate, mutate `_tasks_db`, and return `Task` models, so avoid splitting them into tiny helpers or duplicating validation elsewhere.
- Use the provided Pydantic models (`TaskCreate`, `TaskUpdate`, `TaskStats`, `TaskFilter`) for all inputs/outputs; MCP tooling and REST serializers expect `.model_dump()` objects with these exact field names (`created_at`, `completed`, etc.).
- The SSE endpoint `time_stream` streams `{"time","date","timestamp"}` JSON strings; if you change its shape, also update `connectToTimeStream` consumers and the Dashboard expectations.

## Frontend Patterns

- Feature components isolate **calculations** (pure helpers like `getTaskStats`), **actions** (API calls, event handlers), and **data** (React state) in that order; preserve that structure when extending `TaskList` or `Dashboard`.
- Stick to FluentUI v9 primitives with `makeStyles`/`tokens`; prefer adjusting the `useStyles` definitions over inline styles to maintain theming consistency.
- Always go through `frontend/src/services/api.js` (`fetchJSON`, `createTask`, `updateTask`, etc.); components expect rejected promises to carry friendly `Error.message`, so don’t bypass these helpers.
- Task UI and tests rely on deterministic `data-testid` attributes (`task-menu-${id}`, `filter-completed`, etc.); keep them stable or update the Playwright suite alongside UI changes.
- Real-time widgets follow the `connectToTimeStream` contract (subscribe in `useEffect`, capture cleanup function, surface errors via component state); reuse that approach for any new SSE sources.

## Workflows

- One-time setup: run `./setup.sh` from the repo root to create the repo-level `.venv`, install frontend deps, and provision Playwright browsers.
- Dev loop: `source .venv/bin/activate && cd backend && python app.py` (serves on 5001) plus `cd frontend && npm run dev`; `./start-dev.sh` or the VS Code “Full Stack: Backend + Frontend” launch config will start both for you.
- MCP testing uses JSON-RPC POSTs to `http://localhost:5001/mcp` (`tools/list`, `tools/call`); no extra process is required because the Quart server already exposes it.

## Testing

- E2E coverage lives in `tests/e2e/app.spec.js`; from the repo root run `npm run test:e2e` (`:ui` for interactive, `:report` to inspect results). Start both servers first to avoid cold-start delays.
- The suite assumes sample tasks exist (created by `TaskService.initialize_sample_data()`), tabs are labeled via `data-testid`, and SSE data matches the backend format; keep those invariants or update the tests deliberately.
- For deterministic assertions, prefer editing helpers like `waitForAppToLoad` or the shared selector strings instead of scattering hard-coded waits.

## Conventions

- Follow “Grokking Simplicity”: keep actions (I/O) in services or event handlers, calculations pure (formatting, stats), and data as plain objects/React state; this is enforced heavily in docs and existing code.
- Follow “A Philosophy of Software Design”: favor deep modules (e.g., extend `TaskService` instead of sprinkling logic across routes/components) and hide complexity behind simple interfaces.
- When you touch the architecture (operation decorators, unified REST/MCP flow, feature structure), update `README.md` and `UNIFIED_ARCHITECTURE.md` so future agents inherit the correct mental model.

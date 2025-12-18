# Copilot Instructions

## Architecture

- `backend/app.py` hosts REST (`/api/*`), MCP JSON-RPC (`/mcp`), and LangGraph agent (`/api/agents/run`) on port 5001; new capabilities should use the `@operation` decorator in `backend/operations.py` so all interfaces stay in sync.
- Business logic lives in service modules: `tasks.py` (TaskService), `tickets.py` (ticket models + SLA calculations); keep services as the single source of truth.
- The React side is feature-first: `frontend/src/App.jsx` switches tabs via React Router; each folder under `frontend/src/features` owns its state, calculations, and FluentUI layout.
- All network calls go through `frontend/src/services/api.js`; localStorage helpers live in separate modules like `reminderStorage.js`.

## Backend Patterns

- **Operations**: Define with `@operation` decorator (see `backend/operations.py`). Annotate parameters with Pydantic models so MCP schemas, REST validation, and LangGraph tools are generated automatically.
- **Deep modules**: Keep service methods like `TaskService.create_task` deep—they validate, mutate state, and return models. Avoid scattering validation across routes.
- **Pydantic everywhere**: Use models for all inputs/outputs (`TaskCreate`, `TaskUpdate`, `TaskFilter`). MCP tooling and REST serializers expect `.model_dump()` with exact field names.
- **Agents**: `backend/agents.py` provides `AgentService` using Azure OpenAI + LangGraph. All `@operation` functions auto-become agent tools. Configure via `.env` (see `docs/AGENTS.md`).
- **Tickets**: `backend/tickets.py` has Pydantic models for external ticket MCP service; SLA deadlines are defined in `PRIORITY_SLA_MINUTES` dict.

## Frontend Patterns

- **Feature structure**: Each component under `frontend/src/features/` isolates:
  1. **Calculations** (pure helpers like `formatDate`, `truncateText`)
  2. **Actions** (API calls, event handlers)
  3. **Data** (React state)
- **FluentUI v9**: Use `makeStyles`/`tokens` for styling; avoid inline styles. Components: `DataGrid`, `TabList`, `Badge`, `MessageBar`, `Spinner`.
- **API layer**: Always use `frontend/src/services/api.js` (`fetchJSON`, `createTask`, etc.); rejected promises carry `Error.message`.
- **localStorage**: For persistence across sessions, create dedicated modules (e.g., `reminderStorage.js` for reminder ticket selections).
- **Test IDs**: Use stable `data-testid` attributes (`task-menu-${id}`, `filter-completed`, `candidates-grid`); update Playwright tests if IDs change.
- **SSE**: Follow `connectToTimeStream` pattern—subscribe in `useEffect`, capture cleanup function, surface errors via state.

## Workflows

- **Setup**: `./setup.sh` creates `.venv`, installs frontend deps, provisions Playwright browsers.
- **Dev loop**: 
  - Backend: `source .venv/bin/activate && cd backend && python app.py` (port 5001)
  - Frontend: `cd frontend && npm run dev` (port 3001)
  - Or use `./start-dev.sh` or VS Code "Full Stack: Backend + Frontend" launch config.
- **MCP testing**: POST to `http://localhost:5001/mcp` with JSON-RPC (`tools/list`, `tools/call`).
- **Agent testing**: `POST /api/agents/run` with `{"prompt": "...", "agent_type": "task_assistant"}`.

## Testing

- E2E tests: `tests/e2e/app.spec.js`; run with `npm run test:e2e` (`:ui` for interactive).
- Tests assume sample data exists (seeded by `TaskService.initialize_sample_data()`).
- Use shared helpers like `waitForAppToLoad` for deterministic assertions.

## Conventions

- **Grokking Simplicity**: Actions (I/O) in services/handlers, calculations pure (formatting, stats), data as plain objects/state.
- **A Philosophy of Software Design**: Favor deep modules. Extend `TaskService` rather than sprinkling logic across routes.
- **Doc updates**: When changing architecture (operation decorators, REST/MCP flow, feature structure), update `README.md` and `docs/UNIFIED_ARCHITECTURE.md`.

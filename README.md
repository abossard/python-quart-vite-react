# Quart + Vite + React Demo Application

> A teaching-oriented full-stack sample that pairs a Python Quart backend with a React + FluentUI frontend, real-time Server-Sent Events (SSE), and Playwright tests.

## Why this repo?
- Shows how to keep REST and MCP JSON-RPC in a single Quart process
- Demonstrates “Grokking Simplicity” (actions vs. calculations vs. data) and “A Philosophy of Software Design” (deep modules)
- Provides an approachable playground for FluentUI v9, Vite, and Playwright

## Tech stack at a glance
- Backend: Quart, Pydantic 2, MCP JSON-RPC, Async SSE (`backend/app.py`)
- Business logic: `TaskService` + models in `backend/tasks.py`
- Frontend: React 18, Vite, FluentUI components, feature-first structure under `frontend/src/features`
- Tests: Playwright E2E (`tests/e2e/app.spec.js`)

## 5-minute quick start (TL;DR)
1. Clone the repo: `git clone <your-fork-url> && cd python-quart-vite-react`
2. Run the automated bootstrap: `./setup.sh` (creates the backend venv, installs frontend deps, installs Playwright)
3. Start both servers: `./start-dev.sh` *(or)* use the VS Code “Full Stack: Backend + Frontend” launch config
4. Open `http://localhost:3001`, switch to the **Tasks** tab, and create a task—the backend and frontend are now synced
5. (Optional) Run the Playwright suite from the repo root: `npm run test:e2e`

## Detailed setup (first-time users)

### 1. Backend requirements
- Python 3.10+
- `cd backend && python3 -m venv venv`
- `source venv/bin/activate`
- `pip install -r requirements.txt`

### 2. Frontend requirements
- Node.js 18+
- `cd frontend && npm install`

### 3. Playwright tooling (from repo root)
```bash
npm install          # installs Playwright runner
npx playwright install chromium
```
> Debian/Ubuntu users may also need `npx playwright install-deps` for browser libs.

## Run & verify

### Option A — Manual terminals
1. **Backend:** `cd backend && source venv/bin/activate && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`

### Option B — Helper script
`./start-dev.sh` (verifies dependencies, starts both servers, stops on Ctrl+C)

### Option C — VS Code
Use the “Full Stack: Backend + Frontend” launch config to start backend + frontend with attached debuggers.

### Smoke test checklist
- Visit `http://localhost:3001`
- Dashboard tab should show a ticking clock (SSE via `/api/time-stream`)
- Tasks tab should show three sample tasks (seeded by `TaskService.initialize_sample_data()`)
- Create a task, mark it complete, delete it—confirm state updates instantly

## Using the app
- **Dashboard tab:** Streams `{"time","date","timestamp"}` via EventSource; connection errors show inline.
- **Tasks tab:** Uses FluentUI `DataGrid` + dialogs; `frontend/src/features/tasks/TaskList.jsx` keeps calculations (`getTaskStats`) separate from actions (API calls).
- **About tab:** Summarizes tech choices and linkable resources.

## Architecture cheat sheet
- Shows how to keep REST and MCP JSON-RPC in a single Quart process
- Demonstrates “Grokking Simplicity” (actions vs. calculations vs. data) and “A Philosophy of Software Design” (deep modules)
- Provides an approachable playground for FluentUI v9, Vite, and Playwright
        ↓
TaskService + Pydantic models (backend/tasks.py)

- Backend: Quart, Pydantic 2, MCP JSON-RPC, Async SSE (`backend/app.py`)
- Business logic: `TaskService` + models in `backend/tasks.py`
- Frontend: React 18, Vite, FluentUI components, feature-first structure under `frontend/src/features`
- Tests: Playwright E2E (`tests/e2e/app.spec.js`)
- `TaskService` methods are “deep”: they validate, mutate `_tasks_db`, and return `Task` models—no need for extra helpers.
- Frontend features live under `frontend/src/features/*`, each with their own state, calculations, and FluentUI layout; all network requests go through `frontend/src/services/api.js` (`fetchJSON` centralizes error handling).

1. Clone the repo: `git clone <your-fork-url> && cd python-quart-vite-react`
2. Run the automated bootstrap: `./setup.sh` (creates the backend venv, installs frontend deps, installs Playwright)
3. Start both servers: `./start-dev.sh` *(or)* use the VS Code “Full Stack: Backend + Frontend” launch config
4. Open `http://localhost:3001`, switch to the **Tasks** tab, and create a task—the backend and frontend are now synced
5. (Optional) Run the Playwright suite from the repo root: `npm run test:e2e`
- Each tool schema is auto-generated from the `@operation` signature + Pydantic models—change it once, both REST and MCP update.

## Everyday developer workflow
1. Start servers (script or terminals)

- Python 3.10+
- `cd backend && python3 -m venv venv`
- `source venv/bin/activate`
- `pip install -r requirements.txt`
### Helpful commands
- Reseed sample data: restart the backend (or call `TaskService.initialize_sample_data()` in a shell)

- Node.js 18+
- `cd frontend && npm install`

## Testing

```bash
npm install          # installs Playwright runner
npx playwright install chromium
```
  - `npm run test:e2e:ui`
  - `npx playwright test tests/e2e/app.spec.js --project=chromium`
- Tests rely on:
  - Sample tasks being present
  - Stable `data-testid` attributes in the React components
  - SSE payload shape `{ time, date, timestamp }`

1. **Backend:** `cd backend && source venv/bin/activate && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`

| Issue | Fix |

`./start-dev.sh` (verifies dependencies, starts both servers, stops on Ctrl+C)
| Port 5001 in use | `sudo lsof -i :5001` then kill the process (macOS uses 5000 for AirPlay, so backend defaults to 5001) |
| `source venv/bin/activate` fails | Recreate the env: `rm -rf backend/venv && python3 -m venv backend/venv && pip install -r backend/requirements.txt` |

Use the “Full Stack: Backend + Frontend” launch config to start backend + frontend with attached debuggers.
| `npm install` errors | `npm cache clean --force && rm -rf node_modules package-lock.json && npm install` |
| Playwright browser install fails | `sudo npx playwright install-deps && npx playwright install` |

- Visit `http://localhost:3001`
- Dashboard tab should show a ticking clock (SSE via `/api/time-stream`)
- Tasks tab should show three sample tasks (seeded by `TaskService.initialize_sample_data()`)
- Create a task, mark it complete, delete it—confirm state updates instantly
  1. Add a `priority` field to the Pydantic models + UI
  2. Extend the SSE stream to broadcast task stats (remember to update `connectToTimeStream` consumers)

  3. Persist data with SQLite or Postgres instead of `_tasks_db`
  4. Add more Playwright specs (filters, SSE error handling, MCP flows)

Happy coding! 🎉

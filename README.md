# Quart + Vite + React Demo Application

**Current Task:** Document usecase demo ideas from the CSV-backed ticket dataset and build/iterate pages like `/usecase_demo_1` where each demo page has:
- a short summary
- editable agent prompt(s)
- a button that launches the agent run in background
- visible results (table/visualization)

> A teaching-oriented full-stack sample that pairs a Python Quart backend with a React + FluentUI frontend, real-time Server-Sent Events (SSE), and Playwright tests.

## Why this repo?
- Shows how to keep REST and MCP JSON-RPC in a single Quart process
- Demonstrates “Grokking Simplicity” (actions vs. calculations vs. data) and “A Philosophy of Software Design” (deep modules)
- Provides an approachable playground for FluentUI v9, Vite, and Playwright

## Tech stack at a glance
- Backend: Quart, Pydantic 2, MCP JSON-RPC, Async SSE (`backend/app.py`)
- Business logic: `TaskService` + models in `backend/tasks.py`
- LLM Integration: OpenAI (`backend/llm_service.py`)
- Frontend: React 18, Vite, FluentUI components, feature-first structure under `frontend/src/features`
- Tests: Playwright E2E (`tests/e2e/app.spec.js`)

## Documentation

All deep-dive guides now live under `docs/` for easier discovery:

- [Ubuntu Installation Guide](docs/INSTALL_UBUNTU.md) – complete prerequisites installation for Ubuntu 22.04 LTS
- [Quick Start](docs/QUICKSTART.md) – fastest path from clone to running servers
- [Learning Guide](docs/LEARNING.md) – principles behind the architecture and code style
- [Project Structure](docs/PROJECT_STRUCTURE.md) – file-by-file overview of the repo
- [Pydantic Architecture](docs/PYDANTIC_ARCHITECTURE.md) – how models, validation, and operations fit together
- [Unified Architecture](docs/UNIFIED_ARCHITECTURE.md) – REST + MCP integration details and extension ideas
- [Troubleshooting](docs/TROUBLESHOOTING.md) – common issues and fixes for setup, dev, and tests
- [CSV AI Guidance](docs/CSV_AI_GUIDANCE.md) – how AI agents should query and reason over CSV ticket data

### KBA Drafter Documentation

> **NEW:** LLM-powered Knowledge Base Article generator with OpenAI integration

- **[Feature Overview](docs/KBA_DRAFTER_OVERVIEW.md)** – Architecture, components, API endpoints, testing
- **[Quick Start](docs/KBA_DRAFTER_QUICKSTART.md)** – Fastest path to generating your first KBA
- **[Technical Guide](docs/KBA_DRAFTER.md)** – Complete implementation details
- **[Publishing Guide](docs/KBA_PUBLISHING.md)** – How to publish KBAs to different KB systems






## 5-minute quick start (TL;DR)
1. Clone the repo: `git clone <your-fork-url> && cd python-quart-vite-react`
2. Run the automated bootstrap: `./setup.sh` (creates the repo-level `.venv`, installs frontend deps, installs Playwright)
3. Configure OpenAI API key in `.env` for LLM features (see KBA Drafter documentation)
4. Start all servers: `./start-dev.sh` *(or)* use the VS Code "Full Stack: Backend + Frontend" launch config
5. Open `http://localhost:3001/usecase_demo_1` and start documenting your usecase demo idea on that page
6. Test KBA health endpoint: `curl http://localhost:5001/api/kba/health`
7. (Optional) Run the Playwright suite from the repo root: `npm run test:e2e`

## Detailed setup (first-time users)

### 1. Backend requirements
- Python 3.10+
- `python3 -m venv .venv`
- `source .venv/bin/activate`
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

### 4. OpenAI API Key (for KBA Drafter)

Add your OpenAI API key to `.env`:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

> The KBA Drafter requires OpenAI configured in `.env` to function.

## Run & verify

### Option A — Manual terminals
1. **Backend:** `source .venv/bin/activate && cd backend && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`
3. **OpenAI (for KBA Drafter):** Configure `.env` with `OPENAI_API_KEY` → enables LLM-powered KBA generation

### Option B — Helper script
`./start-dev.sh` (verifies dependencies, starts backend + frontend, stops all on Ctrl+C)

### Option C — VS Code
Use the “Full Stack: Backend + Frontend” launch config to start backend + frontend with attached debuggers.

### Smoke test checklist
- Visit `http://localhost:3001`
- Tickets tab should render CSV ticket table + stats from `/api/csv-tickets*`
- Usecase Demo tab (`/usecase_demo_1`) should show editable prompt + background run controls
- Fields tab should list mapped CSV fields from `/api/csv-tickets/fields`

## Docker (one command delivery)

Need everything in a single container? The repo now includes a multi-stage `Dockerfile` that builds the Vite frontend, copies the static assets next to the Quart app, and serves everything through Hypercorn on port `5001`.

```bash
docker build -t quart-react-demo .
docker run --rm -p 5001:5001 quart-react-demo
```

- The container exposes only the backend port; the frontend is served by Quart from the built assets, so open `http://localhost:5001`.
- Set `-e FRONTEND_DIST=/custom/path` if you mount a different build output at runtime.
- Hot reloading is not part of the container flow—use the regular dev servers for iterative work and Docker for demos or deployment.

## Using the app
- **Tickets tab (`/csvtickets`):** Shows CSV-backed ticket table, filtering, sorting, and pagination.
- **Usecase Demo tab (`/usecase_demo_1`):** Main demo page for documenting usecase demo ideas with editable prompts and background agent runs.
- **Fields tab (`/fields`):** Lists mapped CSV schema fields available to UI/MCP/agent flows.
- **Agent tab (`/agent`):** Chat-style agent interface for CSV ticket analysis.
- **KBA Drafter tab (`/kba-drafter`):** Generate Knowledge Base Articles from tickets using OpenAI

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
2. Run the automated bootstrap: `./setup.sh` (creates the repo-level `.venv`, installs frontend deps, installs Playwright)
3. Start both servers: `./start-dev.sh` *(or)* use the VS Code “Full Stack: Backend + Frontend” launch config
4. Open `http://localhost:3001`, switch to the **Tasks** tab, and create a task—the backend and frontend are now synced
5. (Optional) Run the Playwright suite from the repo root: `npm run test:e2e`
- Each tool schema is auto-generated from the `@operation` signature + Pydantic models—change it once, both REST and MCP update.

## Everyday developer workflow
1. Start servers (script or terminals)

- Python 3.10+
- `python3 -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r requirements.txt`
## Helpful npm commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all Playwright E2E tests |
| `npm run test:e2e:ui` | Run tests in interactive UI mode |
| `npm run test:e2e:report` | View test results report |

## Testing

The repo includes comprehensive E2E tests using Playwright:

```bash
# Run all tests
npm run test:e2e

# Interactive mode with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/app.spec.js --project=chromium

# View last test report
npm run test:e2e:report
```

**Test suites:**
- `tests/e2e/app.spec.js` — Dashboard, tasks, SSE streaming

Tests rely on:
- Sample tasks being present
- Stable `data-testid` attributes in the React components
- SSE payload shape `{ time, date, timestamp }`

1. **Backend:** `source .venv/bin/activate && cd backend && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 5001 in use | `sudo lsof -i :5001` then kill the process (macOS uses 5000 for AirPlay, so backend defaults to 5001) |
| `source .venv/bin/activate` fails | Recreate the env: `rm -rf .venv && python3 -m venv .venv && pip install -r backend/requirements.txt` |
| `npm install` errors | `npm cache clean --force && rm -rf node_modules package-lock.json && npm install` |
| Playwright browser install fails | `sudo npx playwright install-deps && npx playwright install` |
| OpenAI API errors | Check `.env` has valid `OPENAI_API_KEY`, verify at `curl http://localhost:5001/api/kba/health` |

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more detailed solutions.

## Extension ideas
1. Add a `priority` field to the Pydantic models + UI
2. Extend the SSE stream to broadcast task stats (remember to update `connectToTimeStream` consumers)
3. Persist data with SQLite or Postgres instead of `_tasks_db`
4. Add more Playwright specs (filters, SSE error handling, MCP flows)
5. **Smart task descriptions:** Use OpenAI to auto-generate task descriptions from titles
6. **Task summarization:** Summarize completed tasks using LLM
7. **KBA enhancements:** Add multi-language support, SharePoint integration

Happy coding! 🎉

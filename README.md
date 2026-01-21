# Quart + Vite + React Demo Application

**Task:** Visualize the CSV tickets with richer panels (status, priority, timeline, geography, SLA). **How would you like to view the tickets?**

> A teaching-oriented full-stack sample that pairs a Python Quart backend with a React + FluentUI frontend, real-time Server-Sent Events (SSE), and Playwright tests.

## Why this repo?
- Shows how to keep REST and MCP JSON-RPC in a single Quart process
- Demonstrates “Grokking Simplicity” (actions vs. calculations vs. data) and “A Philosophy of Software Design” (deep modules)
- Provides an approachable playground for FluentUI v9, Vite, and Playwright

## Tech stack at a glance
- Backend: Quart, Pydantic 2, MCP JSON-RPC, Async SSE (`backend/app.py`)
- Business logic: `TaskService` + models in `backend/tasks.py`
- LLM Integration: Ollama with local models (`backend/ollama_service.py`)
- Frontend: React 18, Vite, FluentUI components, feature-first structure under `frontend/src/features`
- Tests: Playwright E2E (`tests/e2e/app.spec.js`, `tests/e2e/ollama.spec.js`)

## Documentation

All deep-dive guides now live under `docs/` for easier discovery:

- [Ubuntu Installation Guide](docs/INSTALL_UBUNTU.md) – complete prerequisites installation for Ubuntu 22.04 LTS
- [Quick Start](docs/QUICKSTART.md) – fastest path from clone to running servers
- [Learning Guide](docs/LEARNING.md) – principles behind the architecture and code style
- [Project Structure](docs/PROJECT_STRUCTURE.md) – file-by-file overview of the repo
- [Pydantic Architecture](docs/PYDANTIC_ARCHITECTURE.md) – how models, validation, and operations fit together
- [Unified Architecture](docs/UNIFIED_ARCHITECTURE.md) – REST + MCP integration details and extension ideas
- [Troubleshooting](docs/TROUBLESHOOTING.md) – common issues and fixes for setup, dev, and tests






## 5-minute quick start (TL;DR)
1. Clone the repo: `git clone <your-fork-url> && cd python-quart-vite-react`
2. Run the automated bootstrap: `./setup.sh` (creates the repo-level `.venv`, installs frontend deps, installs Playwright, checks for Ollama)
3. (Optional) Install Ollama for LLM features: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2:1b`
4. Start all servers: `./start-dev.sh` *(or)* use the VS Code "Full Stack: Backend + Frontend" launch config
5. Open `http://localhost:3001`, switch to the **Tasks** tab, and create a task—the backend and frontend are now synced
6. (Optional) Test Ollama integration: `curl -X POST http://localhost:5001/api/ollama/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"Say hello"}]}'`
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

### 4. Ollama (optional - for LLM features)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the lightweight model
ollama pull llama3.2:1b

# Verify installation
ollama list
```

The app works without Ollama, but LLM endpoints (`/api/ollama/*`) will return 503 errors. For production use, consider:
- **llama3.2:1b** (~1.3GB) — Fast, good for testing and simple tasks
- **llama3.2:3b** (~2GB) — Better quality, still fast
- **qwen2.5:3b** (~2GB) — Alternative with strong performance

> The `setup.sh` script checks for Ollama and provides installation instructions if not found.

## Run & verify

### Option A — Manual terminals
1. **Backend:** `source .venv/bin/activate && cd backend && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`
3. **Ollama (optional):** `ollama serve` → runs LLM server on `http://localhost:11434`

### Option B — Helper script
`./start-dev.sh` (verifies dependencies, starts backend + frontend + Ollama if available, stops all on Ctrl+C)

### Option C — VS Code
Use the “Full Stack: Backend + Frontend” launch config to start backend + frontend with attached debuggers.

### Smoke test checklist
- Visit `http://localhost:3001`
- Dashboard tab should show a ticking clock (SSE via `/api/time-stream`)
- Tasks tab should show three sample tasks (seeded by `TaskService.initialize_sample_data()`)
- Create a task, mark it complete, delete it—confirm state updates instantly

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
- **Dashboard tab:** Streams `{"time","date","timestamp"}` via EventSource; connection errors show inline.
- **Tasks tab:** Uses FluentUI `DataGrid` + dialogs; `frontend/src/features/tasks/TaskList.jsx` keeps calculations (`getTaskStats`) separate from actions (API calls).
- **About tab:** Summarizes tech choices and linkable resources.
- **Ollama API (backend only):**
  - `POST /api/ollama/chat` — Chat with local LLM (supports conversation history)
  - `GET /api/ollama/models` — List available models
  - Also exposed via MCP tools: `ollama_chat`, `list_ollama_models`

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
| `npm run ollama:pull` | Download llama3.2:1b model |
| `npm run ollama:start` | Start Ollama server manually |
| `npm run ollama:status` | Check if Ollama is running |

## Example Ollama API calls

```bash
# List available models
curl http://localhost:5001/api/ollama/models

# Simple chat
curl -X POST http://localhost:5001/api/ollama/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is Python?"}
    ],
    "model": "llama3.2:1b",
    "temperature": 0.7
  }'

# Conversation with history
curl -X POST http://localhost:5001/api/ollama/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Nice to meet you, Alice!"},
      {"role": "user", "content": "What is my name?"}
    ],
    "model": "llama3.2:1b"
  }'

# Via MCP JSON-RPC
curl -X POST http://localhost:5001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ollama_chat",
      "arguments": {
        "messages": [{"role": "user", "content": "Hello!"}]
      }
    },
    "id": 1
  }'
```

- Node.js 18+
- `cd frontend && npm install`

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
- `tests/e2e/ollama.spec.js` — LLM chat, model listing, validation (requires Ollama)

Tests rely on:
- Sample tasks being present
- Stable `data-testid` attributes in the React components
- SSE payload shape `{ time, date, timestamp }`
- Ollama running on `localhost:11434` with `llama3.2:1b` model (for Ollama tests)

1. **Backend:** `source .venv/bin/activate && cd backend && python app.py` → serves REST + MCP on `http://localhost:5001`
2. **Frontend:** `cd frontend && npm run dev` → launches Vite dev server on `http://localhost:3001`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 5001 in use | `sudo lsof -i :5001` then kill the process (macOS uses 5000 for AirPlay, so backend defaults to 5001) |
| `source .venv/bin/activate` fails | Recreate the env: `rm -rf .venv && python3 -m venv .venv && pip install -r backend/requirements.txt` |
| `npm install` errors | `npm cache clean --force && rm -rf node_modules package-lock.json && npm install` |
| Playwright browser install fails | `sudo npx playwright install-deps && npx playwright install` |
| Ollama not found | Install: `curl -fsSL https://ollama.com/install.sh \| sh` then `ollama pull llama3.2:1b` |
| Ollama connection error | Start server: `ollama serve` or check if running: `curl http://localhost:11434/api/tags` |
| LLM responses are slow | Try a smaller model (`llama3.2:1b` is fastest) or ensure GPU acceleration is enabled |

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more detailed solutions.

## Extension ideas
1. Add a `priority` field to the Pydantic models + UI
2. Extend the SSE stream to broadcast task stats (remember to update `connectToTimeStream` consumers)
3. Persist data with SQLite or Postgres instead of `_tasks_db`
4. Add more Playwright specs (filters, SSE error handling, MCP flows)
5. **Build a chat UI:** Create `frontend/src/features/ollama/OllamaChat.jsx` with FluentUI components and connect to `/api/ollama/chat`
6. **Smart task descriptions:** Use Ollama to auto-generate task descriptions from titles
7. **Task summarization:** Summarize completed tasks using LLM
8. **Multi-model comparison:** Let users select different Ollama models and compare responses

Happy coding! 🎉

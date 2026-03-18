# Project Structure

Complete overview of the actual files and directories in this project.

## Backend

```
backend/
├── app.py                       # Quart app — REST routes + Blueprint registration
├── agent_builder/               # Config-driven agent module (see docs/AGENT_BUILDER.md)
│   ├── __init__.py              # Public API facade
│   ├── models/                  # Pure data (Pydantic/SQLModel)
│   │   ├── agent.py             # AgentDefinition, Create/Update DTOs
│   │   ├── run.py               # AgentRun, RunStatus
│   │   ├── evaluation.py        # AgentEvaluation, SuccessCriteria
│   │   └── chat.py              # AgentRequest/Response
│   ├── tools/                   # Tool layer
│   │   ├── registry.py          # ToolRegistry (dependency injection)
│   │   ├── schema_converter.py  # JSON Schema → Pydantic
│   │   └── mcp_adapter.py       # MCP tool → LangChain adapter
│   ├── engine/                  # Execution engine
│   │   ├── react_runner.py      # Build & invoke ReAct agents
│   │   ├── prompt_builder.py    # System prompt composition
│   │   └── callbacks.py         # LLM & tool call logging
│   ├── evaluator.py             # Success criteria evaluation
│   ├── service.py               # WorkbenchService (deep module)
│   ├── chat_service.py          # ChatService (deep module)
│   ├── persistence/             # Database layer
│   │   ├── database.py          # SQLite engine + migrations
│   │   └── repository.py        # Agent/Run/Evaluation CRUD
│   ├── routes.py                # Quart Blueprint (/api/workbench/*)
│   └── tests/                   # 132 tests (pytest)
│       ├── test_models.py       # Model validation
│       ├── test_evaluator.py    # Criteria evaluation
│       ├── test_registry.py     # ToolRegistry
│       ├── test_prompt_builder.py
│       ├── test_schema_converter.py
│       ├── test_engine.py       # extract_tools_used
│       ├── test_service.py      # WorkbenchService CRUD
│       ├── test_persistence.py  # Repository layer
│       └── test_e2e.py          # Full REST API flow
├── agent_workbench/             # Backward-compat shim (re-exports from agent_builder)
│   └── __init__.py
├── agents.py                    # Legacy chat agent (AgentService for /api/agents/run)
├── operations.py                # @operation definitions — REST + MCP + LangChain tools
├── api_decorators.py            # Unified @operation decorator system
├── csv_data.py                  # CSVTicketService — loads/queries csv/data.csv
├── tickets.py                   # Ticket Pydantic models + enums
├── tasks.py                     # Task models + TaskService (in-memory)
├── mcp_handler.py               # MCP JSON-RPC request routing
├── workbench_integration.py     # Wires project tools into agent_builder services
├── usecase_demo.py              # Background agent run service for demo pages
├── data/                        # SQLite databases (gitignored)
├── tests/                       # Backend tests (pytest)
│   ├── test_agents.py           # Operation registry + LangChain integration
│   ├── test_tickets.py          # CSV ticket parsing + SLA logic
│   ├── test_usecase_demo.py     # Demo run service
│   └── test_workbench_integration_e2e.py  # Original E2E test
└── requirements.txt             # Python dependencies
```

## Frontend

```
frontend/
├── src/
│   ├── App.jsx                  # Root component — tab navigation + routing
│   ├── main.jsx                 # React entry point
│   ├── index.css                # Global styles
│   ├── features/                # Feature modules (one per tab)
│   │   ├── workbench/           # Agent Fabric — create/run/evaluate agents
│   │   │   └── WorkbenchPage.jsx
│   │   ├── agent/               # Agent Chat — one-shot conversation
│   │   │   └── AgentChat.jsx
│   │   ├── csvtickets/          # CSV Ticket Table — browse/filter/paginate
│   │   │   └── CSVTicketTable.jsx
│   │   ├── tickets/             # Ticket Visualizations (Nivo charts)
│   │   │   ├── NivoTicketsDemo.jsx
│   │   │   ├── SankeyTicketsDemo.jsx
│   │   │   ├── StreamTicketsDemo.jsx
│   │   │   └── TicketsWithoutAnAssignee.jsx
│   │   ├── usecase-demo/        # Pre-built demo pages
│   │   │   ├── UsecaseDemoPage.jsx
│   │   │   ├── demoDefinitions.js
│   │   │   ├── resultViews/
│   │   │   └── utils/
│   │   ├── dashboard/           # Dashboard with SSE streaming
│   │   │   └── Dashboard.jsx
│   │   ├── fields/              # CSV field documentation
│   │   │   └── FieldsDocs.jsx
│   │   ├── kitchensink/         # FluentUI component showcase
│   │   │   └── KitchenSink.jsx
│   │   └── tasks/               # Task management UI
│   │       ├── TaskList.jsx
│   │       └── TaskDialog.jsx
│   ├── components/              # Shared components
│   │   └── About.jsx
│   └── services/
│       └── api.js               # Backend API client (fetchJSON helper)
├── index.html                   # HTML entry point
├── vite.config.js               # Vite build config (proxy to backend:5001)
└── package.json                 # Dependencies + scripts
```

## Tests

```
tests/
└── e2e/                         # Playwright E2E tests
    ├── app.spec.js              # App shell, tickets, usecase demo, agent
    ├── workbench.spec.js        # Agent Fabric create/run/delete
    ├── menu-screenshots.spec.js # Capture menu screenshots
    └── debug.spec.js            # Smoke test
```

## Docs

```
docs/
├── AGENT_BUILDER.md             # Agent builder architecture (mermaid diagrams)
├── AGENTS.md                    # LangGraph agent setup + config
├── CSV_AI_GUIDANCE.md           # How agents query CSV data
├── INSTALL_UBUNTU.md            # Ubuntu 22.04 prerequisites
├── LEARNING.md                  # Design principles guide
├── LEVEL_UP.md                  # Day 4 teaching material
├── NIVO.md                      # Nivo chart visualization guide
├── PROJECT_STRUCTURE.md         # This file
├── PYDANTIC_ARCHITECTURE.md     # Pydantic patterns
├── QUICKSTART.md                # 5-minute setup
├── TROUBLESHOOTING.md           # Common issues + fixes
├── UNIFIED_ARCHITECTURE.md      # REST + MCP via @operation
└── ticker_reminder/             # Feature spec (ticket reminders)
    ├── RULES.md                 # German version
    └── RULES_EN.md              # English version
```

## Config Files

| File | Purpose |
|------|---------|
| `setup.sh` | Automated bootstrap (venv, deps, Playwright) |
| `start-dev.sh` | Start backend + frontend + Ollama |
| `playwright.config.js` | E2E test config (3 browsers, web servers) |
| `Dockerfile` | Multi-stage build for deployment |
| `.env.example` | OpenAI API key template |
| `package.json` (root) | Playwright + npm scripts |

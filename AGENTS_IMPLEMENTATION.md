# LangGraph Agent Implementation - Summary

> **Note:** The agent system has been refactored into `backend/agent_builder/` — a standalone, extensible module. See **[docs/AGENT_BUILDER.md](docs/AGENT_BUILDER.md)** for the current architecture, mermaid diagrams, and API reference.

## Current Architecture

```
backend/agent_builder/     ← canonical module (new)
backend/agent_workbench/   ← backward-compat shim (re-exports from agent_builder)
backend/agents.py          ← legacy chat agent (still used for /api/agents/run)
```

## What Was Built

### Agent Builder Module (`backend/agent_builder/`)

- **Models**: `AgentDefinition`, `AgentRun`, `AgentEvaluation` — pure Pydantic/SQLModel data
- **Engine**: Unified ReAct runner, prompt builder, LLM callbacks
- **Tools**: `ToolRegistry` for dependency injection, schema converter, MCP adapter
- **Evaluator**: Success criteria (no_error, tool_called, output_contains, llm_judge)
- **Persistence**: SQLite via repository pattern with migrations
- **Services**: `WorkbenchService` (CRUD + run + eval), `ChatService` (one-shot)
- **Routes**: Quart Blueprint registered in `app.py` with one line
- **Tests**: 132 tests (unit + integration + E2E)

### Key Features

- **Config-driven agents** — model, temperature, recursion_limit, max_tokens, output_schema all stored per-agent in DB
- **Always-structured output** — every agent returns typed JSON via LangGraph `response_format` (default: `{message, referenced_tickets}`)
- **Suggest Schema** — LLM proposes a JSON Schema from agent description
- **Per-agent LLM** — each agent can override model/temperature/max_tokens
- **132 tests** covering models, evaluator, registry, prompt builder, schema converter, service CRUD, and E2E REST flows

## Quick Start

```bash
# Run backend tests
cd backend && ./venv/bin/python -m pytest agent_builder/tests/ -v

# Run Playwright browser tests
npx playwright test tests/e2e/workbench.spec.js --project=chromium
```

## Full Documentation

→ **[docs/AGENT_BUILDER.md](docs/AGENT_BUILDER.md)**

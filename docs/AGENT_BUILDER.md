# Agent Builder

A self-contained, extensible module for building, running, and evaluating LLM-powered agents from configuration stored in a database.

## Architecture

```mermaid
graph TB
    subgraph "Frontend (React)"
        UI[WorkbenchPage.jsx]
        API[api.js]
        UI --> API
    end

    subgraph "HTTP Layer"
        BP[routes.py<br/>Quart Blueprint]
    end

    subgraph "agent_builder/"
        subgraph "Services (Deep Modules)"
            WS[WorkbenchService<br/>CRUD + Run + Eval]
            CS[ChatService<br/>One-shot chat]
        end

        subgraph "Engine"
            RR[react_runner.py<br/>Build & invoke agents]
            PB[prompt_builder.py<br/>Compose prompts]
            CB[callbacks.py<br/>LLM & tool logging]
        end

        subgraph "Models (Pure Data)"
            MA[agent.py<br/>AgentDefinition]
            MR[run.py<br/>AgentRun]
            ME[evaluation.py<br/>AgentEvaluation]
            MC[chat.py<br/>Request/Response]
        end

        subgraph "Persistence"
            DB[(SQLite)]
            RP[repository.py]
            DM[database.py<br/>Migrations]
            RP --> DB
            DM --> DB
        end

        subgraph "Tools"
            TR[ToolRegistry]
            SC[schema_converter.py]
        end

        EV[evaluator.py]
    end

    subgraph "External"
        LLM[OpenAI / LLM Provider]
    end

    API -->|HTTP| BP
    BP --> WS
    BP --> CS
    WS --> RR
    WS --> EV
    WS --> RP
    CS --> RR
    RR --> PB
    RR --> CB
    RR --> TR
    RR -->|response_format| LLM
    WS --> TR
```

## Data Flow: Agent Run

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant R as routes.py
    participant S as WorkbenchService
    participant DB as SQLite
    participant E as react_runner
    participant LLM as OpenAI

    UI->>R: POST /api/workbench/agents/{id}/runs
    R->>S: run_agent(agent_id, run_request)
    S->>DB: Load AgentDefinition
    DB-->>S: {system_prompt, tools, model, temperature, output_schema, ...}
    S->>DB: Create AgentRun (status=RUNNING)

    Note over S: Resolve per-agent LLM config
    S->>E: build_react_agent(llm, tools, prompt, response_format)
    E->>LLM: ReAct loop (reason → act → observe)
    LLM-->>E: structured_response + messages

    E-->>S: output, tools_used
    S->>DB: Update AgentRun (status=COMPLETED, output)
    S-->>R: AgentRun
    R-->>UI: JSON response
```

## Structured Output Pipeline

Every agent returns typed, structured output — never raw strings.

```mermaid
flowchart LR
    A[AgentDefinition<br/>in DB] --> B{has output_schema<br/>with properties?}
    B -->|Yes| C[Custom Schema]
    B -->|No| D[Default Schema]

    C --> E[response_format parameter<br/>→ create_react_agent]
    D --> E

    E --> F[LangGraph SDK<br/>enforces schema]
    F --> G[structured_response]

    subgraph "Default Schema"
        D1[message: string<br/>GitHub Markdown]
        D2[referenced_tickets: string array<br/>Ticket IDs looked at]
    end
    D --- D1
    D --- D2
```

**Default output** (no custom schema):
```json
{
  "message": "## Analysis\nFound 3 critical tickets...",
  "referenced_tickets": ["INC-001", "INC-042", "INC-187"]
}
```

**Custom output** (with `output_schema`):
```json
{
  "breaches": [
    {"ticket_id": "INC-001", "sla_hours": 72, "breach_reason": "No assignment"}
  ],
  "total": 1
}
```

## Module Structure

```
backend/agent_builder/
├── __init__.py              # Public API facade
├── models/
│   ├── agent.py             # AgentDefinition, Create/Update DTOs
│   ├── run.py               # AgentRun, RunStatus
│   ├── evaluation.py        # Evaluation, SuccessCriteria, CriteriaType
│   └── chat.py              # AgentRequest/Response (simple chat)
├── tools/
│   ├── registry.py          # ToolRegistry (dependency injection)
│   ├── schema_converter.py  # JSON Schema → Pydantic (calculation)
│   └── mcp_adapter.py       # MCP tool → LangChain adapter
├── engine/
│   ├── react_runner.py      # Build & invoke ReAct agents
│   ├── prompt_builder.py    # System prompt composition (calculation)
│   └── callbacks.py         # LLM & tool call logging
├── evaluator.py             # Success criteria evaluation
├── service.py               # WorkbenchService (deep module)
├── chat_service.py          # ChatService (deep module)
├── persistence/
│   ├── database.py          # SQLite engine + migrations
│   └── repository.py        # Agent/Run/Evaluation CRUD
├── routes.py                # Quart Blueprint (/api/workbench/*)
└── tests/                   # 132 tests
```

## Design Principles

### Grokking Simplicity: Data / Calculations / Actions

```mermaid
graph LR
    subgraph "Data (no behavior)"
        M1[AgentDefinition]
        M2[AgentRun]
        M3[SuccessCriteria]
    end

    subgraph "Calculations (pure, no I/O)"
        C1[prompt_builder]
        C2[schema_converter]
        C3[evaluator<br/>NO_ERROR, TOOL_CALLED,<br/>OUTPUT_CONTAINS]
        C4[extract_tools_used]
    end

    subgraph "Actions (I/O)"
        A1[react_runner<br/>LLM calls]
        A2[repository<br/>DB writes]
        A3[routes<br/>HTTP]
        A4[evaluator<br/>LLM_JUDGE only]
    end

    M1 --> C1
    M1 --> A1
    M2 --> C3
    C1 --> A1
    A1 --> A2
    A3 --> A2
```

### A Philosophy of Software Design: Deep Modules

| Module | Public API | Hidden Complexity |
|--------|-----------|-------------------|
| **WorkbenchService** | `create_agent`, `run_agent`, `evaluate_run` | DB sessions, LLM wiring, tool resolution, per-agent config, snapshot capture, structured output extraction |
| **ChatService** | `run_agent(request)` | LLM setup, prompt building, ReAct execution, tool logging |
| **ToolRegistry** | `register`, `resolve` | Name validation, deduplication, missing-tool tolerance |
| **Quart Blueprint** | 15 routes, 1 `register_blueprint()` call | Error handling, JSON marshaling, validation |

## Agent Definition (DB Schema)

```mermaid
erDiagram
    AgentDefinition {
        string id PK
        string name
        string description
        string system_prompt
        boolean requires_input
        string required_input_description
        string model "LLM override"
        float temperature "0.0-2.0"
        int recursion_limit "max ReAct loops (default 3)"
        int max_tokens "response cap (default 4096)"
        string output_instructions "free-text format hint"
        json output_schema "JSON Schema for structured output"
        json tool_names "available tools"
        json success_criteria "evaluation rules"
        datetime created_at
        datetime updated_at
    }

    AgentRun {
        string id PK
        string agent_id FK
        string input_prompt
        string status "pending|running|completed|failed"
        string output
        json agent_snapshot "frozen config at run time"
        json tools_used
        string error
        datetime created_at
        datetime completed_at
    }

    AgentEvaluation {
        string id PK
        string run_id FK
        json criteria_results
        boolean overall_passed
        float score "0.0-1.0"
        datetime evaluated_at
    }

    AgentDefinition ||--o{ AgentRun : "has runs"
    AgentRun ||--o| AgentEvaluation : "has evaluation"
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workbench/ui-config` | UI metadata, enums, defaults, default schema |
| GET | `/api/workbench/tools` | Available tools with input schemas |
| POST | `/api/workbench/suggest-schema` | LLM-powered schema suggestion |
| GET | `/api/workbench/agents` | List all agents |
| POST | `/api/workbench/agents` | Create agent |
| GET | `/api/workbench/agents/{id}` | Get agent |
| PUT | `/api/workbench/agents/{id}` | Update agent |
| DELETE | `/api/workbench/agents/{id}` | Delete agent |
| POST | `/api/workbench/agents/{id}/runs` | Run agent |
| GET | `/api/workbench/agents/{id}/runs` | List runs for agent |
| GET | `/api/workbench/runs` | List all runs |
| GET | `/api/workbench/runs/{id}` | Get run |
| POST | `/api/workbench/runs/{id}/evaluate` | Evaluate run |
| GET | `/api/workbench/runs/{id}/evaluation` | Get evaluation |
| POST | `/api/agents/run` | Simple chat agent |

## Extensibility

```mermaid
flowchart TB
    subgraph "Add New Tool Source"
        T1[Write StructuredTool] --> T2[registry.register]
    end

    subgraph "Add New Criteria Type"
        C1[Add to CriteriaType enum] --> C2[Add branch in evaluator.py]
    end

    subgraph "Add New Agent Type"
        A1[New system_prompt + tools] --> A2[POST /api/workbench/agents]
    end

    subgraph "Custom Output Format"
        O1[Define JSON Schema] --> O2[Set output_schema on agent]
        O2 --> O3[SDK enforces at runtime]
    end

    subgraph "Different LLM Per Agent"
        L1[Set model field] --> L2[Per-agent ChatOpenAI built at runtime]
    end
```

## Testing

```bash
# Unit + integration tests (132 tests, ~6s)
cd backend && ./venv/bin/python -m pytest agent_builder/tests/ -v

# Original E2E tests
./venv/bin/python -m pytest tests/ -v

# Playwright browser tests (15 tests, ~8s)
npx playwright test --project=chromium

# All together
./venv/bin/python -m pytest agent_builder/tests/ tests/ -v && npx playwright test --project=chromium
```

## Backward Compatibility

`agent_workbench/` still works as a shim:
```python
# Old import (still works)
from agent_workbench import WorkbenchService, ToolRegistry

# New import (canonical)
from agent_builder import WorkbenchService, ToolRegistry
```

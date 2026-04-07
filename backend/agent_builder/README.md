# Agent Builder

A portable, config-driven LLM agent package built on LangGraph. Define agents (system prompt, tools, output schema) via API or UI, persist them in any database, and run them as ReAct agents with real-time SSE streaming.

**Zero provider coupling** — the host injects an LLM factory; the package never imports any LLM provider directly.

**Pluggable storage** — persistence is behind a `RepositoryProtocol`. Ships with `SqliteRepository` (stdlib `sqlite3`, zero deps). Bring your own `PostgresRepository`, etc.

## Integration Checklist

```
☐  1. Copy agent_builder/ into your project
☐  2. Install dependencies (see below)
☐  3. Write an LLM factory function
☐  4. Create a ToolRegistry and register your tools
☐  5. Create a repository (SqliteRepository or PostgresRepository)
☐  6. Call configure_agent_builder_blueprint() with the 3 essentials
☐  7. Register agent_builder_blueprint on your Quart app
```

## Step-by-Step

### 1. Install Dependencies

```
langchain-core        # Tool types, callback base
langgraph             # ReAct agent
pydantic>=2           # Data models
ag-ui-protocol        # AG-UI event types (optional)
```

No ORM required — `SqliteRepository` uses Python's stdlib `sqlite3`.

### 2. Write an LLM Factory

The factory receives an `LLMConfig` and returns any LangChain `BaseChatModel`:

```python
from langchain_openai import ChatOpenAI
from agent_builder import LLMConfig

def my_llm_factory(config: LLMConfig):
    return ChatOpenAI(
        model=config.model or "gpt-4o-mini",
        api_key=config.api_key or os.getenv("OPENAI_API_KEY"),
        temperature=config.temperature,
    )
```

`LLMConfig` fields: `model`, `temperature`, `max_tokens`, `api_key`, `base_url`, `reasoning_effort`, `extra`.

### 3. Register Your Tools

```python
from agent_builder import ToolRegistry
from langchain_core.tools import StructuredTool

registry = ToolRegistry()
registry.register(my_tool)          # single tool
registry.register_all(my_tools)     # list of tools
```

Tools must be LangChain `StructuredTool` instances (or anything with a `.name` attribute).

### 4. Configure the Blueprint (single call)

```python
from agent_builder.routes import agent_builder_blueprint, configure_agent_builder_blueprint
from agent_builder.persistence.sqlite import SqliteRepository  # or PostgresRepository

repo = SqliteRepository(Path("data/agents.db"))

configure_agent_builder_blueprint(
    tool_registry=registry,
    llm_factory=my_llm_factory,
    repo=repo,
    # optional:
    # model_catalog_provider=my_catalog,     # also derives default_model
    # domain_context="My domain...",
    # system_prompt_builder=my_prompt_fn,    # custom chat agent prompt
)
```

This single call creates `WorkbenchService` and `ChatService` internally.
The `default_model` is derived from `model_catalog_provider()["default_model"]` if provided.

### 5. Register the Blueprint

```python
app.register_blueprint(agent_builder_blueprint)
```

That's it — the full REST API is now live under `/api/workbench/...`.

### 6. Implement a Custom Repository (optional)

To use a different database, implement the `RepositoryProtocol`:

```python
from agent_builder.persistence.protocol import RepositoryProtocol
from agent_builder.models import AgentDefinition, AgentRun, ...

class PostgresRepository:
    """Implements RepositoryProtocol using psycopg."""

    def __init__(self, conn_factory):
        self._conn_factory = conn_factory
        self._setup_tables()

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with self._conn_factory() as conn:
            conn.execute("INSERT INTO ...", ...)
        return agent

    # ... implement all methods from RepositoryProtocol
```

The protocol requires these methods:
- **Agents**: `create_agent`, `get_agent`, `list_agents`, `update_agent`, `delete_agent`
- **Runs**: `create_run`, `get_run`, `list_runs`, `update_run`, `delete_all_runs`
- **Evaluations**: `get_evaluation`, `upsert_evaluation`
- **Threads**: `create_thread`, `get_thread`, `list_threads`, `update_thread`, `delete_thread`
- **Messages**: `add_message`, `get_messages`

### 7. Or Call Services Directly

```python
from agent_builder import AgentDefinitionCreate, AgentRunCreate

agent = workbench.create_agent(AgentDefinitionCreate(
    name="My Agent",
    system_prompt="You analyze data and answer questions.",
    tool_names=["search", "calculate"],
))

run = await workbench.run_agent(agent.id, AgentRunCreate(
    input_prompt="What's the average order value?",
))
# run.status == RunStatus.COMPLETED
# run.output == "The average order value is $42.50..."
```

## Architecture

```
agent_builder/
├── __init__.py           # Public API exports
├── llm_protocol.py       # LLMConfig, LLMFactory protocol
├── service.py            # WorkbenchService — full agent lifecycle
├── chat_service.py       # ChatService — one-shot runs
├── evaluator.py          # Success criteria evaluation
├── fsm.py                # RunStatus state machine
├── routes.py             # Quart Blueprint (optional)
├── models/               # Pure Pydantic data models (no ORM)
│   ├── agent.py          # AgentDefinition, Create, Update
│   ├── run.py            # AgentRun, RunStatus, RunCreate
│   ├── evaluation.py     # AgentEvaluation, SuccessCriteria
│   ├── chat.py           # AgentRequest, AgentResponse
│   └── thread.py         # ConversationThread, ThreadMessage
├── engine/               # ReAct execution engine
│   ├── react_runner.py   # build + run ReAct agent
│   ├── prompt_builder.py # Output schema → prompt instructions
│   ├── event_bus.py      # SSE event broadcasting
│   ├── callbacks.py      # LangChain streaming callbacks
│   └── ag_ui_events.py   # AG-UI protocol helpers
├── persistence/          # Pluggable storage layer
│   ├── protocol.py       # RepositoryProtocol (abstract interface)
│   ├── sqlite.py         # SqliteRepository (stdlib sqlite3)
│   └── _json_helpers.py  # Safe JSON/datetime parsing
└── tools/                # Tool management
    ├── registry.py       # ToolRegistry
    ├── mcp_adapter.py    # MCP → LangChain converter
    └── schema_utils.py   # JSON Schema helpers
```

### Design Principles

- **No provider coupling**: the module never imports OpenAI, Anthropic, etc. The host passes an `LLMFactory`.
- **Deep modules**: `WorkbenchService` has a simple API but hides DB, LLM, SSE, and evaluation complexity.
- **FSM-validated state**: run status transitions are enforced by a finite state machine in `fsm.py`.

### Run Status FSM

```
PENDING ──START──► RUNNING ──COMPLETE──► COMPLETED
                      ├──FAIL──────────► FAILED
                      └──TRUNCATE──────► TRUNCATED
```

## API Reference (Blueprint Routes)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workbench/tools` | List registered tools |
| GET | `/api/workbench/ui-config` | UI metadata + model catalog |
| POST | `/api/workbench/suggest-schema` | LLM suggests output schema |
| POST | `/api/workbench/improve-prompt` | LLM improves system prompt |
| GET | `/api/workbench/agents` | List agents |
| POST | `/api/workbench/agents` | Create agent |
| GET | `/api/workbench/agents/:id` | Get agent |
| PUT | `/api/workbench/agents/:id` | Update agent |
| DELETE | `/api/workbench/agents/:id` | Delete agent |
| POST | `/api/workbench/agents/:id/runs` | Start run (returns 202) |
| GET | `/api/workbench/agents/:id/runs` | List runs for agent |
| GET | `/api/workbench/runs` | List all runs |
| GET | `/api/workbench/runs/:id` | Get run details |
| DELETE | `/api/workbench/runs` | Delete all runs |
| POST | `/api/workbench/runs/:id/evaluate` | Evaluate run |
| GET | `/api/workbench/runs/:id/evaluation` | Get evaluation |
| GET | `/api/workbench/events` | SSE stream (real-time) |
| GET | `/api/workbench/threads` | List threads |
| POST | `/api/workbench/threads/from-run/:id` | Create thread from run |
| GET | `/api/workbench/threads/:id` | Get thread + messages |
| DELETE | `/api/workbench/threads/:id` | Delete thread |

## Evaluation Criteria

Agents can define success criteria evaluated after a run:

| Type | Checks |
|------|--------|
| `NO_ERROR` | Run completed without error |
| `TOOL_CALLED` | Specific tool was invoked |
| `OUTPUT_CONTAINS` | Output contains substring |
| `LLM_JUDGE` | LLM grades output via custom prompt |

```python
evaluation = await workbench.evaluate_run(run.id)
# evaluation.score → 0.0–1.0
# evaluation.overall_passed → True/False
```

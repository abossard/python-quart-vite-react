# Agent Builder

A portable, config-driven LLM agent package built on LangGraph. Define agents (system prompt, tools, output schema) via API or UI, persist them in SQLite, and run them as ReAct agents with real-time SSE streaming.

**Zero provider coupling** — the host injects an LLM factory; the package never imports any LLM provider directly.

## Integration Checklist

```
☐  1. Copy agent_builder/ into your project
☐  2. Install dependencies (see below)
☐  3. Write an LLM factory function
☐  4. Create a ToolRegistry and register your tools
☐  5. Instantiate WorkbenchService (and optionally ChatService)
☐  6. Mount the Quart Blueprint (or call services directly)
```

## Step-by-Step

### 1. Install Dependencies

```
langchain-core        # Tool types, callback base
langgraph             # ReAct agent
langgraph-prebuilt    # Pre-built agent executor
sqlmodel              # SQLite persistence
pydantic>=2           # Data models
ag-ui-protocol        # AG-UI event types (optional)
```

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

### 4. Create Services

```python
from agent_builder import WorkbenchService, ChatService

workbench = WorkbenchService(
    tool_registry=registry,
    llm_factory=my_llm_factory,
    # db_path=Path("data/agents.db"),  # default: auto-created
    # default_model="gpt-4o-mini",
    # recursion_limit=10,
)

# Optional: simple one-shot chat agent
chat = ChatService(
    tool_registry=registry,
    llm_factory=my_llm_factory,
)
```

The database is auto-created and auto-migrated — no setup needed.

### 5. Mount Routes (Quart)

```python
from agent_builder.routes import agent_builder_bp, configure_blueprint

configure_blueprint(
    workbench_service=workbench,
    chat_service=chat,                     # optional
    model_catalog_provider=my_catalog,     # optional
)
app.register_blueprint(agent_builder_bp)
```

This exposes a full REST API under `/api/workbench/...` (see API Reference below).

### 6. Or Call Services Directly

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
├── models/               # Pydantic/SQLModel data models
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
├── persistence/          # SQLite storage (auto-created)
│   ├── database.py       # Engine builder + migrations
│   └── repository.py     # AgentRepository CRUD
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

# Agent Builder — Portable Module

Config-driven LLM agents built with LangGraph. Define agents (system prompt, tools, output schema), store them in SQLite, and run them as ReAct agents with real-time SSE streaming.

## Integration

The module is designed to be embedded in any Python application. The host provides:

1. **An LLM factory** — builds LangChain `BaseChatModel` from config
2. **A tool registry** — LangChain `StructuredTool` instances the agents can call
3. **Route mounting** — Quart Blueprint included, or wire your own routes

### Minimal Example

```python
from langchain_openai import ChatOpenAI
from agent_builder import (
    WorkbenchService, ChatService, ToolRegistry,
    LLMConfig, LLMFactory,
)
from agent_builder.routes import agent_builder_bp, configure_blueprint

# 1. LLM Factory — you decide which provider to use
def my_llm_factory(config: LLMConfig) -> ChatOpenAI:
    return ChatOpenAI(
        model=config.model or "gpt-4o-mini",
        api_key=config.api_key or os.getenv("OPENAI_API_KEY"),
        temperature=config.temperature,
    )

# 2. Tool Registry — register your LangChain tools
registry = ToolRegistry()
registry.register_all(my_tools)

# 3. Services
workbench = WorkbenchService(
    tool_registry=registry,
    llm_factory=my_llm_factory,
)
chat = ChatService(
    tool_registry=registry,
    llm_factory=my_llm_factory,
)

# 4. Mount routes (Quart)
configure_blueprint(workbench_service=workbench, chat_service=chat)
app.register_blueprint(agent_builder_bp)
```

## Architecture

```
agent_builder/
├── llm_protocol.py        # LLMFactory, LLMConfig — the host interface
├── fsm.py                 # RunStatus state machine (pure calculation)
├── models/                # Pydantic/SQLModel data models
├── engine/                # ReAct runner, prompt builder, callbacks, AG-UI events
├── tools/                 # ToolRegistry + MCP adapter + schema converter
├── persistence/           # SQLite repository + migrations
├── service.py             # WorkbenchService — full agent lifecycle
├── chat_service.py        # ChatService — one-shot agent runs
├── evaluator.py           # Success criteria evaluation
└── routes.py              # Quart Blueprint (optional)
```

### Design Principles

- **Grokking Simplicity**: data (models), calculations (FSM, prompt builder, evaluator), actions (service, persistence, engine)
- **Deep modules**: `WorkbenchService` has a simple API but hides DB, LLM, and evaluation complexity
- **No provider coupling**: the module never imports any LLM provider — the host passes a factory

### RunStatus FSM

Run status transitions are validated by a finite state machine:

```
PENDING ──START──► RUNNING ──COMPLETE──► COMPLETED
                      │
                      ├──FAIL──────────► FAILED
                      │
                      └──TRUNCATE──────► TRUNCATED
```

```python
from agent_builder import RunStatus, RunEvent, transition, InvalidTransition

status = transition(RunStatus.PENDING, RunEvent.START)  # → RUNNING
status = transition(status, RunEvent.COMPLETE)           # → COMPLETED

# Invalid transitions raise:
transition(RunStatus.COMPLETED, RunEvent.START)  # raises InvalidTransition
```

## Dependencies

- `langchain-core` (tool types, callback handler base)
- `langgraph` (ReAct agent)
- `sqlmodel` (persistence)
- `pydantic` (data models)
- `ag-ui-protocol` (AG-UI event types, optional)

# Agents in This Project

> **Package docs:** See [`backend/agent_builder/README.md`](../backend/agent_builder/README.md) for the portable integration guide.

## How This Project Uses agent_builder

The `agent_builder` package is generic — this project wires it with domain-specific tools, LLM providers, and prompts via `backend/workbench_integration.py`.

### Wiring Overview

```
workbench_integration.py
├── LLM Factory      → Copilot (default) or OpenAI (if AGENT_BACKEND=openai)
├── Tool Registry     → csv_* operations from @operation decorator
├── Chat Prompt       → German + CSV-ticket domain context
├── Model Catalog     → From llm_service.get_model_catalog()
└── Services          → WorkbenchService + ChatService (singletons)
```

### Integration Code (simplified)

```python
# workbench_integration.py

# 1. LLM Factory — dispatches to Copilot or OpenAI based on env
def llm_factory(config: LLMConfig) -> BaseChatModel:
    if os.getenv("AGENT_BACKEND") == "openai":
        return ChatOpenAI(model=config.model, api_key=os.getenv("OPENAI_API_KEY"), ...)
    else:
        return build_copilot_llm(model=config.model, ...)

# 2. Tool Registry — auto-discovers @operation-decorated CSV tools
registry = ToolRegistry()
csv_tools = [t for t in get_langchain_tools() if t.name.startswith("csv_")]
registry.register_all(csv_tools)

# 3. Repository
from agent_builder.persistence.sqlite import SqliteRepository
repo = SqliteRepository(Path("data/workbench.db"))

# 4. Configure — single call creates WorkbenchService + ChatService
from agent_builder.routes import agent_builder_blueprint, configure_agent_builder_blueprint

configure_agent_builder_blueprint(
    tool_registry=registry,
    llm_factory=llm_factory,
    repo=repo,
    system_prompt_builder=build_chat_system_prompt,  # domain-specific
)
```

### Blueprint Registration (in app.py)

```python
from agent_builder.routes import agent_builder_blueprint

app.register_blueprint(agent_builder_blueprint)
```

## Available Tools

All `@operation`-decorated functions with `csv_` prefix are auto-registered:

| Tool | Description |
|------|-------------|
| `csv_list_tickets` | List tickets with filters |
| `csv_get_ticket` | Get ticket by ID |
| `csv_search_tickets` | Search tickets by keyword |
| `csv_search_tickets_with_details` | Search with full details |
| `csv_ticket_stats` | Ticket statistics |
| `csv_ticket_fields` | Available field metadata |
| `csv_count_tickets` | Count matching tickets |
| `csv_sla_breach_tickets` | SLA breach report |

## Agent Templates

Pre-built templates in the UI (defined in `AgentCreateForm.jsx`):

- **Topic & Product Analysis** — Analyze ticket patterns across topics and products
- **Next Step Advisor** — Recommend actions for a ticket or topic

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_BACKEND` | `copilot` | LLM provider: `copilot` or `openai` |
| `OPENAI_API_KEY` | — | Required when `AGENT_BACKEND=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for OpenAI backend |
| `COPILOT_MODEL` | `gpt-4o` | Model for Copilot backend |
| `REACT_AGENT_RECURSION_LIMIT` | `8` | Max ReAct loop iterations |
| `AGENT_EFFICIENCY_MODE` | `true` | Shorter prompts for faster responses |

## REST API

All routes are under `/api/workbench/`. See the [agent_builder README](../backend/agent_builder/README.md#api-reference-blueprint-routes) for the full route table.

### Quick Examples

**Create an agent:**
```bash
curl -X POST http://localhost:5001/api/workbench/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SLA Analyzer",
    "system_prompt": "Analyze ticket SLA breaches and report findings.",
    "tool_names": ["csv_ticket_stats", "csv_sla_breach_tickets"]
  }'
```

**Run an agent:**
```bash
curl -X POST http://localhost:5001/api/workbench/agents/<agent_id>/runs \
  -H "Content-Type: application/json" \
  -d '{"input_prompt": "Which tickets are at risk of SLA breach?"}'
```

**Get run result:**
```bash
curl http://localhost:5001/api/workbench/runs/<run_id>
```

## Testing

```bash
cd backend && pytest agent_builder/tests/ -q    # Unit tests
cd backend && pytest tests/test_agents.py -q     # Operation registry tests
```

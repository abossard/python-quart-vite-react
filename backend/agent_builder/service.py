"""
Agent Builder — Workbench Service

Deep module: simple public API hiding DB, LLM, and evaluation complexity.

Public methods:
  - create_agent / get_agent / list_agents / update_agent / delete_agent
  - run_agent
  - evaluate_run / get_evaluation
  - list_tools
"""

import json
import logging
import os
from datetime import datetime
from time import perf_counter
from typing import Any, Optional

from .engine.callbacks import make_streaming_callback
from .engine.event_bus import AgentEvent, agent_event_bus
from .engine.prompt_builder import append_output_instructions, resolve_output_schema
from .engine.react_runner import (
    build_react_agent,
    extract_tools_used,
    make_tool_logging_callback,
)
from .evaluator import compute_score
from .evaluator import evaluate_run as _evaluate_criteria
from .fsm import InvalidTransition, RunEvent, transition as fsm_transition
from .llm_protocol import LLMConfig, LLMFactory
from .models import (
    AgentDefinition,
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentEvaluation,
    AgentRun,
    AgentRunCreate,
    ConversationThread,
    CriteriaResult,
    CriteriaType,
    MessageRole,
    RunStatus,
    SuccessCriteria,
    ThreadMessage,
)
from .persistence.protocol import RepositoryProtocol
from .tools import ToolRegistry

logger = logging.getLogger(__name__)


# ============================================================================
# CALCULATIONS (pure — no side effects, no I/O)
# ============================================================================

def _build_improve_prompt_request(
    name: str, description: str, system_prompt: str,
    all_tools: list[dict[str, Any]],
) -> str:
    """Build the LLM prompt for improving an agent system prompt. Pure calculation."""
    context_parts = []
    if name:
        context_parts.append(f"Agent name: {name}")
    if description:
        context_parts.append(f"Description: {description}")
    agent_context = "\n".join(context_parts) if context_parts else "(not provided)"

    tool_descriptions = "\n".join(
        f"  - {t['name']}: {t['description'][:120]}" for t in all_tools
    )

    return (
        "You are an expert prompt engineer. Improve the following system prompt for an AI agent.\n\n"
        "## Agent Context\n"
        f"{agent_context}\n\n"
        "## Tools This Agent Will Use\n"
        f"{tool_descriptions}\n\n"
        "## Current Prompt\n"
        f"{system_prompt}\n\n"
        "## Instructions\n"
        "Rewrite the prompt following these modern best practices:\n"
        "1. Start with a clear role definition (\"You are a...\").\n"
        "2. State the goal in one sentence.\n"
        "3. List concrete steps the agent should follow (numbered).\n"
        "4. Reference the specific tools listed above — explain when and why to use each.\n"
        "5. Add constraints: what NOT to do, edge cases to handle.\n"
        "6. Keep it concise — reasoning models work best with clear, direct instructions.\n"
        "7. Do NOT define output format — that is handled separately by the system.\n"
        "8. Focus on the reasoning process, not the presentation.\n\n"
        "Return ONLY the improved prompt text. No wrapping, no explanation, no markdown fences."
    )


def _build_suggest_prompt(
    name: str, description: str, system_prompt: str,
    all_tools: list[dict[str, Any]], tool_names_list: list[str],
    domain_context: str = "",
) -> str:
    """Build the LLM prompt for schema + tool suggestion. Pure calculation."""
    context_parts = []
    if name:
        context_parts.append(f"Agent name: {name}")
    if description:
        context_parts.append(f"Description: {description}")
    if system_prompt:
        context_parts.append(f"System prompt: {system_prompt}")
    agent_context = "\n".join(context_parts)

    tool_descriptions = "\n".join(
        f"  - {t['name']}: {t['description'][:150]}" for t in all_tools
    )

    domain_section = ""
    if domain_context:
        domain_section = f"## Data Domain\n{domain_context}\n\n"

    return (
        "You are a JSON Schema designer AND tool selector for an AI agent.\n\n"
        "## Agent Definition\n"
        f"{agent_context}\n\n"
        f"{domain_section}"
        "## Available Tools\n"
        f"{tool_descriptions}\n\n"
        "## UI Widget System\n"
        "Each property MUST have an 'x-ui' annotation with a 'widget' field:\n"
        "  'markdown' — GFM text. 'table' — array of objects ({\"columns\": [...]}).\n"
        "  'badge-list' — array of strings. 'stat-card' — single number ({\"label\": \"...\"}).\n"
        "  'bar-chart' — array of objects ({\"indexBy\": \"...\", \"keys\": [\"...\"]}).\n"
        "  'pie-chart' — object or [{\"id\":...,\"value\":...}]. 'json' — raw. 'hidden' — skip.\n\n"
        "## Your Task\n"
        "Return a JSON object with exactly two keys:\n"
        "1. \"schema\" — JSON Schema with 'type', 'properties', x-ui annotations.\n"
        "2. \"tool_names\" — array of tool names the agent needs.\n\n"
        "## Rules\n"
        "1. Always include 'message' (string, widget 'markdown').\n"
        "2. Match widget to data shape: numbers→stat-card, lists→table, distributions→pie/bar-chart.\n"
        "3. For tool_names, select ONLY tools the agent actually needs.\n"
        f"4. Valid tool names: {tool_names_list}\n\n"
        "Respond with ONLY valid JSON (no markdown fences)."
    )


def _parse_suggest_response(raw: str, valid_tool_names: list[str]) -> dict[str, Any]:
    """Parse LLM response into {schema, tool_names}. Pure calculation."""
    import json as json_mod
    import re

    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    json_str = json_match.group(1) if json_match else raw

    fallback = {
        "schema": {"type": "object", "properties": {"result": {"type": "string", "description": "Agent output"}}},
        "tool_names": valid_tool_names,
    }

    try:
        result = json_mod.loads(json_str)
        if not isinstance(result, dict):
            return fallback

        if "schema" in result and "tool_names" in result:
            schema, suggested_tools = result["schema"], result["tool_names"]
        elif "properties" in result:
            schema, suggested_tools = result, valid_tool_names
        else:
            return fallback

        if not isinstance(schema, dict) or "properties" not in schema:
            return fallback

        return {"schema": schema, "tool_names": [t for t in suggested_tools if t in valid_tool_names]}
    except (json_mod.JSONDecodeError, ValueError):
        return fallback


# ============================================================================
# SERVICE (actions — I/O, database, LLM calls)
# ============================================================================

class WorkbenchService:
    """
    Manages the full lifecycle of agent definitions, runs, and evaluations.

    Designed as a deep module:
      - Simple public API (create_agent, run_agent, evaluate_run)
      - Internal complexity hidden (LangGraph wiring, DB sessions, JSON columns)
    """

    def __init__(
        self,
        tool_registry: ToolRegistry,
        llm_factory: LLMFactory,
        repo: RepositoryProtocol,
        default_model: str = "",
        recursion_limit: int = 10,
        domain_context: str = "",
    ) -> None:
        self._registry = tool_registry
        self._llm_factory = llm_factory
        self._default_model = default_model
        self._recursion_limit = recursion_limit
        self._domain_context = domain_context
        self._repo = repo
        self._llm: Any = None

    @property
    def llm(self) -> Any:
        if self._llm is None:
            self._llm = self._llm_factory(LLMConfig(
                model=self._default_model,
                reasoning_effort="low",
            ))
        return self._llm

    def _resolve_llm_for_agent(self, agent_def: "AgentDefinition") -> Any:
        """Build an LLM instance using per-agent overrides or service defaults."""
        return self._llm_factory(LLMConfig(
            model=agent_def.model.strip() or self._default_model,
            temperature=agent_def.temperature,
            max_tokens=agent_def.max_tokens,
            reasoning_effort=agent_def.reasoning_effort or "low",
        ))

    # ------------------------------------------------------------------
    # Tool introspection
    # ------------------------------------------------------------------

    def list_tools(self) -> list[dict[str, Any]]:
        """Return metadata about all registered tools."""
        result: list[dict[str, Any]] = []
        for t in self._registry.available_tools():
            input_schema: dict[str, Any] = {"type": "object", "properties": {}}
            args_schema = getattr(t, "args_schema", None)
            if args_schema and hasattr(args_schema, "model_json_schema"):
                try:
                    input_schema = args_schema.model_json_schema()
                except Exception:
                    input_schema = {"type": "object", "properties": {}}
            result.append({
                "name": t.name,
                "description": (t.description or "")[:200],
                "input_schema": input_schema,
            })
        return result

    # ------------------------------------------------------------------
    # Schema suggestion (LLM call)
    # ------------------------------------------------------------------

    async def suggest_schema(
        self,
        name: str,
        description: str,
        system_prompt: str,
    ) -> dict[str, Any]:
        """
        Ask the LLM to propose a JSON Schema AND recommended tools.
        
        Action: calls LLM. Delegates prompt building and response
        parsing to pure functions (_build_suggest_prompt, _parse_suggest_response).
        """
        all_tools = self.list_tools()
        tool_names_list = [t["name"] for t in all_tools]

        prompt = _build_suggest_prompt(name, description, system_prompt, all_tools, tool_names_list, self._domain_context)

        from langchain_core.messages import HumanMessage
        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        raw = (response.content or "").strip()

        return _parse_suggest_response(raw, tool_names_list)

    # ------------------------------------------------------------------
    # Prompt improvement (LLM call)
    # ------------------------------------------------------------------

    async def improve_prompt(
        self,
        name: str,
        description: str,
        system_prompt: str,
        tool_names: list[str] | None = None,
    ) -> dict[str, str]:
        """
        Ask the LLM to improve an agent's system prompt.

        Action: calls LLM. Returns { improved_prompt: str }.
        """
        all_tools = self.list_tools()
        # Only include tools the user selected, or all if none specified
        if tool_names:
            selected_tools = [t for t in all_tools if t["name"] in tool_names]
        else:
            selected_tools = all_tools
        prompt = _build_improve_prompt_request(name, description, system_prompt, selected_tools)

        from langchain_core.messages import HumanMessage
        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        improved = (response.content or "").strip()

        # Strip markdown fences if LLM wraps it anyway
        if improved.startswith("```"):
            lines = improved.split("\n")
            improved = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return {"improved_prompt": improved}

    # ------------------------------------------------------------------
    # Validation helpers (calculations)
    # ------------------------------------------------------------------

    def _normalize_tool_names(self, names: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in names:
            if not isinstance(raw, str):
                continue
            name = raw.strip()
            if not name or name in seen:
                continue
            normalized.append(name)
            seen.add(name)
        return normalized

    def _validate_tool_names(self, names: list[str]) -> list[str]:
        normalized = self._normalize_tool_names(names)
        missing = [name for name in normalized if not self._registry.has(name)]
        if missing:
            raise ValueError(
                "Unknown tool(s): "
                + ", ".join(sorted(missing))
                + ". Use workbench_list_tools to inspect available tools."
            )
        return normalized

    def _normalize_input_contract(
        self, requires_input: bool, required_input_description: str,
    ) -> tuple[bool, str]:
        normalized_description = (required_input_description or "").strip()
        if requires_input and not normalized_description:
            raise ValueError(
                "required_input_description must be provided when requires_input is true"
            )
        if not requires_input:
            normalized_description = ""
        return requires_input, normalized_description

    def _build_agent_snapshot(self, agent: AgentDefinition) -> dict[str, Any]:
        return {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "system_prompt": agent.system_prompt,
            "requires_input": agent.requires_input,
            "required_input_description": agent.required_input_description,
            "model": agent.model,
            "temperature": agent.temperature,
            "recursion_limit": agent.recursion_limit,
            "max_tokens": agent.max_tokens,
            "reasoning_effort": agent.reasoning_effort,
            "output_instructions": agent.output_instructions,
            "output_schema": agent.output_schema,
            "tool_names": list(agent.tool_names),
            "success_criteria": [c.model_dump() for c in agent.success_criteria],
            "captured_at": datetime.now().isoformat(),
        }

    def _build_run_user_message(
        self, agent_def: AgentDefinition, run_request: AgentRunCreate,
    ) -> tuple[str, str]:
        run_prompt = (run_request.input_prompt or "").strip()
        required_input_value = (run_request.required_input_value or "").strip()
        message_parts: list[str] = []

        if run_prompt:
            message_parts.append(run_prompt)

        if agent_def.requires_input:
            if not required_input_value:
                raise ValueError(
                    "Missing required_input_value for this agent. "
                    f"Expected: {agent_def.required_input_description}"
                )
            message_parts.append(
                f"Required input ({agent_def.required_input_description}): {required_input_value}"
            )
        elif required_input_value:
            message_parts.append(f"Additional input: {required_input_value}")

        if not message_parts:
            message_parts.append("Proceed with the configured system instructions and tools.")

        return "\n\n".join(message_parts), required_input_value

    def _criteria_from_run_snapshot(self, run: AgentRun) -> list[SuccessCriteria]:
        snapshot = run.agent_snapshot
        raw = snapshot.get("success_criteria")
        if not isinstance(raw, list):
            return []
        parsed: list[SuccessCriteria] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                parsed.append(SuccessCriteria(**item))
            except Exception:
                continue
        return parsed

    # ------------------------------------------------------------------
    # Agent definitions CRUD
    # ------------------------------------------------------------------

    def create_agent(self, data: AgentDefinitionCreate) -> AgentDefinition:
        validated_tool_names = self._validate_tool_names(data.tool_names)
        requires_input, required_input_description = self._normalize_input_contract(
            data.requires_input, data.required_input_description,
        )
        agent = AgentDefinition(
            name=data.name,
            description=data.description,
            system_prompt=data.system_prompt,
            requires_input=requires_input,
            required_input_description=required_input_description,
            model=data.model,
            temperature=data.temperature,
            recursion_limit=data.recursion_limit,
            max_tokens=data.max_tokens,
            reasoning_effort=data.reasoning_effort,
            output_instructions=data.output_instructions,
            show_in_menu=data.show_in_menu,
        )
        agent.tool_names = validated_tool_names
        agent.success_criteria = data.success_criteria
        agent.output_schema = data.output_schema
        return self._repo.create_agent(agent)

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]:
        return self._repo.get_agent(agent_id)

    def list_agents(self) -> list[AgentDefinition]:
        return self._repo.list_agents()

    def update_agent(
        self, agent_id: str, data: AgentDefinitionUpdate,
    ) -> Optional[AgentDefinition]:
        agent = self._repo.get_agent(agent_id)
        if agent is None:
            return None
        if data.name is not None:
            agent.name = data.name
        if data.description is not None:
            agent.description = data.description
        if data.system_prompt is not None:
            agent.system_prompt = data.system_prompt
        next_requires = agent.requires_input if data.requires_input is None else data.requires_input
        next_desc = (
            agent.required_input_description
            if data.required_input_description is None
            else data.required_input_description
        )
        agent.requires_input, agent.required_input_description = self._normalize_input_contract(
            next_requires, next_desc,
        )
        if data.tool_names is not None:
            agent.tool_names = self._validate_tool_names(data.tool_names)
        if data.success_criteria is not None:
            agent.success_criteria = data.success_criteria
        if data.model is not None:
            agent.model = data.model
        if data.temperature is not None:
            agent.temperature = data.temperature
        if data.recursion_limit is not None:
            agent.recursion_limit = data.recursion_limit
        if data.max_tokens is not None:
            agent.max_tokens = data.max_tokens
        if data.reasoning_effort is not None:
            agent.reasoning_effort = data.reasoning_effort
        if data.output_instructions is not None:
            agent.output_instructions = data.output_instructions
        if data.output_schema is not None:
            agent.output_schema = data.output_schema
        if data.show_in_menu is not None:
            agent.show_in_menu = data.show_in_menu
        agent.updated_at = datetime.now()
        return self._repo.update_agent(agent)

    def delete_agent(self, agent_id: str) -> bool:
        return self._repo.delete_agent(agent_id)

    # ------------------------------------------------------------------
    # Run management
    # ------------------------------------------------------------------

    def get_run(self, run_id: str) -> Optional[AgentRun]:
        return self._repo.get_run(run_id)

    def list_runs(self, agent_id: Optional[str] = None, limit: int = 50) -> list[AgentRun]:
        return self._repo.list_runs(agent_id=agent_id, limit=limit)

    def delete_all_runs(self) -> int:
        """Delete all runs from the database. Returns count deleted."""
        return self._repo.delete_all_runs()

    # ------------------------------------------------------------------
    # Core: run an agent
    # ------------------------------------------------------------------

    async def run_agent(self, agent_id: str, run_request: AgentRunCreate) -> AgentRun:
        """Create a run record and start execution in the background.

        Returns immediately with a RUNNING run. The actual agent execution
        happens asynchronously via ``execute_run``, publishing SSE events as
        it progresses and updating the run record when done.

        Uses the RunStatus FSM to validate PENDING → RUNNING transition.
        """
        import asyncio

        agent_def = self.get_agent(agent_id)
        if agent_def is None:
            raise ValueError(f"Agent '{agent_id}' not found")

        validated_tool_names = self._validate_tool_names(agent_def.tool_names)
        agent_snapshot = self._build_agent_snapshot(agent_def)
        user_message, normalized_required_input = self._build_run_user_message(agent_def, run_request)
        normalized_prompt = (run_request.input_prompt or "").strip()
        agent_snapshot["input_prompt"] = normalized_prompt
        agent_snapshot["required_input_value"] = normalized_required_input
        agent_snapshot["composed_user_message"] = user_message

        # FSM: PENDING → RUNNING
        initial_status = RunStatus.PENDING
        running_status = fsm_transition(initial_status, RunEvent.START)

        run = AgentRun(
            agent_id=agent_id,
            input_prompt=normalized_prompt,
            status=running_status.value,
        )
        run.agent_snapshot = agent_snapshot
        run = self._repo.create_run(run)
        run_id = run.id

        # Publish RUN_STARTED event (AG-UI)
        agent_event_bus.publish(AgentEvent(
            run_id=run_id,
            event_type="RUN_STARTED",
            data={
                "threadId": run_id,
                "agentId": agent_id,
                "agentName": agent_def.name,
                "inputPreview": user_message[:200],
            },
        ))

        # Fire-and-forget: launch execution as a background task
        asyncio.create_task(
            self._execute_run(run_id, agent_def, validated_tool_names, user_message)
        )

        return run

    async def _execute_run(
        self,
        run_id: str,
        agent_def: AgentDefinition,
        validated_tool_names: list[str],
        user_message: str,
    ) -> None:
        """Execute the agent ReAct loop in the background.

        Updates the run record with output/status and publishes SSE events.
        """
        activity_events: list[dict[str, Any]] = []

        def _collect_event(event: AgentEvent) -> None:
            """Capture SSE events emitted during this run for persistence."""
            if event.run_id == run_id:
                activity_events.append(event.to_sse_dict())

        # Subscribe to the event bus to capture activity events
        import asyncio
        collector_queue: asyncio.Queue[AgentEvent] = asyncio.Queue(maxsize=2000)
        agent_event_bus._subscribers.append(collector_queue)

        async def _drain_collector():
            """Drain the collector queue into activity_events."""
            while True:
                try:
                    evt = collector_queue.get_nowait()
                    if evt.run_id == run_id:
                        activity_events.append(evt.to_sse_dict())
                except asyncio.QueueEmpty:
                    break

        try:
            tools = self._registry.resolve(validated_tool_names)
            runtime_system_prompt = append_output_instructions(
                agent_def.system_prompt,
                agent_def.output_instructions,
                agent_def.output_schema if agent_def.has_output_schema else None,
            )

            run_llm = self._resolve_llm_for_agent(agent_def)
            react = build_react_agent(run_llm, tools, runtime_system_prompt)

            user_recursion = agent_def.recursion_limit or self._recursion_limit
            graph_recursion_limit = max(user_recursion * 3, 10)

            logger.info(
                "▶️  Agent run_id=%s agent=%s model=%s temp=%s tools=%s custom_schema=%s prompt=%s",
                run_id, agent_def.id, agent_def.model or self._default_model,
                agent_def.temperature, validated_tool_names,
                agent_def.has_output_schema, user_message[:120],
            )
            t0 = perf_counter()

            result = await react.ainvoke(
                {"messages": [("user", user_message)]},
                config={
                    "recursion_limit": graph_recursion_limit,
                    "callbacks": [
                        make_tool_logging_callback(),
                        make_streaming_callback(run_id, agent_event_bus),
                    ],
                },
            )

            total_ms = int((perf_counter() - t0) * 1000)

            final_msg = result["messages"][-1]
            output = final_msg.content if hasattr(final_msg, "content") else str(final_msg)

            tools_used = extract_tools_used(result["messages"])

            # Detect LangGraph recursion-limit truncation
            is_truncated = "Sorry, need more steps" in (output or "")
            if is_truncated:
                logger.warning(
                    "⚠️  Agent run_id=%s hit recursion limit (%s user / %s graph)",
                    run_id, agent_def.recursion_limit, graph_recursion_limit,
                )
                # FSM: RUNNING → TRUNCATED
                final_status = fsm_transition(RunStatus.RUNNING, RunEvent.TRUNCATE)
                event_type = "RUN_FINISHED"
            else:
                # FSM: RUNNING → COMPLETED
                final_status = fsm_transition(RunStatus.RUNNING, RunEvent.COMPLETE)
                event_type = "RUN_FINISHED"

            logger.info(
                "⏹️  Agent done run_id=%s total_ms=%s tools_used=%s messages=%d status=%s",
                run_id, total_ms, tools_used, len(result["messages"]), final_status,
            )

            agent_event_bus.publish(AgentEvent(
                run_id=run_id,
                event_type=event_type,
                data={
                    "threadId": run_id,
                    "outputPreview": output[:300],
                    "toolsUsed": tools_used,
                    "durationMs": total_ms,
                    "truncated": is_truncated,
                },
            ))

            # Drain collector before persisting
            await _drain_collector()

            updated = self._repo.update_run(run_id,
                status=final_status.value,
                output=output,
                completed_at=datetime.now(),
                activity_log=activity_events,
            )
            if updated:
                self._repo.update_run(run_id, tools_used=tools_used)

        except Exception as exc:
            logger.exception("❌ Agent run_id=%s failed: %s", run_id, exc)
            # FSM: RUNNING → FAILED
            failed_status = fsm_transition(RunStatus.RUNNING, RunEvent.FAIL)
            agent_event_bus.publish(AgentEvent(
                run_id=run_id,
                event_type="RUN_ERROR",
                data={"message": str(exc)},
            ))

            await _drain_collector()

            self._repo.update_run(run_id,
                status=failed_status.value,
                error=str(exc),
                completed_at=datetime.now(),
                activity_log=activity_events,
            )
        finally:
            # Unsubscribe collector queue
            try:
                agent_event_bus._subscribers.remove(collector_queue)
            except ValueError:
                pass

    # ------------------------------------------------------------------
    # Conversations (AG-UI threaded chat)
    # ------------------------------------------------------------------

    def create_thread(self, agent_id: str, title: str = "") -> ConversationThread:
        """Create a new conversation thread for an agent."""
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent '{agent_id}' not found")
        auto_title = title or f"Chat with {agent.name}"
        thread = ConversationThread(agent_id=agent_id, title=auto_title)
        return self._repo.create_thread(thread)

    def get_thread(self, thread_id: str) -> Optional[ConversationThread]:
        return self._repo.get_thread(thread_id)

    def list_threads(self, agent_id: Optional[str] = None, limit: int = 50) -> list[ConversationThread]:
        return self._repo.list_threads(agent_id=agent_id, limit=limit)

    def delete_thread(self, thread_id: str) -> bool:
        return self._repo.delete_thread(thread_id)

    def get_thread_messages(self, thread_id: str) -> list[ThreadMessage]:
        return self._repo.get_messages(thread_id)

    def start_thread_from_run(self, run_id: str) -> ConversationThread:
        """Create a thread seeded with context from a completed run."""
        run = self.get_run(run_id)
        if run is None:
            raise ValueError(f"Run '{run_id}' not found")
        agent = self.get_agent(run.agent_id)
        agent_name = agent.name if agent else "Agent"
        thread = ConversationThread(
            agent_id=run.agent_id,
            title=f"Chat from run — {agent_name}",
        )
        thread = self._repo.create_thread(thread)
        # Seed with the run's input as user message
        if run.input_prompt:
            self._repo.add_message(ThreadMessage(
                thread_id=thread.id,
                role=MessageRole.USER.value,
                content=run.input_prompt,
            ))
        # Seed with the run's output as assistant message
        if run.output:
            self._repo.add_message(ThreadMessage(
                thread_id=thread.id,
                role=MessageRole.ASSISTANT.value,
                content=run.output,
            ))
        return thread

    async def continue_thread(self, thread_id: str, user_message: str):
        """Continue a conversation — yields AG-UI events as an async generator.

        Deep module: hides thread history loading, ReAct execution,
        AG-UI event conversion, and message persistence behind a
        single async generator interface.
        """
        import uuid as uuid_mod

        from .engine.ag_ui_events import (
            encode_event,
            run_error_event,
            run_finished_event,
            run_started_event,
            state_snapshot_event,
            step_finished_event,
            step_started_event,
            structured_output_event,
            text_message_content,
            text_message_end,
            text_message_start,
            tool_call_args,
            tool_call_end,
            tool_call_result,
            tool_call_start,
        )

        thread = self._repo.get_thread(thread_id)
        if thread is None:
            yield encode_event(run_error_event(f"Thread '{thread_id}' not found"))
            return

        agent_def = self.get_agent(thread.agent_id)
        if agent_def is None:
            yield encode_event(run_error_event(f"Agent for thread not found"))
            return

        run_id = str(uuid_mod.uuid4())

        # Persist user message
        self._repo.add_message(ThreadMessage(
            thread_id=thread_id,
            role=MessageRole.USER.value,
            content=user_message,
        ))

        yield encode_event(run_started_event(thread_id, run_id))

        try:
            # Load conversation history for context
            history_msgs = self._repo.get_messages(thread_id, limit=50)
            langchain_messages = []
            for msg in history_msgs:
                if msg.role == MessageRole.USER.value:
                    langchain_messages.append(("user", msg.content))
                elif msg.role == MessageRole.ASSISTANT.value:
                    langchain_messages.append(("assistant", msg.content))

            # Resolve tools and build prompt
            validated_tool_names = self._validate_tool_names(agent_def.tool_names)
            tools = self._registry.resolve(validated_tool_names)
            runtime_system_prompt = append_output_instructions(
                agent_def.system_prompt,
                agent_def.output_instructions,
                agent_def.output_schema if agent_def.has_output_schema else None,
            )
            run_llm = self._resolve_llm_for_agent(agent_def)
            react = build_react_agent(run_llm, tools, runtime_system_prompt)

            user_recursion = agent_def.recursion_limit or self._recursion_limit
            graph_recursion_limit = max(user_recursion * 3, 10)

            # Send state snapshot with agent info
            yield encode_event(state_snapshot_event({
                "agent_id": agent_def.id,
                "agent_name": agent_def.name,
                "tools": validated_tool_names,
                "output_schema": agent_def.output_schema if agent_def.has_output_schema else None,
            }))

            yield encode_event(step_started_event("agent_execution"))

            # Stream ReAct agent execution with astream_events for real-time AG-UI events
            message_id = str(uuid_mod.uuid4())
            output_chunks = []
            tools_used = []
            started_text = False
            active_tool_calls = {}
            final_output = ""

            async for event in react.astream_events(
                {"messages": langchain_messages},
                config={"recursion_limit": graph_recursion_limit},
                version="v2",
            ):
                kind = event.get("event", "")
                data = event.get("data", {})

                if kind == "on_chat_model_stream":
                    # Token-by-token LLM streaming
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        if not started_text:
                            yield encode_event(text_message_start(message_id, role="assistant"))
                            started_text = True
                        yield encode_event(text_message_content(message_id, chunk.content))
                        output_chunks.append(chunk.content)

                    # Check for tool calls in the chunk
                    if chunk and hasattr(chunk, "tool_call_chunks"):
                        for tc_chunk in (chunk.tool_call_chunks or []):
                            tc_id = tc_chunk.get("id")
                            tc_name = tc_chunk.get("name")
                            tc_args_delta = tc_chunk.get("args", "")
                            if tc_id and tc_name and tc_id not in active_tool_calls:
                                # New tool call starting
                                if started_text:
                                    yield encode_event(text_message_end(message_id))
                                    started_text = False
                                    message_id = str(uuid_mod.uuid4())
                                active_tool_calls[tc_id] = tc_name
                                yield encode_event(tool_call_start(tc_id, tc_name))
                                if tc_name not in tools_used:
                                    tools_used.append(tc_name)
                            if tc_id and tc_args_delta:
                                yield encode_event(tool_call_args(tc_id, tc_args_delta))

                elif kind == "on_tool_start":
                    tc_name = event.get("name", "tool")
                    tc_id = event.get("run_id", str(uuid_mod.uuid4()))
                    if tc_name not in tools_used:
                        tools_used.append(tc_name)
                    if tc_id not in active_tool_calls:
                        if started_text:
                            yield encode_event(text_message_end(message_id))
                            started_text = False
                            message_id = str(uuid_mod.uuid4())
                        active_tool_calls[tc_id] = tc_name
                        yield encode_event(tool_call_start(str(tc_id), tc_name))

                elif kind == "on_tool_end":
                    tc_id = event.get("run_id", "")
                    tc_output = data.get("output", "")
                    if isinstance(tc_output, str):
                        tc_content = tc_output[:500]
                    else:
                        tc_content = str(tc_output)[:500]
                    if str(tc_id) in active_tool_calls or tc_id in active_tool_calls:
                        yield encode_event(tool_call_end(str(tc_id)))
                        yield encode_event(tool_call_result(str(tc_id), tc_content))
                        active_tool_calls.pop(str(tc_id), None)
                        active_tool_calls.pop(tc_id, None)

                elif kind == "on_chain_end":
                    # Capture final output from the chain end event as fallback
                    chain_output = data.get("output", {})
                    if isinstance(chain_output, dict):
                        msgs = chain_output.get("messages", [])
                        if msgs:
                            last_msg = msgs[-1]
                            content = getattr(last_msg, "content", None)
                            if content and isinstance(content, str):
                                final_output = content

            # Close any open text message
            if started_text:
                yield encode_event(text_message_end(message_id))

            # Fallback: if no text was streamed but we have a final output, emit it
            if not output_chunks and final_output:
                message_id = str(uuid_mod.uuid4())
                yield encode_event(text_message_start(message_id, role="assistant"))
                yield encode_event(text_message_content(message_id, final_output))
                yield encode_event(text_message_end(message_id))
                output_chunks.append(final_output)

            yield encode_event(step_finished_event("agent_execution"))

            output = "".join(output_chunks)

            # If agent has structured output schema, emit custom event
            if agent_def.has_output_schema:
                yield encode_event(structured_output_event(
                    output, agent_def.output_schema,
                ))

            # Persist assistant response
            self._repo.add_message(ThreadMessage(
                thread_id=thread_id,
                role=MessageRole.ASSISTANT.value,
                content=output,
            ))

            # Also create an AgentRun record for backward compat
            # FSM: PENDING → RUNNING → COMPLETED (thread runs are synchronous)
            completed_status = fsm_transition(
                fsm_transition(RunStatus.PENDING, RunEvent.START),
                RunEvent.COMPLETE,
            )
            run = AgentRun(
                id=run_id,
                agent_id=agent_def.id,
                input_prompt=user_message,
                status=completed_status.value,
                output=output,
                completed_at=datetime.now(),
            )
            run.tools_used = tools_used
            run.agent_snapshot = self._build_agent_snapshot(agent_def)
            self._repo.create_run(run)

            yield encode_event(run_finished_event(thread_id, run_id))

        except Exception as exc:
            logger.exception("Thread conversation error: %s", exc)
            yield encode_event(run_error_event(str(exc)))

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]:
        return self._repo.get_evaluation(run_id)

    async def evaluate_run(self, run_id: str) -> AgentEvaluation:
        """Evaluate a completed run against its agent's success criteria."""
        run = self.get_run(run_id)
        if run is None:
            raise ValueError(f"Run '{run_id}' not found")
        if run.status not in (RunStatus.COMPLETED.value, RunStatus.FAILED.value):
            raise ValueError(f"Run '{run_id}' has not completed yet (status={run.status})")

        criteria = self._criteria_from_run_snapshot(run)
        if not criteria:
            agent_def = self.get_agent(run.agent_id)
            criteria = agent_def.success_criteria if agent_def else []

        has_llm_judge = any(c.type == CriteriaType.LLM_JUDGE for c in criteria)
        judge_llm = self.llm if has_llm_judge else self._llm

        results: list[CriteriaResult] = await _evaluate_criteria(run, criteria, llm=judge_llm)
        score = compute_score(results)
        overall = score == 1.0

        evaluation = self._repo.upsert_evaluation(
            run_id,
            overall_passed=overall,
            score=score,
        )
        evaluation.criteria_results = results
        return self._repo.upsert_evaluation(
            run_id,
            criteria_results=results,
            overall_passed=overall,
            score=score,
        )

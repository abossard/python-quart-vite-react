"""
Agent Builder — Workbench Service

Deep module: simple public API hiding DB, LLM, and evaluation complexity.

Public methods:
  - create_agent / get_agent / list_agents / update_agent / delete_agent
  - run_agent
  - evaluate_run / get_evaluation
  - list_tools
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any, Optional

from .engine.prompt_builder import append_output_instructions
from .engine.react_runner import build_llm, build_react_agent, extract_tools_used, make_tool_logging_callback
from .evaluator import compute_score
from .evaluator import evaluate_run as _evaluate_criteria
from .models import (
    AgentDefinition,
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentEvaluation,
    AgentRun,
    AgentRunCreate,
    CriteriaResult,
    CriteriaType,
    RunStatus,
    SuccessCriteria,
)
from .persistence import AgentRepository, build_engine
from .tools import ToolRegistry

logger = logging.getLogger(__name__)


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
        db_path: Optional[Path] = None,
        openai_api_key: str = "",
        openai_model: str = "gpt-4o-mini",
        openai_base_url: str = "",
        recursion_limit: int = 10,
    ) -> None:
        self._registry = tool_registry
        self._api_key = openai_api_key or os.getenv("OPENAI_API_KEY", "")
        self._model = openai_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._base_url = openai_base_url or os.getenv("OPENAI_BASE_URL", "")
        self._recursion_limit = recursion_limit
        self._db_path = db_path or (
            Path(__file__).resolve().parents[1] / "data" / "workbench.db"
        )
        self._engine = build_engine(self._db_path)
        self._repo = AgentRepository(self._engine)
        self._llm: Any = None

    @property
    def llm(self) -> Any:
        if self._llm is None:
            if not self._api_key:
                raise ValueError(
                    "OPENAI_API_KEY is required to run agents. "
                    "Set it via environment variable or pass openai_api_key."
                )
            self._llm = build_llm(self._model, self._api_key, self._base_url)
        return self._llm

    def _resolve_llm_for_agent(self, agent_def: "AgentDefinition") -> Any:
        """Build an LLM instance using per-agent overrides or service defaults."""
        agent_model = agent_def.model.strip() if agent_def.model else ""
        uses_defaults = (
            not agent_model
            and agent_def.temperature == 0.0
            and agent_def.max_tokens == 0
        )
        if uses_defaults:
            return self.llm
        return build_llm(
            model=agent_model or self._model,
            api_key=self._api_key,
            base_url=self._base_url,
            temperature=agent_def.temperature,
            max_tokens=agent_def.max_tokens,
        )

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
            "output_instructions": agent.output_instructions,
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
            output_instructions=data.output_instructions,
        )
        agent.tool_names = validated_tool_names
        agent.success_criteria = data.success_criteria
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
        if data.output_instructions is not None:
            agent.output_instructions = data.output_instructions
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

    # ------------------------------------------------------------------
    # Core: run an agent
    # ------------------------------------------------------------------

    async def run_agent(self, agent_id: str, run_request: AgentRunCreate) -> AgentRun:
        """Execute an AgentDefinition against a user prompt using LangGraph ReAct."""
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

        run = AgentRun(
            agent_id=agent_id,
            input_prompt=normalized_prompt,
            status=RunStatus.RUNNING.value,
        )
        run.agent_snapshot = agent_snapshot
        run = self._repo.create_run(run)
        run_id = run.id

        try:
            tools = self._registry.resolve(validated_tool_names)
            runtime_system_prompt = append_output_instructions(
                agent_def.system_prompt, agent_def.output_instructions,
            )

            # Per-agent LLM: use agent's model/temperature/max_tokens if set, else service defaults
            run_llm = self._resolve_llm_for_agent(agent_def)
            react = build_react_agent(run_llm, tools, runtime_system_prompt)

            run_recursion_limit = agent_def.recursion_limit or self._recursion_limit

            logger.info(
                "▶️  Agent run_id=%s agent=%s model=%s temp=%s tools=%s prompt=%s",
                run_id, agent_id, agent_def.model or self._model,
                agent_def.temperature, validated_tool_names, user_message[:120],
            )
            t0 = perf_counter()

            result = await react.ainvoke(
                {"messages": [("user", user_message)]},
                config={
                    "recursion_limit": run_recursion_limit,
                    "callbacks": [make_tool_logging_callback()],
                },
            )

            total_ms = int((perf_counter() - t0) * 1000)
            final_msg = result["messages"][-1]
            output = final_msg.content if hasattr(final_msg, "content") else str(final_msg)
            tools_used = extract_tools_used(result["messages"])

            logger.info(
                "⏹️  Agent done run_id=%s total_ms=%s tools_used=%s messages=%d",
                run_id, total_ms, tools_used, len(result["messages"]),
            )

            updated = self._repo.update_run(run_id,
                status=RunStatus.COMPLETED.value,
                output=output,
                completed_at=datetime.now(),
            )
            if updated:
                updated.tools_used = tools_used
                updated = self._repo.update_run(run_id, tools_used_json=updated.tools_used_json)
            return updated or run

        except Exception as exc:
            updated = self._repo.update_run(run_id,
                status=RunStatus.FAILED.value,
                error=str(exc),
                completed_at=datetime.now(),
            )
            if updated:
                return updated
            raise

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
            criteria_results_json=evaluation.criteria_results_json,
            overall_passed=overall,
            score=score,
        )

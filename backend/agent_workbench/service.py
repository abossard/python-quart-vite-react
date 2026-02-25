"""
Agent Workbench - Service

Core business logic: create / run / evaluate agents.
State is persisted in SQLite via SQLModel.

This module is independent: it imports only from standard library,
pydantic, sqlmodel, langchain, and the workbench's own sub-modules.
The host project injects tools and LLM configuration at startup.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from sqlmodel import Session, select

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
    build_engine,
)
from .tool_registry import ToolRegistry

# ============================================================================
# LLM HELPER - isolated so it stays optional at import time
# ============================================================================

def _build_llm(model: str, api_key: str, base_url: str = "") -> Any:
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url or None,
        temperature=0.0,
    )


def _build_react_agent(llm: Any, tools: list[Any], system_prompt: str) -> Any:
    from langgraph.prebuilt import create_react_agent
    return create_react_agent(llm, tools, prompt=system_prompt)


def _append_markdown_output_instruction(system_prompt: str) -> str:
    instruction = (
        "Format your final answer as GitHub-flavored Markdown. "
        "Use headings, bullet lists, and tables when helpful. "
        "Do not wrap the entire response in a code block."
    )
    base_prompt = (system_prompt or "").strip()
    if not base_prompt:
        return instruction
    return f"{base_prompt}\n\n{instruction}"


# ============================================================================
# WORKBENCH SERVICE
# ============================================================================

class WorkbenchService:
    """
    Manages the full lifecycle of agent definitions, runs, and evaluations.

    Designed as a deep module:
      - Simple public API (create_agent, run_agent, evaluate_run)
      - Internal complexity hidden (LangGraph wiring, DB sessions, JSON columns)

    Host project provides:
      - tool_registry  : populated ToolRegistry instance
      - db_path        : path to SQLite file (default: backend/data/workbench.db)
      - openai_api_key : required for running agents
      - openai_model   : model name (default: gpt-4o-mini)
      - openai_base_url: optional custom endpoint
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
            Path(__file__).resolve().parents[2] / "data" / "workbench.db"
        )
        self._engine = build_engine(self._db_path)

        # LLM is lazy-initialised so the service can be instantiated without
        # a valid API key (useful for listing agents / tools only).
        self._llm: Any = None

    @property
    def llm(self) -> Any:
        if self._llm is None:
            if not self._api_key:
                raise ValueError(
                    "OPENAI_API_KEY is required to run agents. "
                    "Set it via environment variable or pass openai_api_key."
                )
            self._llm = _build_llm(self._model, self._api_key, self._base_url)
        return self._llm

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

    def _build_agent_snapshot(self, agent: AgentDefinition) -> dict[str, Any]:
        return {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "system_prompt": agent.system_prompt,
            "requires_input": agent.requires_input,
            "required_input_description": agent.required_input_description,
            "tool_names": list(agent.tool_names),
            "success_criteria": [criteria.model_dump() for criteria in agent.success_criteria],
            "captured_at": datetime.now().isoformat(),
        }

    def _normalize_input_contract(
        self,
        requires_input: bool,
        required_input_description: str,
    ) -> tuple[bool, str]:
        normalized_description = (required_input_description or "").strip()
        if requires_input and not normalized_description:
            raise ValueError(
                "required_input_description must be provided when requires_input is true"
            )
        if not requires_input:
            normalized_description = ""
        return requires_input, normalized_description

    def _build_run_user_message(
        self,
        agent_def: AgentDefinition,
        run_request: AgentRunCreate,
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
            data.requires_input,
            data.required_input_description,
        )
        agent = AgentDefinition(
            name=data.name,
            description=data.description,
            system_prompt=data.system_prompt,
            requires_input=requires_input,
            required_input_description=required_input_description,
        )
        agent.tool_names = validated_tool_names
        agent.success_criteria = data.success_criteria
        with Session(self._engine) as session:
            session.add(agent)
            session.commit()
            session.refresh(agent)
        return agent

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]:
        with Session(self._engine) as session:
            return session.get(AgentDefinition, agent_id)

    def list_agents(self) -> list[AgentDefinition]:
        with Session(self._engine) as session:
            return list(session.exec(select(AgentDefinition)).all())

    def update_agent(
        self, agent_id: str, data: AgentDefinitionUpdate
    ) -> Optional[AgentDefinition]:
        with Session(self._engine) as session:
            agent = session.get(AgentDefinition, agent_id)
            if agent is None:
                return None
            if data.name is not None:
                agent.name = data.name
            if data.description is not None:
                agent.description = data.description
            if data.system_prompt is not None:
                agent.system_prompt = data.system_prompt
            next_requires_input = agent.requires_input if data.requires_input is None else data.requires_input
            next_required_input_description = (
                agent.required_input_description
                if data.required_input_description is None
                else data.required_input_description
            )
            (
                agent.requires_input,
                agent.required_input_description,
            ) = self._normalize_input_contract(
                next_requires_input,
                next_required_input_description,
            )
            if data.tool_names is not None:
                agent.tool_names = self._validate_tool_names(data.tool_names)
            if data.success_criteria is not None:
                agent.success_criteria = data.success_criteria
            agent.updated_at = datetime.now()
            session.add(agent)
            session.commit()
            session.refresh(agent)
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        with Session(self._engine) as session:
            agent = session.get(AgentDefinition, agent_id)
            if agent is None:
                return False
            session.delete(agent)
            session.commit()
        return True

    # ------------------------------------------------------------------
    # Run management
    # ------------------------------------------------------------------

    def get_run(self, run_id: str) -> Optional[AgentRun]:
        with Session(self._engine) as session:
            return session.get(AgentRun, run_id)

    def list_runs(self, agent_id: Optional[str] = None, limit: int = 50) -> list[AgentRun]:
        with Session(self._engine) as session:
            stmt = select(AgentRun)
            if agent_id:
                stmt = stmt.where(AgentRun.agent_id == agent_id)
            stmt = stmt.order_by(AgentRun.created_at.desc()).limit(limit)  # type: ignore[attr-defined]
            return list(session.exec(stmt).all())

    # ------------------------------------------------------------------
    # Core: run an agent
    # ------------------------------------------------------------------

    async def run_agent(
        self,
        agent_id: str,
        run_request: AgentRunCreate,
    ) -> AgentRun:
        """
        Execute an AgentDefinition against a user prompt using LangGraph ReAct.

        Steps:
          1. Load AgentDefinition
          2. Resolve tools from registry
          3. Build a fresh ReAct agent (stateless; each run is independent)
          4. Invoke the agent
          5. Persist & return AgentRun
        """
        # -- Load definition --
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

        # -- Persist a PENDING run --
        run = AgentRun(
            agent_id=agent_id,
            input_prompt=normalized_prompt,
            status=RunStatus.RUNNING.value,
        )
        run.agent_snapshot = agent_snapshot
        with Session(self._engine) as session:
            session.add(run)
            session.commit()
            session.refresh(run)

        run_id = run.id

        # -- Execute --
        try:
            tools = self._registry.resolve(validated_tool_names)
            runtime_system_prompt = _append_markdown_output_instruction(agent_def.system_prompt)
            react = _build_react_agent(self.llm, tools, runtime_system_prompt)

            result = await react.ainvoke(
                {"messages": [("user", user_message)]},
                config={"recursion_limit": self._recursion_limit},
            )

            final_msg = result["messages"][-1]
            output = final_msg.content if hasattr(final_msg, "content") else str(final_msg)

            # Collect tool names that were used
            tools_used: list[str] = []
            for msg in result["messages"]:
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
                        if name:
                            tools_used.append(name)

            # -- Persist completion --
            with Session(self._engine) as session:
                db_run = session.get(AgentRun, run_id)
                if db_run:
                    db_run.status = RunStatus.COMPLETED.value
                    db_run.output = output
                    db_run.tools_used = list(dict.fromkeys(tools_used))  # deduplicate, preserve order
                    db_run.completed_at = datetime.now()
                    session.add(db_run)
                    session.commit()
                    session.refresh(db_run)
                    return db_run

        except Exception as exc:
            with Session(self._engine) as session:
                db_run = session.get(AgentRun, run_id)
                if db_run:
                    db_run.status = RunStatus.FAILED.value
                    db_run.error = str(exc)
                    db_run.completed_at = datetime.now()
                    session.add(db_run)
                    session.commit()
                    session.refresh(db_run)
                    return db_run
            raise

        # Fallback (should not reach here)
        return self.get_run(run_id)  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]:
        with Session(self._engine) as session:
            stmt = select(AgentEvaluation).where(AgentEvaluation.run_id == run_id)
            return session.exec(stmt).first()

    async def evaluate_run(self, run_id: str) -> AgentEvaluation:
        """
        Evaluate a completed run against its agent's success criteria.

        Idempotent: re-evaluates and overwrites any existing evaluation.
        """
        run = self.get_run(run_id)
        if run is None:
            raise ValueError(f"Run '{run_id}' not found")
        if run.status not in (RunStatus.COMPLETED.value, RunStatus.FAILED.value):
            raise ValueError(f"Run '{run_id}' has not completed yet (status={run.status})")

        criteria = self._criteria_from_run_snapshot(run)
        if not criteria:
            agent_def = self.get_agent(run.agent_id)
            criteria = agent_def.success_criteria if agent_def else []

        has_llm_judge = any(criteria_item.type == CriteriaType.LLM_JUDGE for criteria_item in criteria)
        judge_llm = self.llm if has_llm_judge else self._llm

        results: list[CriteriaResult] = await _evaluate_criteria(run, criteria, llm=judge_llm)
        score = compute_score(results)
        overall = score == 1.0

        # Upsert evaluation
        with Session(self._engine) as session:
            stmt = select(AgentEvaluation).where(AgentEvaluation.run_id == run_id)
            existing = session.exec(stmt).first()
            if existing:
                evaluation = existing
            else:
                evaluation = AgentEvaluation(run_id=run_id)
                session.add(evaluation)

            evaluation.criteria_results = results
            evaluation.overall_passed = overall
            evaluation.score = score
            evaluation.evaluated_at = datetime.now()
            session.commit()
            session.refresh(evaluation)

        return evaluation

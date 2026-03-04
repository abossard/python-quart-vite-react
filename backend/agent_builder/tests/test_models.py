"""Tests for pure data models — fast, no I/O."""

import pytest
from pydantic import ValidationError

from agent_builder.models import (
    AgentDefinition,
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    AgentEvaluation,
    AgentRequest,
    AgentResponse,
    AgentRun,
    AgentRunCreate,
    CriteriaResult,
    CriteriaType,
    RunStatus,
    SuccessCriteria,
)


# ---------------------------------------------------------------------------
# AgentRequest / AgentResponse (chat models)
# ---------------------------------------------------------------------------

class TestAgentRequest:
    def test_valid_request(self):
        req = AgentRequest(prompt="Hello world")
        assert req.prompt == "Hello world"
        assert req.agent_type == "task_assistant"

    def test_strips_whitespace(self):
        req = AgentRequest(prompt="  hello  ")
        assert req.prompt == "hello"

    def test_rejects_empty_prompt(self):
        with pytest.raises(ValidationError):
            AgentRequest(prompt="")

    def test_rejects_whitespace_only(self):
        with pytest.raises(ValidationError):
            AgentRequest(prompt="   ")


class TestAgentResponse:
    def test_creates_with_defaults(self):
        resp = AgentResponse(result="Done", agent_type="task_assistant")
        assert resp.result == "Done"
        assert resp.tools_used == []
        assert resp.error is None
        assert resp.created_at is not None


# ---------------------------------------------------------------------------
# SuccessCriteria / CriteriaResult
# ---------------------------------------------------------------------------

class TestSuccessCriteria:
    def test_all_types_exist(self):
        assert CriteriaType.TOOL_CALLED == "tool_called"
        assert CriteriaType.OUTPUT_CONTAINS == "output_contains"
        assert CriteriaType.NO_ERROR == "no_error"
        assert CriteriaType.LLM_JUDGE == "llm_judge"

    def test_criteria_roundtrip(self):
        c = SuccessCriteria(type=CriteriaType.TOOL_CALLED, value="my_tool", description="test")
        d = c.model_dump()
        c2 = SuccessCriteria(**d)
        assert c2.type == CriteriaType.TOOL_CALLED
        assert c2.value == "my_tool"

    def test_criteria_result(self):
        c = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        r = CriteriaResult(criteria=c, passed=True, detail="all good")
        assert r.passed is True


# ---------------------------------------------------------------------------
# AgentDefinitionCreate / Update
# ---------------------------------------------------------------------------

class TestAgentDefinitionCreate:
    def test_valid_create(self):
        data = AgentDefinitionCreate(
            name="Test Agent",
            system_prompt="You are helpful",
            tool_names=["csv_list_tickets"],
        )
        assert data.name == "Test Agent"
        assert data.requires_input is False
        assert data.success_criteria == []

    def test_rejects_empty_name(self):
        with pytest.raises(ValidationError):
            AgentDefinitionCreate(name="", system_prompt="x")

    def test_rejects_empty_prompt(self):
        with pytest.raises(ValidationError):
            AgentDefinitionCreate(name="x", system_prompt="")


class TestAgentDefinitionUpdate:
    def test_all_fields_optional(self):
        upd = AgentDefinitionUpdate()
        assert upd.name is None
        assert upd.system_prompt is None
        assert upd.tool_names is None

    def test_partial_update(self):
        upd = AgentDefinitionUpdate(name="New Name")
        assert upd.name == "New Name"
        assert upd.system_prompt is None


# ---------------------------------------------------------------------------
# AgentRunCreate
# ---------------------------------------------------------------------------

class TestAgentRunCreate:
    def test_defaults(self):
        rc = AgentRunCreate()
        assert rc.input_prompt == ""
        assert rc.required_input_value is None

    def test_with_values(self):
        rc = AgentRunCreate(input_prompt="test", required_input_value="INC-123")
        assert rc.input_prompt == "test"
        assert rc.required_input_value == "INC-123"


# ---------------------------------------------------------------------------
# RunStatus enum
# ---------------------------------------------------------------------------

class TestRunStatus:
    def test_values(self):
        assert RunStatus.PENDING == "pending"
        assert RunStatus.RUNNING == "running"
        assert RunStatus.COMPLETED == "completed"
        assert RunStatus.FAILED == "failed"


# ---------------------------------------------------------------------------
# SQLModel table models - JSON property roundtrips
# ---------------------------------------------------------------------------

class TestAgentDefinitionJsonProperties:
    def test_tool_names_roundtrip(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        agent.tool_names = ["a", "b"]
        assert agent.tool_names == ["a", "b"]
        assert '"a"' in agent.tool_names_json

    def test_success_criteria_roundtrip(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        criteria = [SuccessCriteria(type=CriteriaType.NO_ERROR, value="")]
        agent.success_criteria = criteria
        assert len(agent.success_criteria) == 1
        assert agent.success_criteria[0].type == CriteriaType.NO_ERROR

    def test_to_dict(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        agent.tool_names = ["csv_list_tickets"]
        d = agent.to_dict()
        assert d["name"] == "test"
        assert d["tool_names"] == ["csv_list_tickets"]
        assert "created_at" in d


class TestAgentRunJsonProperties:
    def test_tools_used_roundtrip(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        run.tools_used = ["tool_a", "tool_b"]
        assert run.tools_used == ["tool_a", "tool_b"]

    def test_agent_snapshot_roundtrip(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        run.agent_snapshot = {"name": "test", "tools": [1, 2]}
        assert run.agent_snapshot["name"] == "test"

    def test_to_dict(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        d = run.to_dict()
        assert d["agent_id"] == "x"
        assert d["status"] == "pending"


class TestAgentEvaluationJsonProperties:
    def test_criteria_results_roundtrip(self):
        ev = AgentEvaluation(run_id="r1")
        criteria = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        results = [CriteriaResult(criteria=criteria, passed=True)]
        ev.criteria_results = results
        assert len(ev.criteria_results) == 1
        assert ev.criteria_results[0].passed is True

    def test_to_dict(self):
        ev = AgentEvaluation(run_id="r1", score=0.75, overall_passed=False)
        d = ev.to_dict()
        assert d["score"] == 0.75
        assert d["overall_passed"] is False

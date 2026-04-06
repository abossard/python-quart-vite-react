"""Tests for data models — validation boundaries and serialization contracts."""

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
    SuccessCriteria,
)


# ---------------------------------------------------------------------------
# AgentRequest — validation boundary
# ---------------------------------------------------------------------------

class TestAgentRequest:
    def test_valid_request(self):
        req = AgentRequest(prompt="Hello world")
        assert req.prompt == "Hello world"
        assert req.agent_type == "task_assistant"

    @pytest.mark.parametrize("bad_prompt", ["", "   "])
    def test_rejects_invalid_prompt(self, bad_prompt):
        with pytest.raises(ValidationError):
            AgentRequest(prompt=bad_prompt)

    def test_strips_whitespace(self):
        assert AgentRequest(prompt="  hello  ").prompt == "hello"


# ---------------------------------------------------------------------------
# AgentDefinitionCreate — validation boundaries
# ---------------------------------------------------------------------------

class TestAgentDefinitionCreate:
    def test_valid_create_with_defaults(self):
        data = AgentDefinitionCreate(name="Test", system_prompt="You are helpful")
        assert data.temperature == 0.0
        assert data.recursion_limit == 3
        assert data.requires_input is False

    @pytest.mark.parametrize("field, bad_value", [
        ("temperature", 3.0),
        ("temperature", -0.1),
        ("recursion_limit", 0),
        ("recursion_limit", 101),
    ])
    def test_rejects_out_of_range(self, field, bad_value):
        with pytest.raises(ValidationError):
            AgentDefinitionCreate(name="x", system_prompt="y", **{field: bad_value})

    @pytest.mark.parametrize("field, bad_value", [
        ("name", ""),
        ("system_prompt", ""),
    ])
    def test_rejects_empty_required(self, field, bad_value):
        with pytest.raises(ValidationError):
            AgentDefinitionCreate(**{"name": "x", "system_prompt": "y", field: bad_value})


# ---------------------------------------------------------------------------
# SQLModel JSON property roundtrips (non-obvious serialization behavior)
# ---------------------------------------------------------------------------

class TestAgentDefinitionJsonProperties:
    def test_tool_names_roundtrip(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        agent.tool_names = ["a", "b"]
        assert agent.tool_names == ["a", "b"]

    def test_success_criteria_roundtrip(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        criteria = [SuccessCriteria(type=CriteriaType.NO_ERROR, value="")]
        agent.success_criteria = criteria
        assert len(agent.success_criteria) == 1
        assert agent.success_criteria[0].type == CriteriaType.NO_ERROR

    def test_output_schema_roundtrip(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        schema = {"type": "object", "properties": {"count": {"type": "integer"}}}
        agent.output_schema = schema
        assert agent.output_schema == schema
        assert agent.has_output_schema is True

    def test_empty_schema_not_active(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        assert agent.has_output_schema is False
        agent.output_schema = {"type": "object"}
        assert agent.has_output_schema is False

    def test_to_dict_contract(self):
        agent = AgentDefinition(name="test", system_prompt="x")
        agent.tool_names = ["csv_list_tickets"]
        d = agent.to_dict()
        assert d["name"] == "test"
        assert d["tool_names"] == ["csv_list_tickets"]
        assert "created_at" in d
        assert "output_schema" in d


class TestAgentRunJsonProperties:
    def test_tools_used_roundtrip(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        run.tools_used = ["tool_a", "tool_b"]
        assert run.tools_used == ["tool_a", "tool_b"]

    def test_agent_snapshot_roundtrip(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        run.agent_snapshot = {"name": "test", "tools": [1, 2]}
        assert run.agent_snapshot["name"] == "test"

    def test_to_dict_contract(self):
        run = AgentRun(agent_id="x", input_prompt="y")
        d = run.to_dict()
        assert d["agent_id"] == "x"
        assert d["status"] == "pending"
        assert "created_at" in d


class TestAgentEvaluationJsonProperties:
    def test_criteria_results_roundtrip(self):
        ev = AgentEvaluation(run_id="r1")
        criteria = SuccessCriteria(type=CriteriaType.NO_ERROR, value="")
        ev.criteria_results = [CriteriaResult(criteria=criteria, passed=True)]
        assert len(ev.criteria_results) == 1
        assert ev.criteria_results[0].passed is True

    def test_to_dict_contract(self):
        ev = AgentEvaluation(run_id="r1", score=0.75, overall_passed=False)
        d = ev.to_dict()
        assert d["score"] == 0.75
        assert d["overall_passed"] is False

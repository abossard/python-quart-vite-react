"""Tests for WorkbenchService — deep module boundary tests with real SQLite."""

import pytest

from agent_builder.models import (
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
)


class TestWorkbenchServiceCRUD:
    def test_create_and_get_agent(self, workbench_service):
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="Test Agent",
            system_prompt="You are helpful",
            tool_names=["csv_ticket_stats"],
        ))
        assert agent.id is not None
        assert workbench_service.get_agent(agent.id).name == "Test Agent"

    def test_list_agents(self, workbench_service):
        workbench_service.create_agent(AgentDefinitionCreate(name="A1", system_prompt="x", tool_names=["csv_ticket_stats"]))
        workbench_service.create_agent(AgentDefinitionCreate(name="A2", system_prompt="y", tool_names=["csv_list_tickets"]))
        assert len(workbench_service.list_agents()) == 2

    def test_update_agent(self, workbench_service):
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="Old Name", system_prompt="x", tool_names=["csv_ticket_stats"],
        ))
        updated = workbench_service.update_agent(agent.id, AgentDefinitionUpdate(name="New Name"))
        assert updated.name == "New Name"

    def test_delete_agent(self, workbench_service):
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="To Delete", system_prompt="x", tool_names=["csv_ticket_stats"],
        ))
        assert workbench_service.delete_agent(agent.id) is True
        assert workbench_service.get_agent(agent.id) is None

    def test_delete_nonexistent_returns_false(self, workbench_service):
        assert workbench_service.delete_agent("nonexistent") is False

    def test_update_nonexistent_returns_none(self, workbench_service):
        assert workbench_service.update_agent("nonexistent", AgentDefinitionUpdate(name="x")) is None

    def test_unknown_tool_raises(self, workbench_service):
        with pytest.raises(ValueError, match="Unknown tool"):
            workbench_service.create_agent(AgentDefinitionCreate(
                name="Bad", system_prompt="x", tool_names=["nonexistent_tool"],
            ))

    def test_requires_input_validation(self, workbench_service):
        with pytest.raises(ValueError, match="required_input_description"):
            workbench_service.create_agent(AgentDefinitionCreate(
                name="Bad", system_prompt="x",
                requires_input=True, required_input_description="",
                tool_names=["csv_ticket_stats"],
            ))

    def test_requires_input_success(self, workbench_service):
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="Input Agent", system_prompt="x",
            requires_input=True, required_input_description="Ticket number",
            tool_names=["csv_ticket_stats"],
        ))
        assert agent.requires_input is True
        assert agent.required_input_description == "Ticket number"

    def test_create_agent_with_llm_config(self, workbench_service):
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="Custom LLM", system_prompt="Be creative",
            tool_names=["csv_ticket_stats"],
            model="gpt-4o", temperature=0.8, recursion_limit=20, max_tokens=2048,
            output_instructions="Respond in bullet points only",
        ))
        assert agent.model == "gpt-4o"
        assert agent.temperature == 0.8
        assert agent.recursion_limit == 20

    def test_create_agent_with_output_schema(self, workbench_service):
        schema = {
            "type": "object",
            "properties": {
                "breaches": {"type": "array", "items": {"type": "object"}},
                "total": {"type": "integer"},
            },
        }
        agent = workbench_service.create_agent(AgentDefinitionCreate(
            name="Schema Agent", system_prompt="Analyze SLA",
            tool_names=["csv_ticket_stats"], output_schema=schema,
        ))
        assert agent.has_output_schema is True
        assert agent.output_schema["properties"]["total"]["type"] == "integer"


class TestWorkbenchServiceToolIntrospection:
    def test_list_tools(self, workbench_service):
        tools = workbench_service.list_tools()
        names = [t["name"] for t in tools]
        assert "csv_ticket_stats" in names
        assert "csv_list_tickets" in names

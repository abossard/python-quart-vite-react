"""Tests for WorkbenchService with real SQLite (temp DB) but mocked LLM."""

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from agent_builder import WorkbenchService
from agent_builder.models import (
    AgentDefinitionCreate,
    AgentDefinitionUpdate,
    CriteriaType,
    SuccessCriteria,
)
from agent_builder.tools import ToolRegistry


class _FakeTool:
    def __init__(self, name: str):
        self.name = name
        self.description = f"Fake tool: {name}"
        self.args_schema = None


def _make_service(tmp_path: Path) -> WorkbenchService:
    registry = ToolRegistry()
    registry.register_all([_FakeTool("csv_ticket_stats"), _FakeTool("csv_list_tickets")])
    svc = WorkbenchService(
        tool_registry=registry,
        db_path=tmp_path / "test.db",
        openai_api_key="test-key",
    )
    svc._llm = object()  # prevent real API calls
    return svc


class TestWorkbenchServiceCRUD:
    def test_create_and_get_agent(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            agent = svc.create_agent(AgentDefinitionCreate(
                name="Test Agent",
                system_prompt="You are helpful",
                tool_names=["csv_ticket_stats"],
            ))
            assert agent.id is not None
            assert agent.name == "Test Agent"

            fetched = svc.get_agent(agent.id)
            assert fetched is not None
            assert fetched.name == "Test Agent"

    def test_list_agents(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            svc.create_agent(AgentDefinitionCreate(name="A1", system_prompt="x", tool_names=["csv_ticket_stats"]))
            svc.create_agent(AgentDefinitionCreate(name="A2", system_prompt="y", tool_names=["csv_list_tickets"]))
            agents = svc.list_agents()
            assert len(agents) == 2

    def test_update_agent(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            agent = svc.create_agent(AgentDefinitionCreate(
                name="Old Name",
                system_prompt="x",
                tool_names=["csv_ticket_stats"],
            ))
            updated = svc.update_agent(agent.id, AgentDefinitionUpdate(name="New Name"))
            assert updated is not None
            assert updated.name == "New Name"

    def test_delete_agent(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            agent = svc.create_agent(AgentDefinitionCreate(
                name="To Delete",
                system_prompt="x",
                tool_names=["csv_ticket_stats"],
            ))
            assert svc.delete_agent(agent.id) is True
            assert svc.get_agent(agent.id) is None

    def test_delete_nonexistent_returns_false(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            assert svc.delete_agent("nonexistent") is False

    def test_update_nonexistent_returns_none(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            assert svc.update_agent("nonexistent", AgentDefinitionUpdate(name="x")) is None

    def test_unknown_tool_raises(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            with pytest.raises(ValueError, match="Unknown tool"):
                svc.create_agent(AgentDefinitionCreate(
                    name="Bad",
                    system_prompt="x",
                    tool_names=["nonexistent_tool"],
                ))

    def test_requires_input_validation(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            with pytest.raises(ValueError, match="required_input_description"):
                svc.create_agent(AgentDefinitionCreate(
                    name="Bad",
                    system_prompt="x",
                    requires_input=True,
                    required_input_description="",
                    tool_names=["csv_ticket_stats"],
                ))

    def test_requires_input_success(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            agent = svc.create_agent(AgentDefinitionCreate(
                name="Input Agent",
                system_prompt="x",
                requires_input=True,
                required_input_description="Ticket number",
                tool_names=["csv_ticket_stats"],
            ))
            assert agent.requires_input is True
            assert agent.required_input_description == "Ticket number"


class TestWorkbenchServiceToolIntrospection:
    def test_list_tools(self):
        with TemporaryDirectory() as tmp:
            svc = _make_service(Path(tmp))
            tools = svc.list_tools()
            names = [t["name"] for t in tools]
            assert "csv_ticket_stats" in names
            assert "csv_list_tickets" in names

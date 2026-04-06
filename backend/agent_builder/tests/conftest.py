"""Shared fixtures for agent_builder tests.

Eliminates TemporaryDirectory boilerplate and provides ready-to-use
service instances with fake tools and LLM factory.
"""

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from agent_builder import WorkbenchService
from agent_builder.llm_protocol import LLMConfig
from agent_builder.persistence import AgentRepository, build_engine
from agent_builder.tools import ToolRegistry


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

class FakeTool:
    """Minimal tool stub with a .name attribute."""
    def __init__(self, name: str):
        self.name = name
        self.description = f"Fake tool: {name}"
        self.args_schema = None


TOOL_NAMES = ["csv_ticket_stats", "csv_list_tickets"]


def fake_llm_factory(config: LLMConfig):
    """Stub factory that returns a sentinel (never calls a real LLM)."""
    return object()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_db_path():
    """Yield a temporary directory Path, cleaned up after the test."""
    with TemporaryDirectory() as tmp:
        yield Path(tmp)


@pytest.fixture
def tool_registry():
    """ToolRegistry pre-loaded with fake csv tools."""
    registry = ToolRegistry()
    registry.register_all([FakeTool(n) for n in TOOL_NAMES])
    return registry


@pytest.fixture
def workbench_service(tmp_db_path, tool_registry):
    """WorkbenchService with real SQLite temp DB but no real LLM."""
    svc = WorkbenchService(
        tool_registry=tool_registry,
        llm_factory=fake_llm_factory,
        db_path=tmp_db_path / "test.db",
    )
    svc._llm = object()
    return svc


@pytest.fixture
def repo(tmp_db_path):
    """AgentRepository backed by a temporary SQLite DB."""
    engine = build_engine(tmp_db_path / "test.db")
    return AgentRepository(engine)

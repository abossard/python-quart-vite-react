"""
Tests for PostgresRepository — runs full CRUD test suite against real PostgreSQL.

Requires: docker compose up -f docker-compose.test.yml
          pip install psycopg

Run: pytest agent_builder/tests/test_postgres_repository.py -v

Skipped automatically if PostgreSQL is not reachable.
"""

import os

import pytest

# Skip the entire module if psycopg is not installed or PG not reachable
psycopg = pytest.importorskip("psycopg")

PG_CONN_STRING = os.environ.get(
    "TEST_PG_CONN_STRING",
    "host=localhost port=15432 dbname=testdb user=testuser password=testpass",
)


def _pg_is_available() -> bool:
    try:
        conn = psycopg.connect(PG_CONN_STRING, connect_timeout=3)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_is_available(),
    reason="PostgreSQL not reachable (start with: docker compose -f docker-compose.test.yml up -d)",
)


@pytest.fixture(autouse=True)
def clean_tables():
    """Drop and recreate all workbench tables before each test."""
    conn = psycopg.connect(PG_CONN_STRING)
    with conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS workbench_thread_messages CASCADE")
        cur.execute("DROP TABLE IF EXISTS workbench_threads CASCADE")
        cur.execute("DROP TABLE IF EXISTS workbench_agent_evaluations CASCADE")
        cur.execute("DROP TABLE IF EXISTS workbench_agent_runs CASCADE")
        cur.execute("DROP TABLE IF EXISTS workbench_agent_definitions CASCADE")
    conn.commit()
    conn.close()
    yield


@pytest.fixture
def repo():
    from agent_builder.persistence.postgres import PostgresRepository
    return PostgresRepository(conn_string=PG_CONN_STRING)


# ========================================================================
# Same test suite as test_persistence.py — proving backend parity
# ========================================================================

from agent_builder.models import AgentDefinition, AgentRun, RunStatus


class TestPostgresAgentRepository:
    def test_create_and_get_agent(self, repo):
        agent = AgentDefinition(name="test", system_prompt="x")
        created = repo.create_agent(agent)
        assert created.id is not None
        fetched = repo.get_agent(created.id)
        assert fetched is not None
        assert fetched.name == "test"

    def test_list_agents(self, repo):
        repo.create_agent(AgentDefinition(name="a1", system_prompt="x"))
        repo.create_agent(AgentDefinition(name="a2", system_prompt="y"))
        assert len(repo.list_agents()) == 2

    def test_delete_agent(self, repo):
        agent = repo.create_agent(AgentDefinition(name="del", system_prompt="x"))
        assert repo.delete_agent(agent.id) is True
        assert repo.get_agent(agent.id) is None
        assert repo.delete_agent(agent.id) is False

    def test_update_agent(self, repo):
        agent = repo.create_agent(AgentDefinition(name="old", system_prompt="x"))
        agent.name = "new"
        updated = repo.update_agent(agent)
        assert updated.name == "new"
        fetched = repo.get_agent(agent.id)
        assert fetched.name == "new"

    def test_create_and_get_run(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        assert run.id is not None
        fetched = repo.get_run(run.id)
        assert fetched is not None
        assert fetched.input_prompt == "test"

    def test_list_runs(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        repo.create_run(AgentRun(agent_id=agent.id, input_prompt="r1"))
        repo.create_run(AgentRun(agent_id=agent.id, input_prompt="r2"))
        assert len(repo.list_runs(agent_id=agent.id)) == 2

    def test_list_runs_with_limit(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        for i in range(5):
            repo.create_run(AgentRun(agent_id=agent.id, input_prompt=f"r{i}"))
        assert len(repo.list_runs(agent_id=agent.id, limit=2)) == 2

    def test_update_run(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        updated = repo.update_run(run.id, status=RunStatus.COMPLETED.value, output="done")
        assert updated.status == "completed"
        assert updated.output == "done"

    def test_update_run_nonexistent(self, repo):
        assert repo.update_run("nonexistent", status="x") is None

    def test_upsert_evaluation_creates(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        ev = repo.upsert_evaluation(run.id, score=0.75, overall_passed=False)
        assert ev.score == 0.75

    def test_upsert_evaluation_updates(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        repo.upsert_evaluation(run.id, score=0.5, overall_passed=False)
        ev2 = repo.upsert_evaluation(run.id, score=1.0, overall_passed=True)
        assert ev2.score == 1.0
        assert ev2.overall_passed is True

    def test_get_evaluation(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        assert repo.get_evaluation(run.id) is None
        repo.upsert_evaluation(run.id, score=1.0, overall_passed=True)
        assert repo.get_evaluation(run.id).score == 1.0

    def test_json_fields_roundtrip(self, repo):
        """Verify JSON fields survive write→read through PostgreSQL."""
        agent = AgentDefinition(name="json-test", system_prompt="x")
        agent.tool_names = ["tool_a", "tool_b"]
        agent.output_schema = {"type": "object", "properties": {"count": {"type": "integer"}}}
        created = repo.create_agent(agent)
        fetched = repo.get_agent(created.id)
        assert fetched.tool_names == ["tool_a", "tool_b"]
        assert fetched.output_schema["properties"]["count"]["type"] == "integer"
        assert fetched.has_output_schema is True

    def test_run_activity_log_roundtrip(self, repo):
        """Verify activity_log JSON survives write→read through PostgreSQL."""
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        activity = [{"event": "tool_call", "tool": "search"}, {"event": "complete"}]
        repo.update_run(run.id, activity_log=activity, tools_used=["search"])
        fetched = repo.get_run(run.id)
        assert len(fetched.activity_log) == 2
        assert fetched.tools_used == ["search"]

    def test_threads_and_messages(self, repo):
        """Test thread/message CRUD on PostgreSQL."""
        from agent_builder.models import ConversationThread, ThreadMessage

        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        thread = repo.create_thread(ConversationThread(agent_id=agent.id, title="Test Chat"))
        assert repo.get_thread(thread.id).title == "Test Chat"
        assert len(repo.list_threads(agent_id=agent.id)) == 1

        msg = repo.add_message(ThreadMessage(
            thread_id=thread.id, role="user", content="Hello",
        ))
        messages = repo.get_messages(thread.id)
        assert len(messages) == 1
        assert messages[0].content == "Hello"

        assert repo.delete_thread(thread.id) is True
        assert repo.get_thread(thread.id) is None

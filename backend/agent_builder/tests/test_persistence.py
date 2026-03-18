"""Tests for persistence layer — repository with real SQLite temp DB."""

from pathlib import Path
from tempfile import TemporaryDirectory

from agent_builder.models import AgentDefinition, AgentEvaluation, AgentRun, RunStatus, SuccessCriteria, CriteriaType
from agent_builder.persistence import AgentRepository, build_engine


def _make_repo(tmp_path: Path) -> AgentRepository:
    engine = build_engine(tmp_path / "test.db")
    return AgentRepository(engine)


class TestAgentRepository:
    def test_create_and_get_agent(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = AgentDefinition(name="test", system_prompt="x")
            created = repo.create_agent(agent)
            assert created.id is not None

            fetched = repo.get_agent(created.id)
            assert fetched is not None
            assert fetched.name == "test"

    def test_list_agents(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            repo.create_agent(AgentDefinition(name="a1", system_prompt="x"))
            repo.create_agent(AgentDefinition(name="a2", system_prompt="y"))
            agents = repo.list_agents()
            assert len(agents) == 2

    def test_delete_agent(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="del", system_prompt="x"))
            assert repo.delete_agent(agent.id) is True
            assert repo.get_agent(agent.id) is None
            assert repo.delete_agent(agent.id) is False

    def test_create_and_get_run(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            run = AgentRun(agent_id=agent.id, input_prompt="test")
            created = repo.create_run(run)
            assert created.id is not None

            fetched = repo.get_run(created.id)
            assert fetched is not None
            assert fetched.input_prompt == "test"

    def test_list_runs(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            repo.create_run(AgentRun(agent_id=agent.id, input_prompt="r1"))
            repo.create_run(AgentRun(agent_id=agent.id, input_prompt="r2"))
            runs = repo.list_runs(agent_id=agent.id)
            assert len(runs) == 2

    def test_list_runs_with_limit(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            for i in range(5):
                repo.create_run(AgentRun(agent_id=agent.id, input_prompt=f"r{i}"))
            runs = repo.list_runs(agent_id=agent.id, limit=2)
            assert len(runs) == 2

    def test_update_run(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
            updated = repo.update_run(run.id, status=RunStatus.COMPLETED.value, output="done")
            assert updated is not None
            assert updated.status == "completed"
            assert updated.output == "done"

    def test_update_run_nonexistent(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            assert repo.update_run("nonexistent", status="x") is None

    def test_upsert_evaluation_creates(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
            ev = repo.upsert_evaluation(run.id, score=0.75, overall_passed=False)
            assert ev.score == 0.75
            assert ev.overall_passed is False

    def test_upsert_evaluation_updates(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
            ev1 = repo.upsert_evaluation(run.id, score=0.5, overall_passed=False)
            ev2 = repo.upsert_evaluation(run.id, score=1.0, overall_passed=True)
            assert ev2.score == 1.0
            assert ev2.overall_passed is True

    def test_get_evaluation(self):
        with TemporaryDirectory() as tmp:
            repo = _make_repo(Path(tmp))
            agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
            run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
            assert repo.get_evaluation(run.id) is None
            repo.upsert_evaluation(run.id, score=1.0, overall_passed=True)
            ev = repo.get_evaluation(run.id)
            assert ev is not None
            assert ev.score == 1.0

"""Tests for persistence layer — repository with real SQLite temp DB."""

from agent_builder.models import AgentDefinition, AgentRun, RunStatus


class TestAgentRepository:
    def test_create_and_get_agent(self, repo):
        agent = AgentDefinition(name="test", system_prompt="x")
        created = repo.create_agent(agent)
        assert created.id is not None
        assert repo.get_agent(created.id).name == "test"

    def test_list_agents(self, repo):
        repo.create_agent(AgentDefinition(name="a1", system_prompt="x"))
        repo.create_agent(AgentDefinition(name="a2", system_prompt="y"))
        assert len(repo.list_agents()) == 2

    def test_delete_agent(self, repo):
        agent = repo.create_agent(AgentDefinition(name="del", system_prompt="x"))
        assert repo.delete_agent(agent.id) is True
        assert repo.get_agent(agent.id) is None
        assert repo.delete_agent(agent.id) is False

    def test_create_and_get_run(self, repo):
        agent = repo.create_agent(AgentDefinition(name="a", system_prompt="x"))
        run = repo.create_run(AgentRun(agent_id=agent.id, input_prompt="test"))
        assert run.id is not None
        assert repo.get_run(run.id).input_prompt == "test"

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

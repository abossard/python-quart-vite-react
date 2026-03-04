"""
Agent Builder — Repository

Action: all database read/write operations for agents, runs, evaluations.
Isolates persistence from business logic so the service is testable with a mock.
"""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from ..models import (
    AgentDefinition,
    AgentEvaluation,
    AgentRun,
    RunStatus,
)


class AgentRepository:
    """
    Database access for agent definitions, runs, and evaluations.

    Accepts a SQLAlchemy engine — the caller owns engine lifecycle.
    """

    def __init__(self, engine) -> None:
        self._engine = engine

    # ----- Agent Definitions -----

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition:
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

    def update_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with Session(self._engine) as session:
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

    # ----- Runs -----

    def create_run(self, run: AgentRun) -> AgentRun:
        with Session(self._engine) as session:
            session.add(run)
            session.commit()
            session.refresh(run)
        return run

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

    def update_run(self, run_id: str, **fields) -> Optional[AgentRun]:
        with Session(self._engine) as session:
            db_run = session.get(AgentRun, run_id)
            if db_run is None:
                return None
            for key, value in fields.items():
                setattr(db_run, key, value)
            session.add(db_run)
            session.commit()
            session.refresh(db_run)
            return db_run

    # ----- Evaluations -----

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]:
        with Session(self._engine) as session:
            stmt = select(AgentEvaluation).where(AgentEvaluation.run_id == run_id)
            return session.exec(stmt).first()

    def upsert_evaluation(self, run_id: str, **fields) -> AgentEvaluation:
        with Session(self._engine) as session:
            stmt = select(AgentEvaluation).where(AgentEvaluation.run_id == run_id)
            existing = session.exec(stmt).first()
            if existing:
                evaluation = existing
            else:
                evaluation = AgentEvaluation(run_id=run_id)
                session.add(evaluation)
            for key, value in fields.items():
                setattr(evaluation, key, value)
            evaluation.evaluated_at = datetime.now()
            session.commit()
            session.refresh(evaluation)
            return evaluation

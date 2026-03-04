"""
Agent Builder — Database Setup

Action: creates SQLite engine, runs migrations.
"""

from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, text


def build_engine(db_path: Path):
    """Create SQLite engine and run schema creation + migrations."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    SQLModel.metadata.create_all(engine)
    _run_migrations(engine)
    return engine


def _run_migrations(engine) -> None:
    """Apply lightweight SQLite migrations for new columns."""
    _ensure_column(engine, "workbench_agent_definitions", "requires_input", "BOOLEAN NOT NULL DEFAULT 0")
    _ensure_column(engine, "workbench_agent_definitions", "required_input_description", "TEXT NOT NULL DEFAULT ''")
    _ensure_column(engine, "workbench_agent_runs", "agent_snapshot", "TEXT NOT NULL DEFAULT '{}'")
    # LLM configuration columns (added for per-agent overrides)
    _ensure_column(engine, "workbench_agent_definitions", "model", "TEXT NOT NULL DEFAULT ''")
    _ensure_column(engine, "workbench_agent_definitions", "temperature", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(engine, "workbench_agent_definitions", "recursion_limit", "INTEGER NOT NULL DEFAULT 3")
    _ensure_column(engine, "workbench_agent_definitions", "max_tokens", "INTEGER NOT NULL DEFAULT 4096")
    _ensure_column(engine, "workbench_agent_definitions", "output_instructions", "TEXT NOT NULL DEFAULT ''")
    _ensure_column(engine, "workbench_agent_definitions", "output_schema", "TEXT NOT NULL DEFAULT '{}'")

def _ensure_column(engine, table_name: str, column_name: str, column_ddl: str) -> None:
    with Session(engine) as session:
        rows = list(session.exec(text(f"PRAGMA table_info({table_name})")).all())
        columns = {row[1] for row in rows if len(row) > 1}
        if column_name in columns:
            return
        session.exec(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_ddl}"))
        session.commit()

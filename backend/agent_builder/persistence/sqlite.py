"""
Agent Builder — SQLite Repository

Implements RepositoryProtocol using Python's stdlib sqlite3.
No external dependencies beyond the standard library.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ..models import (
    AgentDefinition,
    AgentEvaluation,
    AgentRun,
    ConversationThread,
    CriteriaResult,
    SuccessCriteria,
    ThreadMessage,
)
from ._json_helpers import (
    parse_datetime,
    parse_datetime_optional,
    safe_json_loads_dict,
    safe_json_loads_list,
    to_iso,
)

# Fields that store JSON in the database (field_name → serialize function)
_AGENT_JSON_FIELDS = {"tool_names", "success_criteria", "output_schema"}
_RUN_JSON_FIELDS = {"agent_snapshot", "tools_used", "activity_log"}
_EVAL_JSON_FIELDS = {"criteria_results"}
_MSG_JSON_FIELDS = {"message_metadata"}


def _serialize_json_field(key: str, value: Any) -> str:
    """Serialize a Python value to a JSON string for storage."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        items = []
        for item in value:
            if hasattr(item, "model_dump"):
                items.append(item.model_dump())
            else:
                items.append(item)
        return json.dumps(items)
    if isinstance(value, dict):
        return json.dumps(value)
    return json.dumps(value)


class SqliteRepository:
    """
    Repository backed by stdlib sqlite3.

    Accepts a db_path. Creates the database file and tables on init.
    Compatible with existing workbench.db files.
    """

    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db_path = str(db_path)
        self._setup_tables()
        self._run_migrations()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # ------------------------------------------------------------------
    # Schema setup
    # ------------------------------------------------------------------

    def _setup_tables(self) -> None:
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS workbench_agent_definitions (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    system_prompt TEXT NOT NULL,
                    requires_input INTEGER NOT NULL DEFAULT 0,
                    required_input_description TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    temperature REAL NOT NULL DEFAULT 0.0,
                    recursion_limit INTEGER NOT NULL DEFAULT 3,
                    max_tokens INTEGER NOT NULL DEFAULT 4096,
                    reasoning_effort TEXT NOT NULL DEFAULT 'low',
                    output_instructions TEXT NOT NULL DEFAULT '',
                    output_schema TEXT NOT NULL DEFAULT '{}',
                    show_in_menu INTEGER NOT NULL DEFAULT 0,
                    tool_names TEXT NOT NULL DEFAULT '[]',
                    success_criteria TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workbench_agent_runs (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL REFERENCES workbench_agent_definitions(id),
                    input_prompt TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    output TEXT,
                    agent_snapshot TEXT NOT NULL DEFAULT '{}',
                    tools_used TEXT NOT NULL DEFAULT '[]',
                    error TEXT,
                    activity_log TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                );

                CREATE TABLE IF NOT EXISTS workbench_agent_evaluations (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL UNIQUE REFERENCES workbench_agent_runs(id),
                    criteria_results TEXT NOT NULL DEFAULT '[]',
                    overall_passed INTEGER NOT NULL DEFAULT 0,
                    score REAL NOT NULL DEFAULT 0.0,
                    evaluated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workbench_threads (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL REFERENCES workbench_agent_definitions(id),
                    title TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workbench_thread_messages (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL REFERENCES workbench_threads(id),
                    role TEXT NOT NULL DEFAULT 'user',
                    content TEXT NOT NULL DEFAULT '',
                    tool_call_id TEXT,
                    tool_name TEXT,
                    message_metadata TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_agent_definitions_name
                    ON workbench_agent_definitions(name);
                CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id
                    ON workbench_agent_runs(agent_id);
                CREATE INDEX IF NOT EXISTS idx_evaluations_run_id
                    ON workbench_agent_evaluations(run_id);
                CREATE INDEX IF NOT EXISTS idx_threads_agent_id
                    ON workbench_threads(agent_id);
                CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id
                    ON workbench_thread_messages(thread_id);
            """)

    def _run_migrations(self) -> None:
        """Add columns that may be missing from older databases."""
        migrations = [
            ("workbench_agent_definitions", "requires_input", "INTEGER NOT NULL DEFAULT 0"),
            ("workbench_agent_definitions", "required_input_description", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "model", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "temperature", "REAL NOT NULL DEFAULT 0.0"),
            ("workbench_agent_definitions", "recursion_limit", "INTEGER NOT NULL DEFAULT 3"),
            ("workbench_agent_definitions", "max_tokens", "INTEGER NOT NULL DEFAULT 4096"),
            ("workbench_agent_definitions", "reasoning_effort", "TEXT NOT NULL DEFAULT 'low'"),
            ("workbench_agent_definitions", "output_instructions", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "output_schema", "TEXT NOT NULL DEFAULT '{}'"),
            ("workbench_agent_definitions", "show_in_menu", "INTEGER NOT NULL DEFAULT 0"),
            ("workbench_agent_runs", "agent_snapshot", "TEXT NOT NULL DEFAULT '{}'"),
            ("workbench_agent_runs", "activity_log", "TEXT NOT NULL DEFAULT '[]'"),
        ]
        with self._connect() as conn:
            for table, column, ddl in migrations:
                self._ensure_column(conn, table, column, ddl)

    @staticmethod
    def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        columns = {row["name"] for row in rows}
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    # ------------------------------------------------------------------
    # Row ↔ Model conversion
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_agent(row: sqlite3.Row) -> AgentDefinition:
        d = dict(row)
        return AgentDefinition(
            id=d["id"],
            name=d["name"],
            description=d.get("description", ""),
            system_prompt=d["system_prompt"],
            requires_input=bool(d.get("requires_input", 0)),
            required_input_description=d.get("required_input_description", ""),
            model=d.get("model", ""),
            temperature=float(d.get("temperature", 0.0)),
            recursion_limit=int(d.get("recursion_limit", 3)),
            max_tokens=int(d.get("max_tokens", 4096)),
            reasoning_effort=d.get("reasoning_effort", "low"),
            output_instructions=d.get("output_instructions", ""),
            output_schema=safe_json_loads_dict(d.get("output_schema", "{}")),
            show_in_menu=bool(d.get("show_in_menu", 0)),
            tool_names=safe_json_loads_list(d.get("tool_names", "[]")),
            success_criteria=[
                SuccessCriteria(**c) for c in safe_json_loads_list(d.get("success_criteria", "[]"))
                if isinstance(c, dict)
            ],
            created_at=parse_datetime(d.get("created_at")),
            updated_at=parse_datetime(d.get("updated_at")),
        )

    @staticmethod
    def _row_to_run(row: sqlite3.Row) -> AgentRun:
        d = dict(row)
        return AgentRun(
            id=d["id"],
            agent_id=d["agent_id"],
            input_prompt=d["input_prompt"],
            status=d.get("status", "pending"),
            output=d.get("output"),
            agent_snapshot=safe_json_loads_dict(d.get("agent_snapshot", "{}")),
            tools_used=safe_json_loads_list(d.get("tools_used", "[]")),
            error=d.get("error"),
            activity_log=safe_json_loads_list(d.get("activity_log", "[]")),
            created_at=parse_datetime(d.get("created_at")),
            completed_at=parse_datetime_optional(d.get("completed_at")),
        )

    @staticmethod
    def _row_to_evaluation(row: sqlite3.Row) -> AgentEvaluation:
        d = dict(row)
        raw_results = safe_json_loads_list(d.get("criteria_results", "[]"))
        criteria_results = []
        for r in raw_results:
            if isinstance(r, dict):
                try:
                    criteria_results.append(CriteriaResult(**r))
                except Exception:
                    pass
        return AgentEvaluation(
            id=d["id"],
            run_id=d["run_id"],
            criteria_results=criteria_results,
            overall_passed=bool(d.get("overall_passed", False)),
            score=float(d.get("score", 0.0)),
            evaluated_at=parse_datetime(d.get("evaluated_at")),
        )

    @staticmethod
    def _row_to_thread(row: sqlite3.Row) -> ConversationThread:
        d = dict(row)
        return ConversationThread(
            id=d["id"],
            agent_id=d["agent_id"],
            title=d.get("title", ""),
            status=d.get("status", "active"),
            created_at=parse_datetime(d.get("created_at")),
            updated_at=parse_datetime(d.get("updated_at")),
        )

    @staticmethod
    def _row_to_message(row: sqlite3.Row) -> ThreadMessage:
        d = dict(row)
        return ThreadMessage(
            id=d["id"],
            thread_id=d["thread_id"],
            role=d.get("role", "user"),
            content=d.get("content", ""),
            tool_call_id=d.get("tool_call_id"),
            tool_name=d.get("tool_name"),
            message_metadata=safe_json_loads_dict(d.get("message_metadata", "{}")),
            created_at=parse_datetime(d.get("created_at")),
        )

    # ------------------------------------------------------------------
    # Agent Definitions CRUD
    # ------------------------------------------------------------------

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO workbench_agent_definitions
                (id, name, description, system_prompt, requires_input,
                 required_input_description, model, temperature, recursion_limit,
                 max_tokens, reasoning_effort, output_instructions, output_schema,
                 show_in_menu, tool_names, success_criteria, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                agent.id, agent.name, agent.description, agent.system_prompt,
                int(agent.requires_input), agent.required_input_description,
                agent.model, agent.temperature, agent.recursion_limit,
                agent.max_tokens, agent.reasoning_effort, agent.output_instructions,
                json.dumps(agent.output_schema), int(agent.show_in_menu),
                json.dumps(agent.tool_names),
                json.dumps([c.model_dump() for c in agent.success_criteria]),
                agent.created_at.isoformat(), agent.updated_at.isoformat(),
            ))
        return agent

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM workbench_agent_definitions WHERE id = ?", (agent_id,)
            ).fetchone()
        return self._row_to_agent(row) if row else None

    def list_agents(self) -> list[AgentDefinition]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM workbench_agent_definitions").fetchall()
        return [self._row_to_agent(r) for r in rows]

    def update_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with self._connect() as conn:
            conn.execute("""
                UPDATE workbench_agent_definitions SET
                    name=?, description=?, system_prompt=?, requires_input=?,
                    required_input_description=?, model=?, temperature=?,
                    recursion_limit=?, max_tokens=?, reasoning_effort=?,
                    output_instructions=?, output_schema=?, show_in_menu=?,
                    tool_names=?, success_criteria=?, updated_at=?
                WHERE id=?
            """, (
                agent.name, agent.description, agent.system_prompt,
                int(agent.requires_input), agent.required_input_description,
                agent.model, agent.temperature, agent.recursion_limit,
                agent.max_tokens, agent.reasoning_effort, agent.output_instructions,
                json.dumps(agent.output_schema), int(agent.show_in_menu),
                json.dumps(agent.tool_names),
                json.dumps([c.model_dump() for c in agent.success_criteria]),
                agent.updated_at.isoformat(), agent.id,
            ))
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM workbench_agent_definitions WHERE id = ?", (agent_id,)
            )
        return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Runs CRUD
    # ------------------------------------------------------------------

    def create_run(self, run: AgentRun) -> AgentRun:
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO workbench_agent_runs
                (id, agent_id, input_prompt, status, output, agent_snapshot,
                 tools_used, error, activity_log, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run.id, run.agent_id, run.input_prompt, run.status, run.output,
                json.dumps(run.agent_snapshot), json.dumps(run.tools_used),
                run.error, json.dumps(run.activity_log),
                run.created_at.isoformat(), to_iso(run.completed_at),
            ))
        return run

    def get_run(self, run_id: str) -> Optional[AgentRun]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM workbench_agent_runs WHERE id = ?", (run_id,)
            ).fetchone()
        return self._row_to_run(row) if row else None

    def list_runs(self, agent_id: Optional[str] = None, limit: int = 50) -> list[AgentRun]:
        with self._connect() as conn:
            if agent_id:
                rows = conn.execute(
                    "SELECT * FROM workbench_agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
                    (agent_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM workbench_agent_runs ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [self._row_to_run(r) for r in rows]

    def update_run(self, run_id: str, **fields) -> Optional[AgentRun]:
        if not fields:
            return self.get_run(run_id)
        set_clauses = []
        params: list[Any] = []
        for key, value in fields.items():
            col = key
            if key in _RUN_JSON_FIELDS:
                value = _serialize_json_field(key, value)
            elif isinstance(value, datetime):
                value = value.isoformat()
            set_clauses.append(f"{col} = ?")
            params.append(value)
        params.append(run_id)
        with self._connect() as conn:
            conn.execute(
                f"UPDATE workbench_agent_runs SET {', '.join(set_clauses)} WHERE id = ?",
                params,
            )
        return self.get_run(run_id)

    def delete_all_runs(self) -> int:
        with self._connect() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM workbench_agent_runs")
            count = cursor.fetchone()[0]
            conn.execute("DELETE FROM workbench_agent_runs")
        return count

    # ------------------------------------------------------------------
    # Evaluations
    # ------------------------------------------------------------------

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM workbench_agent_evaluations WHERE run_id = ?", (run_id,)
            ).fetchone()
        return self._row_to_evaluation(row) if row else None

    def upsert_evaluation(self, run_id: str, **fields) -> AgentEvaluation:
        existing = self.get_evaluation(run_id)
        now = datetime.now()

        if existing:
            set_clauses = ["evaluated_at = ?"]
            params: list[Any] = [now.isoformat()]
            for key, value in fields.items():
                if key in _EVAL_JSON_FIELDS:
                    value = _serialize_json_field(key, value)
                set_clauses.append(f"{key} = ?")
                params.append(value)
            params.append(run_id)
            with self._connect() as conn:
                conn.execute(
                    f"UPDATE workbench_agent_evaluations SET {', '.join(set_clauses)} WHERE run_id = ?",
                    params,
                )
            return self.get_evaluation(run_id)  # type: ignore
        else:
            import uuid
            eval_id = str(uuid.uuid4())
            criteria_results = _serialize_json_field(
                "criteria_results", fields.get("criteria_results", [])
            )
            with self._connect() as conn:
                conn.execute("""
                    INSERT INTO workbench_agent_evaluations
                    (id, run_id, criteria_results, overall_passed, score, evaluated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    eval_id, run_id, criteria_results,
                    int(fields.get("overall_passed", False)),
                    float(fields.get("score", 0.0)),
                    now.isoformat(),
                ))
            return self.get_evaluation(run_id)  # type: ignore

    # ------------------------------------------------------------------
    # Threads
    # ------------------------------------------------------------------

    def create_thread(self, thread: ConversationThread) -> ConversationThread:
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO workbench_threads
                (id, agent_id, title, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                thread.id, thread.agent_id, thread.title, thread.status,
                thread.created_at.isoformat(), thread.updated_at.isoformat(),
            ))
        return thread

    def get_thread(self, thread_id: str) -> Optional[ConversationThread]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM workbench_threads WHERE id = ?", (thread_id,)
            ).fetchone()
        return self._row_to_thread(row) if row else None

    def list_threads(self, agent_id: Optional[str] = None, limit: int = 50) -> list[ConversationThread]:
        with self._connect() as conn:
            if agent_id:
                rows = conn.execute(
                    "SELECT * FROM workbench_threads WHERE agent_id = ? ORDER BY updated_at DESC LIMIT ?",
                    (agent_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM workbench_threads ORDER BY updated_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [self._row_to_thread(r) for r in rows]

    def update_thread(self, thread_id: str, **fields) -> Optional[ConversationThread]:
        now = datetime.now()
        set_clauses = ["updated_at = ?"]
        params: list[Any] = [now.isoformat()]
        for key, value in fields.items():
            if isinstance(value, datetime):
                value = value.isoformat()
            set_clauses.append(f"{key} = ?")
            params.append(value)
        params.append(thread_id)
        with self._connect() as conn:
            cursor = conn.execute(
                f"UPDATE workbench_threads SET {', '.join(set_clauses)} WHERE id = ?",
                params,
            )
        if cursor.rowcount == 0:
            return None
        return self.get_thread(thread_id)

    def delete_thread(self, thread_id: str) -> bool:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM workbench_thread_messages WHERE thread_id = ?", (thread_id,)
            )
            cursor = conn.execute(
                "DELETE FROM workbench_threads WHERE id = ?", (thread_id,)
            )
        return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Thread Messages
    # ------------------------------------------------------------------

    def add_message(self, message: ThreadMessage) -> ThreadMessage:
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO workbench_thread_messages
                (id, thread_id, role, content, tool_call_id, tool_name,
                 message_metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                message.id, message.thread_id, message.role, message.content,
                message.tool_call_id, message.tool_name,
                json.dumps(message.message_metadata),
                message.created_at.isoformat(),
            ))
        # Touch the thread's updated_at
        self.update_thread(message.thread_id)
        return message

    def get_messages(self, thread_id: str, limit: int = 200) -> list[ThreadMessage]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM workbench_thread_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?",
                (thread_id, limit),
            ).fetchall()
        return [self._row_to_message(r) for r in rows]

"""
Agent Builder — PostgreSQL Repository

Implements RepositoryProtocol using psycopg (v3).
No SQLAlchemy/SQLModel dependency — uses raw SQL.

Requires: psycopg >= 3.0

Usage:
    from agent_builder.persistence.postgres import PostgresRepository

    # With a connection factory (for token-refreshed connections):
    repo = PostgresRepository(conn_factory=lambda: psycopg.connect(conn_string))

    # With a static connection string:
    repo = PostgresRepository(conn_string="host=... dbname=... user=... password=...")
"""

import json
import uuid
from datetime import datetime
from typing import Any, Callable, Optional

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

# Fields requiring JSON serialization
_RUN_JSON_FIELDS = {"agent_snapshot", "tools_used", "activity_log"}
_EVAL_JSON_FIELDS = {"criteria_results"}


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


class PostgresRepository:
    """
    Repository backed by psycopg (PostgreSQL).

    Accepts either a conn_factory callable or a conn_string.
    conn_factory is preferred for Azure Entra ID token-based auth
    where tokens refresh periodically.
    """

    def __init__(
        self,
        conn_factory: Optional[Callable] = None,
        conn_string: Optional[str] = None,
    ) -> None:
        if conn_factory is None and conn_string is None:
            raise ValueError("Provide either conn_factory or conn_string")
        if conn_factory:
            self._conn_factory = conn_factory
        else:
            import psycopg
            self._conn_factory = lambda: psycopg.connect(conn_string, autocommit=False)
        self._setup_tables()
        self._run_migrations()

    def _connect(self):
        return self._conn_factory()

    # ------------------------------------------------------------------
    # Schema setup
    # ------------------------------------------------------------------

    def _setup_tables(self) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS workbench_agent_definitions (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL DEFAULT '',
                        system_prompt TEXT NOT NULL,
                        requires_input BOOLEAN NOT NULL DEFAULT FALSE,
                        required_input_description TEXT NOT NULL DEFAULT '',
                        model TEXT NOT NULL DEFAULT '',
                        temperature DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                        recursion_limit INTEGER NOT NULL DEFAULT 3,
                        max_tokens INTEGER NOT NULL DEFAULT 4096,
                        reasoning_effort TEXT NOT NULL DEFAULT 'low',
                        output_instructions TEXT NOT NULL DEFAULT '',
                        output_schema TEXT NOT NULL DEFAULT '{}',
                        show_in_menu BOOLEAN NOT NULL DEFAULT FALSE,
                        tool_names TEXT NOT NULL DEFAULT '[]',
                        success_criteria TEXT NOT NULL DEFAULT '[]',
                        created_at TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP NOT NULL
                    )
                """)
                cur.execute("""
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
                        created_at TIMESTAMP NOT NULL,
                        completed_at TIMESTAMP
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS workbench_agent_evaluations (
                        id TEXT PRIMARY KEY,
                        run_id TEXT NOT NULL UNIQUE REFERENCES workbench_agent_runs(id),
                        criteria_results TEXT NOT NULL DEFAULT '[]',
                        overall_passed BOOLEAN NOT NULL DEFAULT FALSE,
                        score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                        evaluated_at TIMESTAMP NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS workbench_threads (
                        id TEXT PRIMARY KEY,
                        agent_id TEXT NOT NULL REFERENCES workbench_agent_definitions(id),
                        title TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'active',
                        created_at TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS workbench_thread_messages (
                        id TEXT PRIMARY KEY,
                        thread_id TEXT NOT NULL REFERENCES workbench_threads(id),
                        role TEXT NOT NULL DEFAULT 'user',
                        content TEXT NOT NULL DEFAULT '',
                        tool_call_id TEXT,
                        tool_name TEXT,
                        message_metadata TEXT NOT NULL DEFAULT '{}',
                        created_at TIMESTAMP NOT NULL
                    )
                """)
                # Indexes
                for idx_sql in [
                    "CREATE INDEX IF NOT EXISTS idx_pg_agent_def_name ON workbench_agent_definitions(name)",
                    "CREATE INDEX IF NOT EXISTS idx_pg_runs_agent_id ON workbench_agent_runs(agent_id)",
                    "CREATE INDEX IF NOT EXISTS idx_pg_eval_run_id ON workbench_agent_evaluations(run_id)",
                    "CREATE INDEX IF NOT EXISTS idx_pg_threads_agent_id ON workbench_threads(agent_id)",
                    "CREATE INDEX IF NOT EXISTS idx_pg_msgs_thread_id ON workbench_thread_messages(thread_id)",
                ]:
                    cur.execute(idx_sql)
            conn.commit()

    def _run_migrations(self) -> None:
        """Add columns that may be missing from older databases."""
        migrations = [
            ("workbench_agent_definitions", "requires_input", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("workbench_agent_definitions", "required_input_description", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "model", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "temperature", "DOUBLE PRECISION NOT NULL DEFAULT 0.0"),
            ("workbench_agent_definitions", "recursion_limit", "INTEGER NOT NULL DEFAULT 3"),
            ("workbench_agent_definitions", "max_tokens", "INTEGER NOT NULL DEFAULT 4096"),
            ("workbench_agent_definitions", "reasoning_effort", "TEXT NOT NULL DEFAULT 'low'"),
            ("workbench_agent_definitions", "output_instructions", "TEXT NOT NULL DEFAULT ''"),
            ("workbench_agent_definitions", "output_schema", "TEXT NOT NULL DEFAULT '{}'"),
            ("workbench_agent_definitions", "show_in_menu", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("workbench_agent_runs", "agent_snapshot", "TEXT NOT NULL DEFAULT '{}'"),
            ("workbench_agent_runs", "activity_log", "TEXT NOT NULL DEFAULT '[]'"),
        ]
        with self._connect() as conn:
            with conn.cursor() as cur:
                for table, column, ddl in migrations:
                    self._ensure_column(cur, table, column, ddl)
            conn.commit()

    @staticmethod
    def _ensure_column(cur, table: str, column: str, ddl: str) -> None:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
        """, (table, column))
        if cur.fetchone() is None:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    # ------------------------------------------------------------------
    # Row → Model conversion
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_agent(row: dict) -> AgentDefinition:
        return AgentDefinition(
            id=row["id"],
            name=row["name"],
            description=row.get("description", ""),
            system_prompt=row["system_prompt"],
            requires_input=bool(row.get("requires_input", False)),
            required_input_description=row.get("required_input_description", ""),
            model=row.get("model", ""),
            temperature=float(row.get("temperature", 0.0)),
            recursion_limit=int(row.get("recursion_limit", 3)),
            max_tokens=int(row.get("max_tokens", 4096)),
            reasoning_effort=row.get("reasoning_effort", "low"),
            output_instructions=row.get("output_instructions", ""),
            output_schema=safe_json_loads_dict(row.get("output_schema", "{}")),
            show_in_menu=bool(row.get("show_in_menu", False)),
            tool_names=safe_json_loads_list(row.get("tool_names", "[]")),
            success_criteria=[
                SuccessCriteria(**c) for c in safe_json_loads_list(row.get("success_criteria", "[]"))
                if isinstance(c, dict)
            ],
            created_at=parse_datetime(row.get("created_at")),
            updated_at=parse_datetime(row.get("updated_at")),
        )

    @staticmethod
    def _row_to_run(row: dict) -> AgentRun:
        return AgentRun(
            id=row["id"],
            agent_id=row["agent_id"],
            input_prompt=row["input_prompt"],
            status=row.get("status", "pending"),
            output=row.get("output"),
            agent_snapshot=safe_json_loads_dict(row.get("agent_snapshot", "{}")),
            tools_used=safe_json_loads_list(row.get("tools_used", "[]")),
            error=row.get("error"),
            activity_log=safe_json_loads_list(row.get("activity_log", "[]")),
            created_at=parse_datetime(row.get("created_at")),
            completed_at=parse_datetime_optional(row.get("completed_at")),
        )

    @staticmethod
    def _row_to_evaluation(row: dict) -> AgentEvaluation:
        raw_results = safe_json_loads_list(row.get("criteria_results", "[]"))
        criteria_results = []
        for r in raw_results:
            if isinstance(r, dict):
                try:
                    criteria_results.append(CriteriaResult(**r))
                except Exception:
                    pass
        return AgentEvaluation(
            id=row["id"],
            run_id=row["run_id"],
            criteria_results=criteria_results,
            overall_passed=bool(row.get("overall_passed", False)),
            score=float(row.get("score", 0.0)),
            evaluated_at=parse_datetime(row.get("evaluated_at")),
        )

    @staticmethod
    def _row_to_thread(row: dict) -> ConversationThread:
        return ConversationThread(
            id=row["id"],
            agent_id=row["agent_id"],
            title=row.get("title", ""),
            status=row.get("status", "active"),
            created_at=parse_datetime(row.get("created_at")),
            updated_at=parse_datetime(row.get("updated_at")),
        )

    @staticmethod
    def _row_to_message(row: dict) -> ThreadMessage:
        return ThreadMessage(
            id=row["id"],
            thread_id=row["thread_id"],
            role=row.get("role", "user"),
            content=row.get("content", ""),
            tool_call_id=row.get("tool_call_id"),
            tool_name=row.get("tool_name"),
            message_metadata=safe_json_loads_dict(row.get("message_metadata", "{}")),
            created_at=parse_datetime(row.get("created_at")),
        )

    @staticmethod
    def _fetchone_dict(cur) -> Optional[dict]:
        row = cur.fetchone()
        if row is None:
            return None
        cols = [desc[0] for desc in cur.description]
        return dict(zip(cols, row))

    @staticmethod
    def _fetchall_dicts(cur) -> list[dict]:
        rows = cur.fetchall()
        if not rows:
            return []
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    # ------------------------------------------------------------------
    # Agent Definitions CRUD
    # ------------------------------------------------------------------

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workbench_agent_definitions
                    (id, name, description, system_prompt, requires_input,
                     required_input_description, model, temperature, recursion_limit,
                     max_tokens, reasoning_effort, output_instructions, output_schema,
                     show_in_menu, tool_names, success_criteria, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    agent.id, agent.name, agent.description, agent.system_prompt,
                    agent.requires_input, agent.required_input_description,
                    agent.model, agent.temperature, agent.recursion_limit,
                    agent.max_tokens, agent.reasoning_effort, agent.output_instructions,
                    json.dumps(agent.output_schema), agent.show_in_menu,
                    json.dumps(agent.tool_names),
                    json.dumps([c.model_dump() for c in agent.success_criteria]),
                    agent.created_at, agent.updated_at,
                ))
            conn.commit()
        return agent

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workbench_agent_definitions WHERE id = %s", (agent_id,))
                row = self._fetchone_dict(cur)
        return self._row_to_agent(row) if row else None

    def list_agents(self) -> list[AgentDefinition]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workbench_agent_definitions")
                rows = self._fetchall_dicts(cur)
        return [self._row_to_agent(r) for r in rows]

    def update_agent(self, agent: AgentDefinition) -> AgentDefinition:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE workbench_agent_definitions SET
                        name=%s, description=%s, system_prompt=%s, requires_input=%s,
                        required_input_description=%s, model=%s, temperature=%s,
                        recursion_limit=%s, max_tokens=%s, reasoning_effort=%s,
                        output_instructions=%s, output_schema=%s, show_in_menu=%s,
                        tool_names=%s, success_criteria=%s, updated_at=%s
                    WHERE id=%s
                """, (
                    agent.name, agent.description, agent.system_prompt,
                    agent.requires_input, agent.required_input_description,
                    agent.model, agent.temperature, agent.recursion_limit,
                    agent.max_tokens, agent.reasoning_effort, agent.output_instructions,
                    json.dumps(agent.output_schema), agent.show_in_menu,
                    json.dumps(agent.tool_names),
                    json.dumps([c.model_dump() for c in agent.success_criteria]),
                    agent.updated_at, agent.id,
                ))
            conn.commit()
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM workbench_agent_definitions WHERE id = %s", (agent_id,))
                deleted = cur.rowcount > 0
            conn.commit()
        return deleted

    # ------------------------------------------------------------------
    # Runs CRUD
    # ------------------------------------------------------------------

    def create_run(self, run: AgentRun) -> AgentRun:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workbench_agent_runs
                    (id, agent_id, input_prompt, status, output, agent_snapshot,
                     tools_used, error, activity_log, created_at, completed_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    run.id, run.agent_id, run.input_prompt, run.status, run.output,
                    json.dumps(run.agent_snapshot), json.dumps(run.tools_used),
                    run.error, json.dumps(run.activity_log),
                    run.created_at, run.completed_at,
                ))
            conn.commit()
        return run

    def get_run(self, run_id: str) -> Optional[AgentRun]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workbench_agent_runs WHERE id = %s", (run_id,))
                row = self._fetchone_dict(cur)
        return self._row_to_run(row) if row else None

    def list_runs(self, agent_id: Optional[str] = None, limit: int = 50) -> list[AgentRun]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                if agent_id:
                    cur.execute(
                        "SELECT * FROM workbench_agent_runs WHERE agent_id = %s ORDER BY created_at DESC LIMIT %s",
                        (agent_id, limit),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM workbench_agent_runs ORDER BY created_at DESC LIMIT %s",
                        (limit,),
                    )
                rows = self._fetchall_dicts(cur)
        return [self._row_to_run(r) for r in rows]

    def update_run(self, run_id: str, **fields) -> Optional[AgentRun]:
        if not fields:
            return self.get_run(run_id)
        set_clauses = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in _RUN_JSON_FIELDS:
                value = _serialize_json_field(key, value)
            set_clauses.append(f"{key} = %s")
            params.append(value)
        params.append(run_id)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE workbench_agent_runs SET {', '.join(set_clauses)} WHERE id = %s",
                    params,
                )
            conn.commit()
        return self.get_run(run_id)

    def delete_all_runs(self) -> int:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM workbench_agent_runs")
                count = cur.fetchone()[0]
                cur.execute("DELETE FROM workbench_agent_runs")
            conn.commit()
        return count

    # ------------------------------------------------------------------
    # Evaluations
    # ------------------------------------------------------------------

    def get_evaluation(self, run_id: str) -> Optional[AgentEvaluation]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workbench_agent_evaluations WHERE run_id = %s", (run_id,))
                row = self._fetchone_dict(cur)
        return self._row_to_evaluation(row) if row else None

    def upsert_evaluation(self, run_id: str, **fields) -> AgentEvaluation:
        existing = self.get_evaluation(run_id)
        now = datetime.now()

        if existing:
            set_clauses = ["evaluated_at = %s"]
            params: list[Any] = [now]
            for key, value in fields.items():
                if key in _EVAL_JSON_FIELDS:
                    value = _serialize_json_field(key, value)
                set_clauses.append(f"{key} = %s")
                params.append(value)
            params.append(run_id)
            with self._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE workbench_agent_evaluations SET {', '.join(set_clauses)} WHERE run_id = %s",
                        params,
                    )
                conn.commit()
            return self.get_evaluation(run_id)  # type: ignore
        else:
            eval_id = str(uuid.uuid4())
            criteria_results = _serialize_json_field(
                "criteria_results", fields.get("criteria_results", [])
            )
            with self._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO workbench_agent_evaluations
                        (id, run_id, criteria_results, overall_passed, score, evaluated_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        eval_id, run_id, criteria_results,
                        bool(fields.get("overall_passed", False)),
                        float(fields.get("score", 0.0)),
                        now,
                    ))
                conn.commit()
            return self.get_evaluation(run_id)  # type: ignore

    # ------------------------------------------------------------------
    # Threads
    # ------------------------------------------------------------------

    def create_thread(self, thread: ConversationThread) -> ConversationThread:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workbench_threads
                    (id, agent_id, title, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    thread.id, thread.agent_id, thread.title, thread.status,
                    thread.created_at, thread.updated_at,
                ))
            conn.commit()
        return thread

    def get_thread(self, thread_id: str) -> Optional[ConversationThread]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workbench_threads WHERE id = %s", (thread_id,))
                row = self._fetchone_dict(cur)
        return self._row_to_thread(row) if row else None

    def list_threads(self, agent_id: Optional[str] = None, limit: int = 50) -> list[ConversationThread]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                if agent_id:
                    cur.execute(
                        "SELECT * FROM workbench_threads WHERE agent_id = %s ORDER BY updated_at DESC LIMIT %s",
                        (agent_id, limit),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM workbench_threads ORDER BY updated_at DESC LIMIT %s",
                        (limit,),
                    )
                rows = self._fetchall_dicts(cur)
        return [self._row_to_thread(r) for r in rows]

    def update_thread(self, thread_id: str, **fields) -> Optional[ConversationThread]:
        now = datetime.now()
        set_clauses = ["updated_at = %s"]
        params: list[Any] = [now]
        for key, value in fields.items():
            set_clauses.append(f"{key} = %s")
            params.append(value)
        params.append(thread_id)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE workbench_threads SET {', '.join(set_clauses)} WHERE id = %s",
                    params,
                )
                updated = cur.rowcount > 0
            conn.commit()
        if not updated:
            return None
        return self.get_thread(thread_id)

    def delete_thread(self, thread_id: str) -> bool:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM workbench_thread_messages WHERE thread_id = %s", (thread_id,))
                cur.execute("DELETE FROM workbench_threads WHERE id = %s", (thread_id,))
                deleted = cur.rowcount > 0
            conn.commit()
        return deleted

    # ------------------------------------------------------------------
    # Thread Messages
    # ------------------------------------------------------------------

    def add_message(self, message: ThreadMessage) -> ThreadMessage:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workbench_thread_messages
                    (id, thread_id, role, content, tool_call_id, tool_name,
                     message_metadata, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    message.id, message.thread_id, message.role, message.content,
                    message.tool_call_id, message.tool_name,
                    json.dumps(message.message_metadata),
                    message.created_at,
                ))
            conn.commit()
        self.update_thread(message.thread_id)
        return message

    def get_messages(self, thread_id: str, limit: int = 200) -> list[ThreadMessage]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM workbench_thread_messages WHERE thread_id = %s ORDER BY created_at ASC LIMIT %s",
                    (thread_id, limit),
                )
                rows = self._fetchall_dicts(cur)
        return [self._row_to_message(r) for r in rows]

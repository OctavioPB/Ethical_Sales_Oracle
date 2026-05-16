"""PostgreSQL repository for utterances. All PII must be redacted before calling insert_utterances."""

from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generator, Sequence

import psycopg2
import psycopg2.extras
import psycopg2.pool


@dataclass
class UtteranceRow:
    call_id: str
    speaker: str          # "AGENT" | "CUSTOMER"
    utterance: str
    pii_redacted: bool
    started_at: datetime
    ended_at: datetime


# Module-level connection pool — shared across all UtteranceRepository instances
# in a process.  min/max sized for Airflow LocalExecutor (1 worker per DAG run).
_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool(database_url: str) -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=int(os.getenv("DB_POOL_MAX", "10")),
            dsn=database_url,
        )
    return _pool


class UtteranceRepository:
    def __init__(self, database_url: str) -> None:
        self._url = database_url

    @contextmanager
    def _conn(self) -> Generator[Any, None, None]:
        pool = _get_pool(self._url)
        conn = pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    def insert_utterances(self, call_id: str, utterances: Sequence[UtteranceRow]) -> int:
        if not utterances:
            return 0
        rows = [
            (u.call_id, u.speaker, u.utterance, u.pii_redacted, u.started_at, u.ended_at)
            for u in utterances
        ]
        with self._conn() as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO utterances
                        (call_id, speaker, utterance, pii_redacted, started_at, ended_at)
                    VALUES %s
                    """,
                    rows,
                )
                return cur.rowcount

    def get_utterances(self, call_id: str) -> list[UtteranceRow]:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM utterances WHERE call_id = %s ORDER BY started_at",
                    (call_id,),
                )
                return [
                    UtteranceRow(
                        call_id=str(r["call_id"]),
                        speaker=r["speaker"],
                        utterance=r["utterance"],
                        pii_redacted=r["pii_redacted"],
                        started_at=r["started_at"],
                        ended_at=r["ended_at"],
                    )
                    for r in cur.fetchall()
                ]

    def ensure_call_exists(self, call_id: str, region: str, desk_id: str, agent_id: str) -> None:
        """Inserts a call record if one does not already exist (idempotent)."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO calls (call_id, region, desk_id, agent_id, started_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (call_id) DO NOTHING
                    """,
                    (call_id, region, desk_id, agent_id),
                )

"""
Publishes CallRiskScore to eso.scores.calls (Kafka) and call_risk_scores (PostgreSQL).

Dual-write strategy mirrors the RiskEventPublisher pattern: Kafka is the source of
truth for downstream consumers (dashboard WebSocket, alerting); PostgreSQL is for
queries (compliance reports, trend analytics on the TimescaleDB hypertable).
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Generator

import psycopg2
from kafka import KafkaProducer

from risk_types import CallRiskScore, LLMScoreResult

_SCORE_TOPIC = "eso.scores.calls"


class CallScorePublisher:
    """
    Instantiate once per Airflow task. close() must be called when done
    (use try/finally in the task body).
    """

    def __init__(self, brokers: list[str], database_url: str) -> None:
        self._producer = KafkaProducer(
            bootstrap_servers=brokers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=3,
            max_block_ms=10_000,
        )
        self._db_url = database_url

    def publish(self, score: CallRiskScore, llm_result: LLMScoreResult) -> None:
        """
        Sends the call score to Kafka and writes to both DB tables.
        Raises on Kafka or DB failure — the DAG retry mechanism handles recovery.
        """
        payload = score.to_dict()
        self._producer.send(
            _SCORE_TOPIC,
            key=score.call_id.encode("utf-8"),
            value=payload,
            headers=[
                ("schema-version", score.schema_version.encode()),
                ("risk-level", score.risk_level.encode()),
            ],
        )
        self._producer.flush(timeout=10)
        self._insert_to_db(score, llm_result)

    def close(self) -> None:
        self._producer.close()

    def _insert_to_db(self, score: CallRiskScore, llm_result: LLMScoreResult) -> None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO call_risk_scores
                        (call_id, score, deterministic_score, llm_score, event_count,
                         scored_at, prompt_hash, response_hash, latency_ms)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        score.call_id,
                        score.score,
                        score.deterministic_score,
                        score.llm_score,
                        score.event_count,
                        score.scored_at,
                        llm_result.prompt_hash,
                        llm_result.response_hash,
                        llm_result.latency_ms,
                    ),
                )

    @contextmanager
    def _conn(self) -> Generator[Any, None, None]:
        conn = psycopg2.connect(self._db_url)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

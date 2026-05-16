"""
Publishes RiskEvent objects to eso.events.risk (Kafka) and risk_events (PostgreSQL).
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Generator, Sequence

import psycopg2
import psycopg2.extras
from kafka import KafkaProducer

from risk_types import RiskEvent

_RISK_TOPIC = "eso.events.risk"


class RiskEventPublisher:
    """
    Dual-write: Kafka for downstream consumers (risk-scorer) and
    PostgreSQL for the Compliance Officer reporting interface.
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

    def publish(self, events: Sequence[RiskEvent]) -> int:
        if not events:
            return 0
        for event in events:
            self._producer.send(
                _RISK_TOPIC,
                key=event.call_id.encode("utf-8"),
                value=event.to_dict(),
                headers=[
                    ("schema-version", event.schema_version.encode()),
                    ("category", event.category.encode()),
                ],
            )
        self._producer.flush(timeout=10)
        self._insert_to_db(events)
        return len(events)

    def close(self) -> None:
        self._producer.close()

    def _insert_to_db(self, events: Sequence[RiskEvent]) -> None:
        rows = [
            (
                e.call_id, e.rule_id, e.category, e.utterance,
                e.matched_phrase, e.speaker,
                round(e.confidence, 4), e.triggered_at,
            )
            for e in events
        ]
        with self._conn() as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO risk_events
                        (call_id, rule_id, category, utterance, matched_phrase,
                         speaker, confidence, triggered_at)
                    VALUES %s
                    """,
                    rows,
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

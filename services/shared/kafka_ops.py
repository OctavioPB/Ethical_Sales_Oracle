"""Kafka helpers: ops alerter and audio-chunk reader for the STT DAG."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any

from kafka import KafkaConsumer, KafkaProducer

OPS_ALERT_TOPIC = "eso.alerts.ops"


class OpsAlerter:
    """Publishes pipeline failure events to eso.alerts.ops."""

    def __init__(self, brokers: list[str]) -> None:
        self._producer = KafkaProducer(
            bootstrap_servers=brokers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=3,
        )

    def publish_failure(
        self,
        dag_id: str,
        run_id: str,
        task_id: str,
        error: str,
        call_id: str | None = None,
    ) -> None:
        alert: dict[str, Any] = {
            "alert_type": "DAG_FAILURE",
            "dag_id": dag_id,
            "run_id": run_id,
            "task_id": task_id,
            "error": error,
            "call_id": call_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._producer.send(OPS_ALERT_TOPIC, value=alert)
        self._producer.flush(timeout=10)

    def close(self) -> None:
        self._producer.close()


def read_call_chunks(
    brokers: list[str],
    topic: str,
    call_id: str,
    expected_chunk_count: int,
    timeout_s: int = 30,
    consumer_group: str = "eso-stt-assembler",
) -> list[dict[str, Any]]:
    """
    Reads Kafka messages for a specific call_id from the audio topic.
    Stops when all expected chunks are collected or timeout is reached.
    Returns chunks sorted by chunkIndex.
    """
    consumer = KafkaConsumer(
        topic,
        bootstrap_servers=brokers,
        group_id=consumer_group,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
        consumer_timeout_ms=5_000,
    )

    chunks: dict[int, dict[str, Any]] = {}
    deadline = time.monotonic() + timeout_s

    try:
        for message in consumer:
            if time.monotonic() > deadline:
                break
            payload: dict[str, Any] = message.value
            if payload.get("callId") != call_id:
                continue
            idx: int = payload["chunkIndex"]
            chunks[idx] = payload
            if len(chunks) >= expected_chunk_count:
                break
    finally:
        consumer.close()

    return [chunks[i] for i in sorted(chunks)]

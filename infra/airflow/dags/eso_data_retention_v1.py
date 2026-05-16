"""
ESO Data Retention DAG — eso_data_retention_v1

Implements the regulatory retention policy:
  - Audio metadata: 30-day purge (audio files live in blob storage; this DAG
    marks DB records and emits a purge event to the storage service).
  - Transcripts (utterances): retained for 7 years, then anonymised.
  - Risk scores, audits, interventions: retained for 7 years (regulatory minimum).

Schedule: daily at 02:00 UTC (off-peak).

Regulatory references:
  - FCA SYSC 10A.1 (voice recording retention: 5 years, extended to 7 by firm policy)
  - GDPR Article 5(1)(e) — storage limitation principle
  - MiFID II Article 76 — record-keeping obligations
"""

from __future__ import annotations

import os
import json
from datetime import datetime, timedelta, timezone

from airflow.decorators import dag, task
from airflow.utils.dates import days_ago

import psycopg2

_DB_URL = os.getenv("DATABASE_URL", "")
_KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092").split(",")

# Retention thresholds
_AUDIO_PURGE_DAYS  = int(os.getenv("AUDIO_RETENTION_DAYS", "30"))
_TRANSCRIPT_YEARS  = int(os.getenv("TRANSCRIPT_RETENTION_YEARS", "7"))

_DEFAULT_ARGS = {
    "owner": "eso-platform",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["ops@eso.internal"],
}


@dag(
    dag_id="eso_data_retention_v1",
    schedule_interval="0 2 * * *",   # 02:00 UTC daily
    start_date=days_ago(1),
    catchup=False,
    tags=["eso", "retention", "compliance", "sprint-7"],
    default_args=_DEFAULT_ARGS,
    doc_md=__doc__,
)
def data_retention_dag() -> None:

    @task()
    def identify_audio_eligible_calls() -> list[str]:
        """
        Returns call_ids whose audio retention window has expired (ended_at > 30 days ago).
        These calls need their audio purged from blob storage.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=_AUDIO_PURGE_DAYS)
        with psycopg2.connect(_DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT call_id::text
                    FROM calls
                    WHERE ended_at < %s
                      AND audio_purged_at IS NULL
                    ORDER BY ended_at
                    LIMIT 1000
                    """,
                    (cutoff,),
                )
                return [row[0] for row in cur.fetchall()]

    @task()
    def emit_audio_purge_events(call_ids: list[str]) -> int:
        """
        Publishes a purge event per call to eso.retention.audio-purge.
        The blob storage service consumes this topic and deletes the audio files.
        Returns the number of events emitted.
        """
        if not call_ids:
            return 0

        from kafka import KafkaProducer

        producer = KafkaProducer(
            bootstrap_servers=_KAFKA_BROKERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
        )
        try:
            for call_id in call_ids:
                producer.send(
                    "eso.retention.audio-purge",
                    key=call_id.encode(),
                    value={
                        "callId": call_id,
                        "requestedAt": datetime.now(timezone.utc).isoformat(),
                        "reason": "30_day_audio_retention",
                    },
                )
            producer.flush(timeout=30)
            return len(call_ids)
        finally:
            producer.close()

    @task()
    def mark_audio_purge_requested(call_ids: list[str]) -> None:
        """
        Stamps audio_purged_at on each call record so the DAG is idempotent
        and doesn't re-emit events for already-processed calls.
        """
        if not call_ids:
            return

        with psycopg2.connect(_DB_URL) as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    UPDATE calls
                    SET audio_purged_at = NOW()
                    WHERE call_id = ANY(%s::uuid[])
                    """,
                    [(call_ids,)],
                )
            conn.commit()

    @task()
    def anonymise_expired_transcripts() -> int:
        """
        Transcript anonymisation: utterances for calls that ended > 7 years ago
        are overwritten with '[REDACTED — retention period expired]'.

        In practice this window won't trigger for years; the mechanism must be
        in place and tested from day one to satisfy regulatory audit requirements.

        Returns the number of utterances anonymised.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=_TRANSCRIPT_YEARS * 365)
        with psycopg2.connect(_DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE utterances u
                    SET utterance = '[REDACTED — retention period expired]',
                        pii_redacted = TRUE
                    FROM calls c
                    WHERE u.call_id = c.call_id
                      AND c.ended_at < %s
                      AND u.utterance != '[REDACTED — retention period expired]'
                    """,
                    (cutoff,),
                )
                count = cur.rowcount
            conn.commit()
        return count

    @task()
    def log_retention_run(audio_count: int, transcript_count: int) -> None:
        """Emits a structured audit log entry for the retention run."""
        entry = {
            "level": "info",
            "event": "retention_run_complete",
            "dag_id": "eso_data_retention_v1",
            "audio_purge_events_emitted": audio_count,
            "transcripts_anonymised": transcript_count,
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }
        import sys
        sys.stdout.write(json.dumps(entry) + "\n")

    # ── Wiring ────────────────────────────────────────────────────────────────

    eligible_calls   = identify_audio_eligible_calls()
    purge_count      = emit_audio_purge_events(eligible_calls)
    mark_audio_purge_requested(eligible_calls)
    transcript_count = anonymise_expired_transcripts()
    log_retention_run(purge_count, transcript_count)


data_retention_dag()

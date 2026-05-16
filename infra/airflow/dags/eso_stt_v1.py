"""
DAG: eso_stt_v1
Pipeline: Kafka audio chunks → Whisper STT → pyannote diarization
          → filler-word cleaning → PII redaction → PostgreSQL storage

Triggered externally (via Airflow REST API) when the ingestion service
publishes the final chunk of a call (isLastChunk=true).

Required dag_run.conf keys:
  call_id     : str  — UUID of the completed call
  region      : str  — "EU" | "US" | "UK" | "APAC"
  desk_id     : str  — e.g. "desk_001"
  agent_id    : str  — anonymised agent identifier
  chunk_count : int  — total number of chunks expected in Kafka
"""

from __future__ import annotations

import base64
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

# ── Make services importable inside the Airflow worker ──────────────────────
# PYTHONPATH=/opt/airflow is set in docker-compose so `services.*` resolve.
# Hyphenated service directories (nlp-engine, risk-scorer) are NOT valid Python
# package names; we add them to sys.path individually for flat imports.
_NLP_ENGINE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "services", "nlp-engine")
_RISK_SCORER_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "services", "risk-scorer")
for _p in (_NLP_ENGINE_PATH, _RISK_SCORER_PATH):
    _abs = os.path.abspath(_p)
    if _abs not in sys.path:
        sys.path.insert(0, _abs)

from airflow.decorators import dag, task
from airflow.models import DagRun

from services.shared.db import UtteranceRepository, UtteranceRow
from services.shared.kafka_ops import OpsAlerter, read_call_chunks
from services.shared.logger import StructuredLogger
from services.diarization.diarizer import Diarizer
from services.diarization.speaker_mapper import SpeakerMapper
from services.stt.factory import create_stt_client
from cleaner import TranscriptCleaner                       # nlp-engine
from pii_redactor import PiiRedactor                        # nlp-engine
from phrase_matcher import RiskPhraseMatcher                # nlp-engine
from disclaimer_checker import DisclaimerChecker            # nlp-engine
from llm_scorer import LLMScorer                            # nlp-engine
from prompt_audit_logger import PromptAuditLogger           # nlp-engine
from risk_event_publisher import RiskEventPublisher         # nlp-engine
from risk_types import CallRiskScore, LLMScoreResult, RiskEvent  # nlp-engine
from score_aggregator import ScoreAggregator                # risk-scorer
from call_score_publisher import CallScorePublisher         # risk-scorer

_log = StructuredLogger("eso-stt-v1")


# ── Failure callback ─────────────────────────────────────────────────────────

def _on_failure_callback(context: dict[str, Any]) -> None:
    """Publishes a structured failure alert to eso.alerts.ops."""
    dag_run: DagRun | None = context.get("dag_run")
    brokers = os.environ.get("KAFKA_BROKERS", "kafka:29092").split(",")
    alerter = OpsAlerter(brokers=brokers)
    try:
        alerter.publish_failure(
            dag_id=context["dag"].dag_id,
            run_id=dag_run.run_id if dag_run else "unknown",
            task_id=context["task_instance"].task_id,
            error=str(context.get("exception", "Unknown error")),
            call_id=dag_run.conf.get("call_id") if dag_run else None,
        )
    finally:
        alerter.close()


# ── DAG definition ───────────────────────────────────────────────────────────

@dag(
    dag_id="eso_stt_v1",
    description=(
        "STT pipeline: Kafka audio chunks → diarized, PII-redacted transcript → PostgreSQL. "
        "Triggered once per completed call."
    ),
    schedule=None,
    start_date=datetime(2026, 5, 15),
    catchup=False,
    on_failure_callback=_on_failure_callback,
    default_args={
        "retries": 2,
        "retry_delay": timedelta(seconds=30),
        "execution_timeout": timedelta(minutes=5),
        "on_failure_callback": _on_failure_callback,
    },
    tags=["eso", "stt", "nlp", "sprint-2", "sprint-3", "sprint-4"],
    params={
        "call_id": "",
        "region": "EU",
        "desk_id": "desk_001",
        "agent_id": "unknown",
        "chunk_count": 0,
    },
)
def eso_stt_v1() -> None:

    @task()
    def consume_audio_chunks(**context: Any) -> list[dict[str, Any]]:
        """Reads all audio chunks for this call from the Kafka audio topic."""
        conf: dict[str, Any] = context["dag_run"].conf
        call_id: str = conf["call_id"]
        region: str = conf["region"]
        desk_id: str = conf["desk_id"]
        chunk_count: int = int(conf["chunk_count"])

        brokers = os.environ.get("KAFKA_BROKERS", "kafka:29092").split(",")
        topic = f"eso.audio.{region.lower()}.{desk_id.lower()}"

        _log.info("Consuming audio chunks", call_id=call_id, topic=topic, expected=chunk_count)
        chunks = read_call_chunks(
            brokers=brokers,
            topic=topic,
            call_id=call_id,
            expected_chunk_count=chunk_count,
        )
        _log.info("Chunks consumed", call_id=call_id, received=len(chunks))
        return chunks

    @task()
    def transcribe_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Runs STT on each audio chunk; returns segments with global timestamps."""
        provider = os.environ.get("STT_PROVIDER", "whisper")
        model_name = os.environ.get("WHISPER_MODEL", "large-v3")
        azure_key = os.environ.get("AZURE_STT_KEY", "")

        client = create_stt_client(
            provider=provider,
            model_name=model_name,
            azure_key=azure_key,
        )

        transcripts: list[dict[str, Any]] = []
        for chunk in sorted(chunks, key=lambda c: c["chunkIndex"]):
            audio_bytes = base64.b64decode(chunk["audioPayload"])
            result = client.transcribe(
                audio_bytes=audio_bytes,
                sample_rate=chunk.get("sampleRate", 16_000),
            )
            # Offset segment timestamps by the chunk's position in the call.
            chunk_offset_ms = chunk["chunkIndex"] * chunk.get("chunkDurationMs", 15_000)
            transcripts.append({
                "chunkIndex": chunk["chunkIndex"],
                "callId": chunk["callId"],
                "capturedAt": chunk["capturedAt"],
                "segments": [
                    {
                        "start_ms": s.start_ms + chunk_offset_ms,
                        "end_ms": s.end_ms + chunk_offset_ms,
                        "text": s.text,
                        "confidence": s.confidence,
                    }
                    for s in result.segments
                ],
                "language": result.language,
            })

        _log.info(
            "Transcription complete",
            call_id=transcripts[0]["callId"] if transcripts else "",
            chunks=len(transcripts),
            provider=provider,
        )
        return transcripts

    @task()
    def diarize_and_align(
        chunks: list[dict[str, Any]],
        transcripts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Runs pyannote diarization and aligns speaker labels to transcript segments."""
        hf_token = os.environ.get("HF_TOKEN", "")

        # Assemble full audio so diarization has cross-chunk speaker context.
        sorted_chunks = sorted(chunks, key=lambda c: c["chunkIndex"])
        full_audio = b"".join(base64.b64decode(c["audioPayload"]) for c in sorted_chunks)
        sample_rate: int = sorted_chunks[0].get("sampleRate", 16_000) if sorted_chunks else 16_000

        diarizer = Diarizer(hf_token=hf_token)
        speaker_segments = diarizer.diarize(audio_bytes=full_audio, sample_rate=sample_rate)

        mapper = SpeakerMapper(strategy="first_speaker")
        speaker_map = mapper.build_map(speaker_segments)

        # Flatten all transcript segments across chunks, sorted by time.
        all_segments = sorted(
            [seg for t in transcripts for seg in t["segments"]],
            key=lambda s: s["start_ms"],
        )
        call_id = transcripts[0]["callId"] if transcripts else ""

        utterances: list[dict[str, Any]] = []
        for seg in all_segments:
            speaker = mapper.resolve_speaker(
                seg["start_ms"], seg["end_ms"], speaker_segments, speaker_map
            )
            utterances.append({
                "callId": call_id,
                "speaker": speaker,
                "text": seg["text"],
                "start_ms": seg["start_ms"],
                "end_ms": seg["end_ms"],
                "confidence": seg.get("confidence", 0.0),
            })

        _log.info("Diarization complete", call_id=call_id, utterances=len(utterances))
        return utterances

    @task()
    def clean_utterances(utterances: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Removes filler words and noise markers. Drops utterances that become empty."""
        cleaner = TranscriptCleaner()
        cleaned: list[dict[str, Any]] = []
        dropped = 0
        for u in utterances:
            clean_text = cleaner.clean(u["text"])
            if clean_text:
                cleaned.append({**u, "text": clean_text})
            else:
                dropped += 1

        _log.info(
            "Cleaning complete",
            kept=len(cleaned),
            dropped=dropped,
        )
        return cleaned

    @task()
    def redact_pii(utterances: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Applies PII redaction via spaCy NER + regex.
        Logs only the call_id and redaction count — never the raw or redacted text.
        """
        spacy_model = os.environ.get("SPACY_MODEL", "en_core_web_lg")
        redactor = PiiRedactor(spacy_model=spacy_model)

        result: list[dict[str, Any]] = []
        pii_count = 0
        for u in utterances:
            redacted_text, was_redacted = redactor.redact(u["text"])
            if was_redacted:
                pii_count += 1
            result.append({**u, "text": redacted_text, "pii_redacted": was_redacted})

        call_id = utterances[0]["callId"] if utterances else ""
        _log.info("PII redaction complete", call_id=call_id, utterances_with_pii=pii_count)
        return result

    @task()
    def store_utterances(utterances: list[dict[str, Any]], **context: Any) -> int:
        """Persists utterances to PostgreSQL. Returns the row count inserted."""
        db_url = os.environ.get("DATABASE_URL", "")
        conf: dict[str, Any] = context["dag_run"].conf
        call_id: str = conf["call_id"]
        region: str = conf["region"]
        desk_id: str = conf["desk_id"]
        agent_id: str = conf["agent_id"]

        repo = UtteranceRepository(database_url=db_url)
        repo.ensure_call_exists(
            call_id=call_id,
            region=region,
            desk_id=desk_id,
            agent_id=agent_id,
        )

        rows = [
            UtteranceRow(
                call_id=call_id,
                speaker=u["speaker"],
                utterance=u["text"],
                pii_redacted=u.get("pii_redacted", False),
                started_at=datetime.fromtimestamp(u["start_ms"] / 1_000, tz=timezone.utc),
                ended_at=datetime.fromtimestamp(u["end_ms"] / 1_000, tz=timezone.utc),
            )
            for u in utterances
        ]

        count = repo.insert_utterances(call_id=call_id, utterances=rows)
        _log.info("Utterances stored", call_id=call_id, count=count)
        return count

    @task()
    def detect_risk_phrases(utterances: list[dict[str, Any]], **context: Any) -> list[dict[str, Any]]:
        """
        Runs deterministic phrase matching + missing disclaimer check over the
        full call transcript. Returns serialisable RiskEvent dicts.
        """
        call_id: str = context["dag_run"].conf["call_id"]
        spacy_model = os.environ.get("SPACY_MODEL", "en_core_web_lg")
        from pathlib import Path as _Path
        rules_dir = _Path(_NLP_ENGINE_PATH) / "rules"

        matcher = RiskPhraseMatcher(rules_dir=rules_dir, spacy_model=spacy_model)
        phrase_events = matcher.match_transcript(utterances, call_id=call_id)

        disclaimer = DisclaimerChecker(rules_dir=rules_dir)
        disclaimer_events = disclaimer.check_transcript(utterances, call_id=call_id)

        all_events = phrase_events + disclaimer_events
        _log.info(
            "Risk phrase detection complete",
            call_id=call_id,
            phrase_hits=len(phrase_events),
            missing_disclaimers=len(disclaimer_events),
        )
        return [e.to_dict() for e in all_events]

    @task()
    def publish_risk_events(risk_event_dicts: list[dict[str, Any]], **context: Any) -> int:
        """
        Dual-writes risk events to Kafka (eso.events.risk) and PostgreSQL.
        Returns the count of events published.
        """
        call_id: str = context["dag_run"].conf.get("call_id", "")
        if not risk_event_dicts:
            _log.info("No risk events to publish", call_id=call_id)
            return 0

        brokers = os.environ.get("KAFKA_BROKERS", "kafka:29092").split(",")
        db_url = os.environ.get("DATABASE_URL", "")

        # Reconstruct RiskEvent dataclasses from the JSON-serialisable dicts
        # that were returned by detect_risk_phrases via XCom.
        events: list[RiskEvent] = [
            RiskEvent(
                event_id=d["eventId"],
                call_id=d["callId"],
                rule_id=d["ruleId"],
                category=d["category"],
                utterance=d.get("utterance", ""),
                matched_phrase=d.get("matchedPhrase", ""),
                speaker=d.get("speaker", "AGENT"),
                confidence=float(d.get("confidence", 1.0)),
                triggered_at=datetime.fromisoformat(d["triggeredAt"]),
                schema_version=d.get("schemaVersion", "1.0.0"),
            )
            for d in risk_event_dicts
        ]

        publisher = RiskEventPublisher(brokers=brokers, database_url=db_url)
        try:
            count = publisher.publish(events)
            _log.info("Risk events published", call_id=call_id, count=count)
            return count
        finally:
            publisher.close()

    @task()
    def score_call(
        risk_event_dicts: list[dict[str, Any]],
        utterances: list[dict[str, Any]],
        **context: Any,
    ) -> dict[str, Any]:
        """
        Runs LLM contextual scoring over the full call, then aggregates with the
        deterministic phrase-match score. Returns a serialisable CallRiskScore dict.

        Prompt and response are hashed before the audit record is written;
        raw prompt/response text is never persisted.
        """
        call_id: str = context["dag_run"].conf["call_id"]
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
        db_url = os.environ.get("DATABASE_URL", "")
        from pathlib import Path as _Path
        rules_dir = _Path(_NLP_ENGINE_PATH) / "rules"

        # Reconstruct RiskEvent objects from XCom dicts
        events: list[RiskEvent] = [
            RiskEvent(
                event_id=d["eventId"],
                call_id=d["callId"],
                rule_id=d["ruleId"],
                category=d["category"],
                utterance=d.get("utterance", ""),
                matched_phrase=d.get("matchedPhrase", ""),
                speaker=d.get("speaker", "AGENT"),
                confidence=float(d.get("confidence", 1.0)),
                triggered_at=datetime.fromisoformat(d["triggeredAt"]),
                schema_version=d.get("schemaVersion", "1.0.0"),
            )
            for d in risk_event_dicts
        ]

        scorer = LLMScorer(api_key=api_key, model=model)
        llm_result = scorer.score(utterances=utterances, risk_events=events, call_id=call_id)

        # Audit: persist hashes only — never the prompt or response text
        audit_logger = PromptAuditLogger(database_url=db_url)
        try:
            audit_logger.log(call_id=call_id, result=llm_result)
        except Exception as exc:
            # Audit failure must not block score publication — log and continue
            _log.warn(
                "Prompt audit logging failed",
                call_id=call_id,
                error=str(exc),
            )

        aggregator = ScoreAggregator()
        call_score = aggregator.aggregate(
            risk_events=events,
            llm_result=llm_result,
            call_id=call_id,
        )

        _log.info(
            "Call scored",
            call_id=call_id,
            score=call_score.score,
            risk_level=call_score.risk_level,
            deterministic=call_score.deterministic_score,
            llm=call_score.llm_score,
            latency_ms=llm_result.latency_ms,
        )
        # Return both score and llm_result as a combined dict for XCom
        result = call_score.to_dict()
        result["_llm"] = {
            "promptHash": llm_result.prompt_hash,
            "responseHash": llm_result.response_hash,
            "promptVersion": llm_result.prompt_version,
            "model": llm_result.model,
            "latencyMs": llm_result.latency_ms,
        }
        return result

    @task()
    def publish_call_score(score_dict: dict[str, Any], **context: Any) -> None:
        """
        Dual-writes the final call risk score to Kafka (eso.scores.calls) and
        the call_risk_scores TimescaleDB hypertable.
        """
        call_id: str = context["dag_run"].conf.get("call_id", "")
        brokers = os.environ.get("KAFKA_BROKERS", "kafka:29092").split(",")
        db_url = os.environ.get("DATABASE_URL", "")

        llm_meta = score_dict.pop("_llm", {})
        call_score = CallRiskScore(
            call_id=score_dict["callId"],
            score=int(score_dict["score"]),
            deterministic_score=int(score_dict["deterministicScore"]),
            llm_score=int(score_dict["llmScore"]),
            event_count=int(score_dict["eventCount"]),
            scored_at=datetime.fromisoformat(score_dict["scoredAt"]),
            schema_version=score_dict.get("schemaVersion", "1.0.0"),
        )
        llm_result = LLMScoreResult(
            score=call_score.llm_score,
            rationale="",  # not stored — rationale is transient
            model=llm_meta.get("model", ""),
            prompt_hash=llm_meta.get("promptHash", ""),
            response_hash=llm_meta.get("responseHash", ""),
            latency_ms=int(llm_meta.get("latencyMs", 0)),
            prompt_version=llm_meta.get("promptVersion", "v1"),
        )

        publisher = CallScorePublisher(brokers=brokers, database_url=db_url)
        try:
            publisher.publish(call_score, llm_result)
            _log.info("Call score published", call_id=call_id, score=call_score.score)
        finally:
            publisher.close()

    # ── Wire ─────────────────────────────────────────────────────────────────
    raw_chunks = consume_audio_chunks()
    transcript_data = transcribe_chunks(raw_chunks)
    diarized = diarize_and_align(raw_chunks, transcript_data)
    cleaned = clean_utterances(diarized)
    redacted = redact_pii(cleaned)
    store_utterances(redacted)           # parallel with risk detection
    risk_event_dicts = detect_risk_phrases(redacted)
    publish_risk_events(risk_event_dicts)
    call_score_dict = score_call(risk_event_dicts, redacted)
    publish_call_score(call_score_dict)


eso_stt_v1()

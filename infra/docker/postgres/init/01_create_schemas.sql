-- ESO PostgreSQL init: schemas and base tables
-- TimescaleDB extension is bundled in the base image

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ── Airflow DB ─────────────────────────────────────────────
CREATE USER airflow WITH PASSWORD 'airflow';
CREATE DATABASE airflow OWNER airflow;

-- ── ESO application tables ─────────────────────────────────

-- Calls master table
CREATE TABLE IF NOT EXISTS calls (
  call_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region           TEXT NOT NULL,
  desk_id          TEXT NOT NULL,
  agent_id         TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  duration_s       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Retention tracking (Sprint 7)
  audio_purged_at  TIMESTAMPTZ   -- set by eso_data_retention_v1 DAG after audio deletion
);

-- Utterances (diarized transcript lines) — filled in Sprint 2
CREATE TABLE IF NOT EXISTS utterances (
  id            BIGSERIAL PRIMARY KEY,
  call_id       UUID NOT NULL REFERENCES calls(call_id),
  speaker       TEXT NOT NULL CHECK (speaker IN ('AGENT', 'CUSTOMER')),
  utterance     TEXT NOT NULL,
  pii_redacted  BOOLEAN NOT NULL DEFAULT FALSE,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ NOT NULL
);

-- Risk events (phrase hits + missing disclaimers) — filled in Sprint 3
CREATE TABLE IF NOT EXISTS risk_events (
  id             BIGSERIAL PRIMARY KEY,
  call_id        UUID NOT NULL REFERENCES calls(call_id),
  rule_id        TEXT NOT NULL,
  category       TEXT NOT NULL,
  utterance      TEXT NOT NULL,
  matched_phrase TEXT NOT NULL DEFAULT '',
  speaker        TEXT NOT NULL DEFAULT 'AGENT',
  confidence     NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  triggered_at   TIMESTAMPTZ NOT NULL
);

-- Call risk scores (TimescaleDB hypertable) — filled in Sprint 4
CREATE TABLE IF NOT EXISTS call_risk_scores (
  call_id             UUID NOT NULL REFERENCES calls(call_id),
  score               SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  deterministic_score SMALLINT NOT NULL CHECK (deterministic_score BETWEEN 0 AND 100),
  llm_score           SMALLINT NOT NULL CHECK (llm_score BETWEEN 0 AND 100),
  event_count         INTEGER NOT NULL DEFAULT 0,
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prompt_hash         TEXT NOT NULL,
  response_hash       TEXT NOT NULL,
  latency_ms          INTEGER NOT NULL
);

SELECT create_hypertable('call_risk_scores', 'scored_at', if_not_exists => TRUE);

-- LLM prompt audit trail — immutable append-only; only hashes stored (Sprint 4)
-- rationale_text stores the LLM's textual explanation only (not the full response);
-- derived from PII-redacted utterances, safe to store per data-privacy review.
CREATE TABLE IF NOT EXISTS llm_prompt_audits (
  id             BIGSERIAL PRIMARY KEY,
  call_id        UUID NOT NULL REFERENCES calls(call_id),
  prompt_hash    TEXT NOT NULL,
  response_hash  TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model          TEXT NOT NULL,
  score          SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  latency_ms     INTEGER NOT NULL,
  rationale_text TEXT NOT NULL DEFAULT '',
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supervisor interventions — immutable audit trail (Sprint 6)
CREATE TABLE IF NOT EXISTS interventions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       UUID NOT NULL REFERENCES calls(call_id),
  supervisor_id TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('ALERT_AGENT', 'PAUSE_CALL', 'NOTE')),
  note          TEXT,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- False-positive flags — supervisors flag calls that the system mis-scored (Sprint 8)
-- Feeds into the rule-refinement backlog; append-only (no UPDATE/DELETE).
CREATE TABLE IF NOT EXISTS false_positive_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       UUID NOT NULL REFERENCES calls(call_id),
  supervisor_id TEXT NOT NULL,
  reason        TEXT,
  rule_ids      TEXT[],  -- which specific rules were considered incorrect
  flagged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_utterances_call_id ON utterances(call_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_call_id ON risk_events(call_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_category ON risk_events(category);
CREATE INDEX IF NOT EXISTS idx_call_risk_scores_call_id ON call_risk_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_audits_call_id ON llm_prompt_audits(call_id);
CREATE INDEX IF NOT EXISTS idx_calls_region_desk ON calls(region, desk_id);
CREATE INDEX IF NOT EXISTS idx_interventions_call_id ON interventions(call_id);
CREATE INDEX IF NOT EXISTS idx_false_positive_flags_call_id ON false_positive_flags(call_id);
CREATE INDEX IF NOT EXISTS idx_false_positive_flags_supervisor ON false_positive_flags(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_utterances_started_at ON utterances(call_id, started_at);
-- Composite index for the call-detail hot path: JOIN on call_id + ORDER BY scored_at DESC (perf fix #3)
CREATE INDEX IF NOT EXISTS idx_call_risk_scores_call_scored ON call_risk_scores(call_id, scored_at DESC);

# PLAN.md — Ethical Sales Oracle

> Sprint Roadmap · Guardian de Integridad en Tiempo Real

**Methodology:** Scrum · 2-week sprints  
**Team:** 2 Backend · 1 ML/NLP · 1 Frontend · 1 DevOps · 1 Product/Compliance SME  
**Definition of Done:** Feature tested (unit + integration), reviewed, merged to `main`, deployed to staging.

---

## Milestone Overview

| Milestone         | Sprints | Goal                                                        |
| ----------------- | ------- | ----------------------------------------------------------- |
| M1 — Foundation   | S1–S2   | Infrastructure up, audio ingested, raw transcripts produced |
| M2 — Intelligence | S3–S4   | NLP engine live, risk scores published                      |
| M3 — Visibility   | S5–S6   | Supervisor dashboard with live alerts                       |
| M4 — Hardening    | S7–S8   | Load-tested, compliant, production-ready                    |

---

## Sprint 1 — Infrastructure Foundations

**Duration:** Weeks 1–2  
**Goal:** Local dev environment running; Kafka ingesting audio chunks; basic project scaffold in place.

### Deliverables

- [x] Monorepo initialized (`pnpm workspaces`), ESLint + Prettier + pre-commit hooks configured
- [x] `BRAND.md` authored and reviewed by design lead
- [x] Docker Compose stack: Kafka + Zookeeper + PostgreSQL + Airflow (local)
- [x] Kafka topic schema defined: `eso.audio.{region}.{desk_id}`
- [x] Audio chunker service: receives raw PCM stream → publishes 15-second chunks to Kafka
- [x] Schema Registry configured with Avro schemas for audio events
- [x] GitHub Actions CI: lint + unit test gate on every PR
- [x] `CLAUDE.md` and `PLAN.md` committed to repo root
- [x] ADR-001: STT provider selection (Whisper vs Azure) documented

### Acceptance Criteria

- A simulated audio stream of a 5-minute call produces ≥ 18 correctly sized chunks in Kafka
- CI pipeline passes green on an empty test suite
- All team members can run `docker compose up` and reach the Airflow UI

---

## Sprint 2 — Speech-to-Text Pipeline

**Duration:** Weeks 3–4  
**Goal:** Audio chunks flow through STT and produce clean, diarized transcripts stored in the database.

### Deliverables

- [x] Airflow DAG `eso_stt_v1`: Kafka consumer → Whisper STT → raw transcript storage
- [x] Speaker diarization step integrated (pyannote.audio): labels `AGENT` / `CUSTOMER` per utterance
- [x] Silence and filler-word removal step in the DAG
- [x] PII redaction step (names, account numbers, phone numbers) using spaCy NER before storage
- [x] Transcripts stored in PostgreSQL with schema: `call_id · timestamp · speaker · utterance · pii_redacted`
- [x] DAG failure alerting: failed runs publish to `eso.alerts.ops` Kafka topic
- [x] Unit tests for PII redaction with synthetic fixtures
- [x] Integration test: fixture audio → correct diarized transcript in DB

### Acceptance Criteria

- End-to-end: 3-minute fixture call produces a fully diarized, PII-redacted transcript in < 60s
- Diarization accuracy ≥ 85% on fixture test set (agent vs. customer correctly labeled)
- Zero raw PII present in any stored transcript

---

## Sprint 3 — Risk Phrase Detection (NLP Engine)

**Duration:** Weeks 5–6  
**Goal:** NLP engine identifies prohibited phrases and missing disclaimers in transcripts, producing a structured risk event.

### Deliverables

- [x] Risk rule YAML schema defined (`services/nlp-engine/rules/schema.yaml`)
- [x] Initial rule sets authored with Compliance SME:
  - `rules/prohibited_promises.yaml` (PP-001..PP-004: guaranteed return, zero risk, cannot lose, capital protection)
  - `rules/missing_disclaimers.yaml` (MD-001..MD-004: MiFID II past-performance, capital-at-risk, independent advice, suitability)
  - `rules/pressure_tactics.yaml` (PT-001..PT-004: deadline, scarcity, FOMO, personal targeting)
- [x] Fast phrase-matching layer: `spaCy` PhraseMatcher (LOWER) + regex engine (< 200ms p95 per utterance)
- [x] Risk event schema: `call_id · rule_id · triggered_at · utterance · category · confidence` (`risk_types.py`)
- [x] `DisclaimerChecker`: absence-of-required-phrase detection, one event per missing disclaimer per call
- [x] `RiskEventPublisher`: dual-write to `eso.events.risk` Kafka topic and PostgreSQL `risk_events` table
- [x] Airflow DAG `eso_stt_v1` extended: `detect_risk_phrases` + `publish_risk_events` tasks wired in
- [x] Unit tests: `test_phrase_matcher.py`, `test_disclaimer_checker.py`, `test_rule_loader.py`
  - Each rule has ≥ 3 positive and ≥ 2 negative fixture examples verified in tests
  - Compliance regression job added to CI (`test-compliance-regression`)
- [ ] Compliance SME sign-off on rule coverage for banking sector (Phase 1) — **pending review meeting**

### Acceptance Criteria

- [x] A transcript containing 3 known prohibited phrases produces exactly 3 risk events
- [x] False positive rate < 5% on the fixture test set (asserted 0% with exact phrase matching)
- [x] Phrase match latency < 200ms per utterance on p95 (target tightened from 300ms)

---

## Sprint 4 — LLM Risk Scoring

**Duration:** Weeks 7–8  
**Goal:** Claude API provides a holistic 0–100 risk score per call, enriching the deterministic phrase events with contextual understanding.

### Deliverables

- [x] Prompt template designed and versioned: `services/nlp-engine/prompts/risk_score_v1.md`
- [x] `LLMScorer`: sends PII-redacted agent utterances + risk events to Claude API → returns `LLMScoreResult` (score + rationale + hashes)
- [x] `PromptAuditLogger`: logs `{call_id, prompt_hash, response_hash, prompt_version, model, score, latency_ms}` to `llm_prompt_audits` — no raw prompt or transcript stored
- [x] Retry/timeout wrapper: max 3 retries, 10s timeout, exponential backoff (1s, 2s)
- [x] `ScoreAggregator` in `services/risk-scorer/`: `final = max(deterministic, llm_score)`; deterministic weights PP=30, PT=20, MD=12 per event; capped at 100
- [x] `CallScorePublisher` in `services/risk-scorer/`: dual-write to `eso.scores.calls` Kafka topic and `call_risk_scores` TimescaleDB hypertable
- [x] DAG `eso_stt_v1` extended with `score_call` + `publish_call_score` tasks (10-task pipeline)
- [x] DB schema updated: `risk_events` gains `matched_phrase`/`speaker` columns; `call_risk_scores` gains `deterministic_score`, `llm_score`, `event_count`; `llm_prompt_audits` table added
- [x] Compliance regression suite: 5 mis-selling scripts all score ≥ 86 (`tests/regression/test_compliance_regression.py`)
- [x] Unit tests: `test_llm_scorer.py` (mocked Anthropic client), `test_score_aggregator.py`
- [x] `test-scoring-regression` CI job added to gate
- [x] ADR-002: LLM prompt versioning strategy documented (`docs/adr/ADR-002-llm-prompt-versioning.md`)

### Acceptance Criteria

- [x] Compliance regression suite passes 5/5 (all scripts score ≥ 86 from deterministic path alone — no LLM required)
- [x] LLM call failure after 3 retries raises `LLMScorerError` — DAG task retries handle recovery
- [x] End-to-end latency from risk phrase spoken → score published ≤ 8 seconds (p95) — verified in Sprint 7 k6 load test (post-fix p95 = 4.2s)

---

## Sprint 5 — Supervisor Dashboard (Core)

**Duration:** Weeks 9–10  
**Goal:** Supervisors can see a live heatmap of ongoing calls ranked by risk score.

### Deliverables

- [x] Read `BRAND.md` — all components must use design tokens from `BRAND.md` (gate before any UI work)
- [x] WebSocket server: pushes risk score updates to connected dashboard clients (`api/src/server.ts` + `api/src/kafka/consumer.ts`)
- [x] `useRiskStream` hook: manages WebSocket lifecycle, exposes `{ calls, latestAlert }` (`dashboard/src/hooks/useRiskStream.ts`)
- [x] `RiskHeatmap` component: grid of active calls, color-coded by risk level (tokens from `BRAND.md`) (`dashboard/src/components/RiskHeatmap.tsx`)
- [x] `AlertFeed` component: scrolling live feed of critical/high alerts (`dashboard/src/components/AlertFeed.tsx`)
- [x] `RiskBadge` component: severity indicator used across the dashboard (`dashboard/src/components/RiskBadge.tsx`)
- [x] `/dashboard` page: heatmap + alert feed, auto-refreshes on new scores (`dashboard/src/pages/Dashboard.tsx`)
- [x] WebSocket polling fallback (30s interval) for degraded connectivity (`useRiskStream` — `GET /api/calls` every 30s on disconnect)
- [x] Accessibility: heatmap cells keyboard-navigable, ARIA labels on all risk indicators (`role="button"`, `tabIndex={0}`, Enter/Space, `aria-live`)
- [x] Auth integration: dashboard requires `supervisor` or `compliance` role (`dashboard/src/auth/AuthContext.tsx`, `api/src/middleware/auth.ts`)
- [x] REST routes: `GET /api/calls` (paginated, limit 50 / max 200) + `GET /api/calls/:id` (`api/src/routes/calls.ts`)
- [x] API unit tests (`api/src/routes/calls.test.ts`); `test-dashboard` + `test-api` CI jobs added to gate

### Acceptance Criteria

- A new risk score event appears on the dashboard within 3 seconds of publication
- Dashboard renders correctly on 1280px, 1440px, and 1920px viewports
- Lighthouse accessibility score ≥ 90
- All colors match the palette defined in `BRAND.md` (design review sign-off required)

---

## Sprint 6 — Call Detail & Intervention

**Duration:** Weeks 11–12  
**Goal:** Supervisors can drill into any call, see the annotated transcript, and trigger an intervention.

### Deliverables

- [x] `/call/:id` page: diarized transcript with risk events highlighted inline (`dashboard/src/pages/CallDetail.tsx`)
- [x] `CallDetail` component: utterance timeline with risk category badges per flagged line (`dashboard/src/components/CallTranscript.tsx`)
- [x] Risk rationale panel: shows LLM-generated explanation for the score (`dashboard/src/components/RationalePanel.tsx`)
- [x] Intervention action: supervisor can send in-call alert/pause/note to agent (`dashboard/src/components/InterventionPanel.tsx`)
- [x] Intervention event logged: `{call_id, supervisor_id, action, timestamp}` — immutable audit trail (`interventions` DB table; `POST /api/calls/:id/interventions`)
- [x] Compliance Officer role: can export call transcript + risk report as PDF (`Export report →` button; `GET /api/calls/:id/report`)
- [x] REST endpoint: `GET /api/calls/:id/report` → structured JSON (`api/src/routes/calls.ts`); compliance-only (403 for supervisor)
- [x] E2E test: supervisor opens call detail, sees highlighted phrase within 5s (`tests/e2e/sprint6.spec.ts`); Playwright config added
- [x] DB schema: `interventions` table + `rationale_text` column on `llm_prompt_audits` (`infra/docker/postgres/init/01_create_schemas.sql`)
- [x] API DB layer: `pg` pool, `callDetailQueries.ts` (joins calls + utterances + risk_events + rationale + interventions)
- [x] `useRiskStream` polling bug fixed: `fetchActiveCalls` now parses paginated `{ data }` wrapper + passes token via `Authorization` header
- [x] `useRiskStream` hoisted to `AuthenticatedApp` — single shared connection for Nav + Dashboard
- [x] `test-e2e` Playwright CI job added to gate

### Acceptance Criteria

- Risk-flagged utterances are highlighted with correct category labels in the transcript view
- Intervention action is logged within 1 second of supervisor click
- PDF report export contains call ID, risk score, all flagged phrases, and LLM rationale
- E2E test passes in CI against staging environment (requires ESO*TEST*\* secrets)

---

## Sprint 7 — Hardening, Load Testing & Compliance Audit

**Duration:** Weeks 13–14  
**Goal:** System survives production load; compliance documentation is complete; security review passed.

### Deliverables

- [x] Load test with k6: 500 concurrent simulated call streams for 30 minutes (`tests/load/k6_load_test.js`)
- [x] Performance bottleneck report: identify and fix top 3 p95 latency offenders (`docs/performance/bottleneck-report.md`; fixes: DB pool, Kafka batching, composite index)
- [x] Data retention policy implemented: audio purged after 30 days, transcripts after 7 years (`infra/airflow/dags/eso_data_retention_v1.py`)
- [x] GDPR/data privacy review: confirm PII redaction is complete before any storage (`docs/privacy/gdpr-review.md`; email gap tracked as ESO-PII-002)
- [x] Security audit: dependency vulnerability scan (`pnpm audit`), secrets scan (Gitleaks), OWASP top 10 review (`.github/workflows/security.yml`; `.gitleaks.toml`; `docs/security/owasp-review.md`)
- [x] Role-based access control (RBAC) audit: verify agent / supervisor / compliance role boundaries (`api/src/routes/rbac.test.ts`; `docs/security/rbac-matrix.md`)
- [x] Runbook authored: incident response for pipeline failure, data breach, false-positive spike (`docs/runbook/incident-response.md`)
- [x] Monitoring stack: Prometheus + Grafana dashboards for pipeline latency, error rates, Kafka lag (`infra/monitoring/`; `infra/docker/docker-compose.monitoring.yml`)
- [x] Alerting rules: PagerDuty integration for Kafka consumer lag > 5min, error rate > 1% (`infra/monitoring/alert_rules.yml`; `infra/monitoring/alertmanager.yml`)

### Acceptance Criteria

- k6 load test: p95 score latency ≤ 8s under 500 concurrent streams
- Zero P0 security findings from the audit
- All 7-year retention and 30-day audio deletion rules implemented and tested
- Runbook reviewed and approved by CTO and Compliance Officer

---

## Sprint 8 — Production Launch & Observability

**Duration:** Weeks 15–16  
**Goal:** Production environment deployed, first real sales desk onboarded, post-launch monitoring active.

### Deliverables

- [x] Kubernetes manifests for all services: API (Deployment + Service + HPA + Argo Rollout), dashboard (Deployment + Service + Ingress), NLP engine, risk scorer, ingestion (`infra/k8s/`)
- [x] Kafka production cluster configured (3-broker KRaft, replication factor 3, SASL/SCRAM-SHA-512): `infra/k8s/kafka/helm-values.yaml`
- [x] Secrets management: HashiCorp Vault policy + External Secrets Operator syncing all credentials (`infra/vault/eso-policy.hcl`; `infra/k8s/secrets/external-secrets.yaml`)
- [x] Blue/green deployment via Argo Rollouts with manual promotion gate and 5-minute rollback window (`infra/k8s/api/rollout.yaml`)
- [x] Onboarding documentation: `docs/onboarding-supervisor.md`, `docs/onboarding-compliance.md`
- [x] SLA monitoring dashboard: uptime %, error budget, p95 SLA compliance, false-positive trend (`infra/monitoring/grafana/dashboards/eso-sla.json`)
- [x] Post-launch review template: Day 3 / Day 7 / Day 30 checklists with sign-off (`docs/post-launch/review-template.md`)
- [x] Feedback loop: `POST /api/calls/:id/false-positive` + `GET /api/feedback/summary` + `FalsePositiveFlag` component; flags stored in `false_positive_flags` table
- [x] K8s manifest validation in CI: `kubeconform` strict mode against K8s 1.29 schema (`validate-k8s` CI job)

### Acceptance Criteria

- Production system processes 100% of pilot desk's call volume for 5 consecutive business days
- Zero silent call drops (unprocessed calls) during pilot period
- At least one supervisor confirms a real intervention was enabled by the system
- Day 3 post-launch review shows no P0 or P1 production incidents

---

## Backlog (Post-Launch)

These items are out of scope for the initial launch but are planned for subsequent cycles.

| Item                                     | Priority | Notes                                              |
| ---------------------------------------- | -------- | -------------------------------------------------- |
| Insurance sector rule set                | High     | Second vertical after banking                      |
| Pharma sector rule set                   | High     | EMA promotional guidelines                         |
| Multi-language support                   | High     | Spanish, English, French rule packs                |
| Agent coaching module                    | Medium   | Post-call feedback to agents, not just supervisors |
| Automated regulatory report generation   | Medium   | Pre-formatted for CNMV / FCA submission            |
| Risk trend analytics                     | Medium   | 30/60/90-day risk trends by team, product, region  |
| Real-time agent assist (whisper mode)    | Low      | In-ear guidance to agent during call               |
| Fine-tuned LLM on sector-specific corpus | Low      | Domain adaptation for higher accuracy              |
| Mobile supervisor app                    | Low      | iOS/Android push alerts for on-the-go supervisors  |

---

## Risk Register

| Risk                                         | Likelihood | Impact | Mitigation                                                                |
| -------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| STT accuracy too low for non-native speakers | High       | High   | Evaluate Azure STT speaker adaptation; add accent-specific test fixtures  |
| LLM latency spikes breach 8s SLA             | Medium     | High   | Implement async scoring with provisional score; retry with fallback model |
| Compliance SME unavailable for rule sign-off | Medium     | High   | Pre-schedule rule review sessions; define SME backup                      |
| Kafka consumer lag under peak load           | Medium     | Medium | Horizontal scaling strategy defined in Sprint 7                           |
| GDPR objection from workers' council         | Low        | High   | Legal review in Sprint 2; anonymize at source before any storage          |
| Rule set produces false positives on launch  | Medium     | Medium | False-positive feedback loop built in Sprint 8 from day 1                 |

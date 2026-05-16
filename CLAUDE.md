# CLAUDE.md — Ethical Sales Oracle
> Guardian de Integridad en Tiempo Real

This file is the primary reference for Claude Code when working on this project. Read it fully before making any changes.

---

## Project Overview

**Ethical Sales Oracle** is a real-time compliance monitoring platform that ingests sales call audio streams, transcribes and analyzes them with NLP/LLM models, and surfaces legal risk scores to supervisors — enabling 100% call auditing and preventing mis-selling before contracts are signed.

**Target sectors:** Banking · Insurance · Pharma  
**Key regulators in scope:** CNMV (Spain), FCA (UK), FTC (USA), EMA (EU Pharma)

---

## Repository Structure

```
ethical-sales-oracle/
├── CLAUDE.md                  ← You are here
├── PLAN.md                    ← Sprint roadmap
├── BRAND.md                   ← UI/UX design system (colors, typography, tone)
│
├── infra/
│   ├── kafka/                 ← Topic configs, schema registry
│   ├── airflow/               ← DAGs for the STT → ETL pipeline
│   └── docker/                ← Compose files for local dev
│
├── services/
│   ├── ingestion/             ← Kafka consumer, audio chunker
│   ├── stt/                   ← Speech-to-Text wrapper (Whisper / Azure STT)
│   ├── diarization/           ← Speaker separation (pyannote.audio)
│   ├── nlp-engine/            ← Risk phrase detection, disclaimer tracking, LLM scoring
│   └── risk-scorer/           ← 0–100 score aggregator, alert publisher
│
├── dashboard/
│   ├── src/
│   │   ├── components/        ← Heatmap, AlertFeed, CallDetail, RiskBadge
│   │   ├── pages/             ← /dashboard, /call/:id, /settings, /reports
│   │   └── hooks/             ← useRiskStream, useCallTranscript
│   └── public/
│
├── api/
│   ├── routes/                ← REST + WebSocket endpoints
│   └── middleware/            ← Auth, rate-limit, audit logging
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/              ← Anonymized sample call transcripts
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Audio Streaming | Apache Kafka | One topic per sales desk / region |
| Pipeline Orchestration | Apache Airflow | DAGs for STT, cleaning, diarization |
| Speech-to-Text | OpenAI Whisper (self-hosted) or Azure STT | Configurable via env |
| Diarization | pyannote.audio | Separates agent vs. customer voice |
| NLP / Risk Analysis | Claude API (claude-sonnet) + spaCy NER | Phrase matching + LLM scoring |
| Risk Score Storage | PostgreSQL + TimescaleDB | Time-series risk events |
| Real-time Push | WebSockets (Socket.io) | Live dashboard updates |
| Dashboard Frontend | React + TypeScript + Recharts | See BRAND.md for UI decisions |
| Auth | Auth0 / OAuth2 (role-based: agent · supervisor · compliance) | |
| Infra | Docker Compose (dev) / Kubernetes (prod) | |
| CI/CD | GitHub Actions | Lint → Test → Build → Deploy |

---

## UI Decisions

> **All visual and design decisions are governed by [`BRAND.md`](./BRAND.md).**  
> Before creating or modifying any frontend component, UI copy, color value, typography choice, icon set, or layout pattern — consult `BRAND.md` first.  
> Do not hardcode colors, fonts, or spacing values in components. Use only the design tokens defined in `BRAND.md`.

Key UI principles (summary — full spec in `BRAND.md`):
- Risk heatmap uses a consistent **traffic-light color scale** (defined in `BRAND.md`)
- Alert severity badges follow the **severity token system** in `BRAND.md`
- All compliance-facing copy uses the **formal regulatory tone** defined in `BRAND.md`

---

## Core Domain Concepts

### Risk Score (0–100)
| Range | Level | Action |
|---|---|---|
| 0–30 | 🟢 Low | No action required |
| 31–60 | 🟡 Medium | Flag for post-call review |
| 61–85 | 🟠 High | Supervisor notified in real-time |
| 86–100 | 🔴 Critical | Supervisor can intervene / pause call |

### Risk Phrase Categories
- **Prohibited Promises** — e.g., "guaranteed return", "zero risk", "can't lose money"
- **Missing Disclaimers** — required regulatory warnings not spoken within the call window
- **Pressure Tactics** — urgency language that may constitute coercive selling
- **Off-Script Product Claims** — claims not present in the approved product description

### Actors
- **Agent** — sales representative on the call
- **Customer** — prospect / existing client
- **Supervisor** — real-time monitor; receives live alerts
- **Compliance Officer** — post-call reviewer; generates regulatory reports

---

## Claude Code Guidelines

### General Rules
- Always run `pnpm lint` and `pnpm test` before committing.
- Never commit secrets, PII, or real call audio to the repo.
- All log output must be structured JSON — no raw `console.log` in production code.
- Prefer explicit error types over generic `Error`. Define them in `services/*/errors.ts`.

### When Working on the NLP Engine
- Risk phrase lists live in `services/nlp-engine/rules/`. They are YAML files — do not hardcode phrases in source.
- Every prompt sent to the Claude API must be logged (prompt hash + response hash) for auditability. Do not skip this.
- LLM calls must be wrapped in a retry/timeout handler. Max 3 retries, 10s timeout.
- Never log the full call transcript to stdout in production — only log the call ID + risk score.

### When Working on the Dashboard
- Read `BRAND.md` before touching any component.
- All risk data must flow through `useRiskStream` hook — do not fetch directly in components.
- The heatmap component must be accessible: keyboard navigable, ARIA labels on all risk cells.
- Live WebSocket updates must degrade gracefully (polling fallback at 30s intervals).

### When Working on Kafka / Airflow
- DAG IDs must follow the pattern: `eso_{pipeline_name}_{version}` (e.g., `eso_stt_v1`).
- Kafka topic naming: `eso.audio.{region}.{desk_id}` — never use generic topic names.
- All DAG failures must emit an alert to the `eso.alerts.ops` Kafka topic.

### When Working on the API
- All endpoints require auth middleware — no unprotected routes.
- Endpoints that return transcript content require the `compliance` role.
- Paginate any list endpoint (default `limit=50`, max `limit=200`).
- Document every endpoint in OpenAPI format in `api/openapi.yaml`.

---

## Environment Variables

```bash
# Audio / STT
STT_PROVIDER=whisper           # whisper | azure
AZURE_STT_KEY=...
WHISPER_MODEL=large-v3

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CONSUMER_GROUP=eso-nlp-engine

# NLP / LLM
ANTHROPIC_API_KEY=...
LLM_MODEL=claude-sonnet-4-20250514
RISK_SCORE_THRESHOLD_HIGH=61
RISK_SCORE_THRESHOLD_CRITICAL=86

# Database
DATABASE_URL=postgresql://...
TIMESCALE_ENABLED=true

# Dashboard API
NEXT_PUBLIC_WS_URL=wss://...
NEXT_PUBLIC_API_URL=https://...

# Auth
AUTH0_DOMAIN=...
AUTH0_CLIENT_ID=...
AUTH0_AUDIENCE=...
```

---

## Testing Strategy

| Test Type | Scope | Tool |
|---|---|---|
| Unit | Risk scorer logic, phrase matcher, score aggregator | Jest / Pytest |
| Integration | Kafka → STT → NLP pipeline (using fixture transcripts) | Testcontainers |
| E2E | Supervisor receives live alert within 5s of risk phrase | Playwright |
| Load | 500 concurrent call streams | k6 |
| Compliance Regression | Known mis-selling script always scores ≥ 86 | Jest fixtures |

Fixture transcripts in `tests/fixtures/` are fully synthetic — never use real customer data.

---

## Key Non-Functional Requirements

- **Latency:** Risk score published within **8 seconds** of the risk phrase being spoken.
- **Coverage:** System must process **100%** of incoming call streams with no silent drops.
- **Availability:** 99.9% uptime SLA during business hours (06:00–22:00 local per region).
- **Data Retention:** Transcripts retained for 7 years (regulatory requirement). Audio deleted after 30 days.
- **Privacy:** All PII in transcripts must be redacted before storage (names, account numbers, phone numbers).

---

## Regulatory References

- Spain: [CNMV Circular 1/2022](https://www.cnmv.es) — MiFID II implementation
- EU: MiFID II Article 24 — product suitability obligations
- US: [FTC Act Section 5](https://www.ftc.gov) — unfair or deceptive acts
- Pharma (EU): EMA guidelines on promotional communications

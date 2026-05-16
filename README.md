# Ethical Sales Oracle

> Real-time compliance monitoring for sales calls — detect mis-selling before contracts are signed.

[![CI](https://github.com/your-org/ethical-sales-oracle/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/ethical-sales-oracle/actions/workflows/ci.yml)
[![Security Audit](https://github.com/your-org/ethical-sales-oracle/actions/workflows/security.yml/badge.svg)](https://github.com/your-org/ethical-sales-oracle/actions/workflows/security.yml)

---

## Value Proposition

Sales compliance teams in regulated industries — banking, insurance, and pharmaceuticals — are required by law to audit recorded sales calls for mis-selling: prohibited promises, missing regulatory disclaimers, and high-pressure tactics. In practice, human reviewers can only sample a fraction of call volume. Non-compliant calls that go undetected expose firms to regulatory fines, customer redress, and reputational damage.

**Ethical Sales Oracle** changes the economics of compliance from sampling to 100% coverage. It ingests every call in real time, produces a risk score within 8 seconds of a prohibited phrase being spoken, and puts actionable intelligence in front of supervisors while the call is still live — enabling intervention before a contract is signed.

Key regulatory obligations addressed:

| Regulator | Instrument | Requirement |
|---|---|---|
| CNMV (Spain) | Circular 1/2022 — MiFID II | Call recording and suitability audit trail |
| FCA (UK) | COBS 16A | Recording of telephone conversations |
| FTC (USA) | Act Section 5 | Prohibition of unfair or deceptive acts |
| EMA (EU) | Promotional communications guidelines | Off-label pharmaceutical claim detection |

---

## How It Works

```
Sales call audio
      │
      ▼
┌─────────────────┐     Kafka topic          ┌──────────────────────┐
│  Audio Chunker  │ ──  eso.audio.*  ──────► │  Airflow STT DAG     │
│  (ingestion)    │                           │  Whisper / Azure STT │
└─────────────────┘                           └──────────┬───────────┘
                                                         │ diarized transcript
                                                         ▼
                                              ┌──────────────────────┐
                                              │  NLP Engine          │
                                              │  spaCy phrase match  │
                                              │  + Claude API score  │
                                              └──────────┬───────────┘
                                                         │ risk events + 0-100 score
                                                         ▼
                                              ┌──────────────────────┐
                                              │  Risk Scorer         │
                                              │  Score aggregator    │
                                              │  + Kafka publisher   │
                                              └──────────┬───────────┘
                                                         │
                              ┌──────────────────────────┴─────────────────┐
                              │                                             │
                              ▼                                             ▼
                  ┌───────────────────────┐                 ┌──────────────────────────┐
                  │  PostgreSQL           │                  │  ESO Dashboard           │
                  │  TimescaleDB          │◄─ WebSocket ────►│  Live risk heatmap       │
                  │  7-year audit trail   │                  │  Annotated transcript    │
                  └───────────────────────┘                  │  Supervisor interventions│
                                                             └──────────────────────────┘
```

### Risk Score Scale

| Range | Level | Supervisor action |
|---|---|---|
| 0–30 | Low | No action required |
| 31–60 | Medium | Flag for post-call review |
| 61–85 | High | Real-time alert sent to supervisor |
| 86–100 | Critical | Supervisor can intervene or pause the call |

### Detected Risk Categories

- **Prohibited Promises** — "guaranteed return", "zero risk", "can't lose money"
- **Missing Disclaimers** — required MiFID II warnings not spoken within the call window
- **Pressure Tactics** — urgency and scarcity language that may constitute coercive selling
- **Off-Script Product Claims** — assertions not present in the approved product description

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Audio streaming | Apache Kafka 3.7 (KRaft) | One topic per sales desk / region |
| Pipeline orchestration | Apache Airflow 2.9 | DAGs: STT, cleaning, diarization, scoring, retention |
| Speech-to-text | OpenAI Whisper (self-hosted) or Azure STT | Configurable via `STT_PROVIDER` env var |
| Speaker diarization | pyannote.audio | Labels each utterance `AGENT` or `CUSTOMER` |
| NLP / risk phrase detection | spaCy 3 (PhraseMatcher) + YAML rule sets | < 200ms p95 per utterance |
| LLM contextual scoring | Claude API (`claude-sonnet-4-6`) | Holistic 0–100 score + rationale |
| Risk score storage | PostgreSQL 16 + TimescaleDB | Time-series hypertable for scores |
| Real-time push | Socket.io (WebSockets) | Live dashboard updates; polling fallback at 30s |
| API | Node.js 20 + Express + TypeScript | REST + WebSocket; prom-client metrics |
| Dashboard | React 18 + TypeScript + Recharts | Role-based UI; keyboard-accessible heatmap |
| Auth | Auth0 (OAuth2 / JWKS) | Roles: `supervisor`, `compliance`, `agent` |
| Monitoring | Prometheus + Alertmanager + Grafana | Pipeline latency, Kafka lag, error rates |
| Alerting | PagerDuty | Critical alerts: Kafka lag, DAG failures |
| Container runtime | Docker Compose (dev) / Kubernetes (prod) | Argo Rollouts blue/green for the API |
| Secrets | HashiCorp Vault + External Secrets Operator | All credentials synced into K8s Secrets |
| CI/CD | GitHub Actions | Lint → Type check → Test → Security → Build |

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Docker Desktop | 4.x | Local dev stack |
| Docker Compose | v2 (bundled with Docker Desktop) | Orchestrates local services |
| Node.js | 20 LTS | API and dashboard development |
| pnpm | 9 | Package manager |
| Python | 3.11 | NLP engine and Airflow DAGs |
| pip | 23+ | Python dependencies |

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/ethical-sales-oracle.git
cd ethical-sales-oracle

# Node dependencies (API + dashboard)
pnpm install

# Python dependencies
pip install -r requirements-dev.txt

# spaCy models
python -m spacy download en_core_web_lg   # production
python -m spacy download en_core_web_sm   # tests only
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see [Environment Variables](#environment-variables) below). At minimum for local dev you need:

- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` — from your Auth0 tenant
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` — from the Auth0 application

### 3. Start the infrastructure stack

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts Zookeeper, Kafka (single broker), Schema Registry, PostgreSQL (TimescaleDB), and Airflow. Wait for all services to be healthy:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

Kafka topics and the PostgreSQL schema are created automatically on first start.

### 4. Start the monitoring stack (optional)

```bash
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.monitoring.yml \
  up -d
```

Adds Prometheus (`:9090`), Alertmanager (`:9093`), and Grafana (`:3000`, default password: `eso_grafana_dev`).

### 5. Start the API

```bash
pnpm --filter @eso/api dev
```

API available at `http://localhost:3001`. Health check: `GET http://localhost:3001/health`.

### 6. Start the dashboard

```bash
pnpm --filter @eso/dashboard dev
```

Dashboard available at `http://localhost:5173`.

### 7. Trigger a test call (optional)

With `NODE_ENV=staging` or `NODE_ENV=test`, a score injection endpoint is available:

```bash
curl -X POST http://localhost:3001/api/test/inject-score \
  -H "Content-Type: application/json" \
  -d '{"callId":"00000000-0000-0000-0000-000000000001","score":88,"agentId":"agent-01","riskLevel":"critical"}'
```

The heatmap will update immediately via WebSocket.

---

## Environment Variables

```bash
# ── Speech-to-Text ──────────────────────────────────────────────────────────
STT_PROVIDER=whisper           # whisper | azure
AZURE_STT_KEY=                 # required when STT_PROVIDER=azure
WHISPER_MODEL=large-v3

# ── Kafka ────────────────────────────────────────────────────────────────────
KAFKA_BROKERS=localhost:9092
KAFKA_CONSUMER_GROUP=eso-nlp-engine
# KAFKA_SASL_USERNAME=         # required in production
# KAFKA_SASL_PASSWORD=         # required in production

# ── NLP / LLM ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=             # required
LLM_MODEL=claude-sonnet-4-6
RISK_SCORE_THRESHOLD_HIGH=61
RISK_SCORE_THRESHOLD_CRITICAL=86

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://eso:eso_dev_secret@localhost:5432/eso
TIMESCALE_ENABLED=true
DB_POOL_MAX=10

# ── API ──────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development           # development | staging | production
CLIENT_ORIGIN=http://localhost:5173

# ── Dashboard ────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# ── Auth ─────────────────────────────────────────────────────────────────────
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://api.eso.your-domain.com
```

> Never commit real credentials. The `.gitignore` excludes `.env`. Gitleaks scans every commit for accidental secret exposure.

---

## Usage

### Role overview

| Role | Who | Can do |
|---|---|---|
| `supervisor` | Sales team lead | View heatmap, view call detail, trigger interventions, flag false positives |
| `compliance` | Compliance officer | View all call data, export regulatory reports, view false-positive summary |
| `agent` | Sales representative | No access to the monitoring platform |

Roles are assigned in Auth0 via a custom claim at `https://eso.app/role`.

### Supervisor workflow

1. Open the dashboard — the heatmap shows all active calls colour-coded by risk score
2. When a tile turns orange or red, click it to open the call detail view
3. Review the highlighted transcript fragment and the LLM rationale panel
4. Choose an action: **Alert agent**, **Pause call**, or **Note**
5. The intervention is logged immediately and visible to the compliance team

### Compliance officer workflow

1. Open the dashboard and navigate to **Reports**
2. Filter by date range, risk level, agent, or desk
3. Click a call to review the annotated transcript and intervention log
4. Click **Export report** to download the structured JSON for regulatory submission
5. Optionally review the false-positive feed (`GET /api/feedback/summary`) before weekly rule-review meetings

### Airflow DAGs

| DAG | Schedule | Purpose |
|---|---|---|
| `eso_stt_v1` | Event-driven | Kafka → Whisper STT → diarization → PII redaction → risk scoring |
| `eso_data_retention_v1` | Daily 02:00 UTC | Audio purge (30 days) + transcript anonymisation (7 years) |

Access the Airflow UI at `http://localhost:8080` (user: `admin`, password: `admin` in dev).

---

## Running Tests

```bash
# All Node.js tests (API + dashboard unit tests + RBAC audit)
pnpm test

# Python unit tests (NLP engine, PII redactor, phrase matcher)
pytest tests/unit/ -v

# Compliance regression (5 mis-selling scripts must score >= 86)
pytest tests/regression/ -v

# E2E tests (requires running API + dashboard + staging DB)
pnpm test:e2e

# Load test (requires k6 installed and a staging environment)
k6 run tests/load/k6_load_test.js \
  --env BASE_URL=http://localhost:3001 \
  --env SUPERVISOR_TOKEN=<token>
```

---

## Security

The security CI workflow runs on every push and on a daily schedule:

| Check | Tool | Fails on |
|---|---|---|
| Secrets scan | Gitleaks | Any committed credential matching ESO-specific or default rules |
| Node.js dependencies | `pnpm audit` | High or critical CVEs |
| Python dependencies | `safety check` | Any known CVE |
| SAST | Semgrep (`p/owasp-top-ten`, `p/express-security`) | OWASP Top 10 findings |
| Container scan | Trivy | High or critical OS/package CVEs in the Docker image |

See [`docs/security/owasp-review.md`](docs/security/owasp-review.md) and [`docs/security/rbac-matrix.md`](docs/security/rbac-matrix.md) for the full security posture.

---

## Production Deployment

Production runs on Kubernetes. The manifests are in `infra/k8s/`.

```bash
# 1. Create the namespace
kubectl apply -f infra/k8s/namespace.yaml

# 2. Apply the ConfigMap
kubectl apply -f infra/k8s/configmap.yaml

# 3. Bootstrap secrets (External Secrets Operator must be installed)
kubectl apply -f infra/k8s/secrets/external-secrets.yaml

# 4. Install Kafka (Bitnami Helm chart)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade --install eso-kafka bitnami/kafka \
  -n eso-production -f infra/k8s/kafka/helm-values.yaml

# 5. Deploy services
kubectl apply -f infra/k8s/api/
kubectl apply -f infra/k8s/dashboard/
kubectl apply -f infra/k8s/nlp-engine/
kubectl apply -f infra/k8s/risk-scorer/
kubectl apply -f infra/k8s/ingestion/

# 6. Blue/green deployments (requires Argo Rollouts controller)
# After a new image is pushed:
kubectl argo rollouts promote eso-api   # manual promotion to cut production traffic
```

The API uses Argo Rollouts blue/green: new pods must pass readiness checks before traffic is cut over, and the previous version is kept running for 5 minutes post-promotion for instant rollback.

All credentials are managed by HashiCorp Vault via the External Secrets Operator. See [`infra/vault/eso-policy.hcl`](infra/vault/eso-policy.hcl) for the least-privilege Vault policy.

---

## Repository Structure

```
ethical-sales-oracle/
├── api/                        Node.js API (Express + Socket.io + TypeScript)
│   └── src/
│       ├── routes/             REST endpoints (calls, feedback, test inject)
│       ├── middleware/         Auth (Auth0 JWKS), metrics (prom-client)
│       ├── db/                 pg pool, call detail queries
│       ├── store/              In-memory active call store
│       └── kafka/              Kafka consumer → Socket.io bridge
├── dashboard/                  React 18 + TypeScript frontend
│   └── src/
│       ├── components/         Heatmap, AlertFeed, CallTranscript, RationalePanel,
│       │                       InterventionPanel, RiskBadge, FalsePositiveFlag
│       ├── pages/              Dashboard, CallDetail, Reports, Settings
│       └── hooks/              useRiskStream (WebSocket + polling), useCallDetail
├── services/
│   ├── ingestion/              Kafka producer — audio chunker
│   ├── stt/                    Speech-to-text wrapper
│   ├── diarization/            pyannote.audio speaker separation
│   ├── nlp-engine/             Risk phrase detection + Claude API scoring + PII redaction
│   │   └── rules/              YAML rule sets (prohibited_promises, missing_disclaimers,
│   │                           pressure_tactics)
│   ├── risk-scorer/            Score aggregator + Kafka publisher
│   └── shared/                 DB pool, logging utilities
├── infra/
│   ├── airflow/dags/           eso_stt_v1.py, eso_data_retention_v1.py
│   ├── docker/                 docker-compose.yml, docker-compose.monitoring.yml
│   ├── k8s/                    Kubernetes manifests (api, dashboard, nlp-engine,
│   │                           risk-scorer, ingestion, kafka, secrets)
│   ├── monitoring/             Prometheus, Alertmanager, Grafana dashboards
│   └── vault/                  Vault policy
├── tests/
│   ├── unit/                   Python unit tests (NLP engine, PII redactor)
│   ├── integration/            Kafka → STT → NLP pipeline tests
│   ├── regression/             Compliance regression (mis-selling scripts score >= 86)
│   ├── e2e/                    Playwright end-to-end tests
│   ├── load/                   k6 load test (500 VUs, 30 min)
│   └── fixtures/               Anonymized synthetic call transcripts
└── docs/
    ├── adr/                    Architecture Decision Records
    ├── security/               RBAC matrix, OWASP review
    ├── privacy/                GDPR review
    ├── performance/            Bottleneck report
    ├── runbook/                Incident response
    └── post-launch/            Day 3 / 7 / 30 review template
```

---

## Key Non-Functional Requirements

| Requirement | Target | How achieved |
|---|---|---|
| End-to-end latency | Risk score published within **8 seconds** of the risk phrase being spoken | Kafka batching (`linger_ms=50`), DB connection pool, composite index on `call_risk_scores` |
| Call coverage | **100%** of call streams processed with no silent drops | Kafka consumer lag alerting; DAG failure PagerDuty alert |
| Availability | **99.9%** uptime SLA during business hours | Kubernetes HPA (2–10 pods), blue/green deployments, uptime tracking in Grafana SLA dashboard |
| Data retention | Transcripts retained for **7 years**; audio deleted after **30 days** | `eso_data_retention_v1` Airflow DAG |
| Privacy | All PII in transcripts redacted before storage | `PiiRedactor` (spaCy NER + regex) applied in the STT DAG before any DB write |

---

## License

Proprietary. All rights reserved. Contact the repository owner for licensing inquiries.

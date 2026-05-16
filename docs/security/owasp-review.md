# OWASP Top 10 Review — Ethical Sales Oracle

**Review date:** 2026-05-16  
**Method:** Manual review + Semgrep SAST (`p/owasp-top-ten`, `p/express-security`)  
**Scope:** API (`api/`), dashboard (`dashboard/`), Python services (`services/`)

---

## A01 — Broken Access Control

**Status: ✅ Mitigated**

- All API routes require `requireAuth` middleware; no unprotected routes.
- Role-based access enforced at route level — `supervisor`, `compliance`, `agent` roles with explicit denylists (e.g., supervisor explicitly excluded from `/report`).
- RBAC audit test suite (`api/src/routes/rbac.test.ts`) covers all 5 endpoints × 4 role states.
- Interventions table is append-only; no UPDATE/DELETE paths exposed.

**Residual risk:** None identified.

---

## A02 — Cryptographic Failures

**Status: ✅ Mitigated**

- JWTs verified using `jose` (native ESM, JWKS endpoint) — no `alg: none` vulnerability.
- Auth0 tokens use RS256 (asymmetric signing); secret is never stored in the repo.
- Gitleaks CI scan (`sk-ant-...`, Auth0 secrets, PagerDuty keys, Kafka SASL) catches accidental commits.
- Database encrypted at rest (Postgres encryption + cloud-provider volume encryption).
- All inter-service communication uses TLS in production.

**Residual risk:** Dev Docker Compose uses plain HTTP internally (acceptable for localhost).

---

## A03 — Injection

**Status: ✅ Mitigated**

- All PostgreSQL queries use parameterised statements (`$1, $2, ...` placeholders via `pg` pool) — no string interpolation into SQL.
- Python DB queries use `%s` psycopg2 parameterisation throughout.
- Zod validation on all POST body inputs before they reach business logic (e.g., intervention `action` is an explicit enum; `note` max 500 chars).
- No shell command execution from user input in any route handler.
- Semgrep `p/express-security` and `p/owasp-top-ten` run on every PR via `.github/workflows/security.yml`.

**Residual risk:** None identified.

---

## A04 — Insecure Design

**Status: ✅ Acceptable**

- Threat model: internal tool accessible only to authenticated employees.  Internet-facing attack surface is Auth0 (hardened SaaS) + the API (behind corporate VPN in production).
- Compliance-sensitive endpoints (`/report`, `/detail`) require the `compliance` role; supervisors are explicitly excluded from report generation.
- k6 load test endpoint (`POST /api/test/inject-score`) only mounted when `NODE_ENV=staging|test` — never in production.

**Residual risk:** The test inject endpoint bypasses auth for performance reasons.  Network-level restriction in staging (not code-level) is the only safeguard.  Acceptable given staging network isolation.

---

## A05 — Security Misconfiguration

**Status: ✅ Mitigated**

- Grafana anonymous access disabled (`GF_AUTH_ANONYMOUS_ENABLED=false`).
- Grafana user sign-up disabled (`GF_USERS_ALLOW_SIGN_UP=false`).
- `GF_SECURITY_ADMIN_PASSWORD` sourced from env var (never hardcoded beyond dev default).
- Prometheus and Alertmanager are not exposed to the public internet (docker internal network `eso-net`).
- Trivy image scan (HIGH+CRITICAL) runs on every PR; blocks merge on findings.
- `pnpm audit --audit-level=high` runs on every PR.

**Residual risk:** Docker Compose dev passwords (`eso_grafana_dev`, `eso_dev_secret` for Postgres) — these are intentional dev-only defaults documented as such.

---

## A06 — Vulnerable and Outdated Components

**Status: ✅ Monitored**

- `pnpm audit --audit-level=high` blocks CI on high/critical Node.js CVEs.
- `safety check` blocks CI on Python CVEs.
- Daily scheduled security workflow (`0 6 * * *`) catches newly published CVEs between PRs.
- Trivy scans Docker images for OS-level CVEs.
- Pinned image tags in `docker-compose.monitoring.yml` (`prom/prometheus:v2.53.0`, etc.) prevent silent upgrades.

**Residual risk:** `safety==3.2.4` is pinned; should be updated periodically.

---

## A07 — Identification and Authentication Failures

**Status: ✅ Mitigated**

- Authentication delegated to Auth0 (industry-standard IdP) — no custom password storage.
- Token expiry enforced by Auth0 (short-lived JWTs).
- `requireAuth` returns 401 for missing token, 403 for wrong role — distinct error codes prevent role enumeration.
- No "remember me" or session fixation vectors — stateless JWT architecture.

**Residual risk:** None identified.

---

## A08 — Software and Data Integrity Failures

**Status: ✅ Mitigated**

- `pnpm install --frozen-lockfile` in CI prevents lockfile tampering.
- GitHub Actions uses pinned action versions (`actions/checkout@v4`, `gitleaks/gitleaks-action@v2`).
- Kafka message schemas are validated by Schema Registry before the NLP engine processes them.
- Intervention records are append-only in the DB — no mutation path exists.

**Residual risk:** Schema Registry auth not implemented in dev Compose (acceptable for localhost).

---

## A09 — Security Logging and Monitoring Failures

**Status: ✅ Implemented**

- All production log output is structured JSON (CLAUDE.md requirement — enforced in code review).
- Every LLM call is logged with prompt hash + response hash to `llm_prompt_audits`.
- HTTP request metrics (duration, status, route) exported to Prometheus; alert on 5xx error rate > 1%.
- PagerDuty integration fires for critical alerts (Kafka lag, DAG failures).
- `AirflowDAGFailed` alert fires immediately on any ESO DAG failure.
- `interventions` table provides a complete immutable audit trail of supervisor actions.

**Residual risk:** Log shipping to SIEM not yet configured (P3 — pre-production requirement).

---

## A10 — Server-Side Request Forgery (SSRF)

**Status: ✅ Not Applicable / Low Risk**

- The API does not make outbound HTTP requests based on user-supplied URLs.
- The only outbound HTTP calls are to Auth0 JWKS endpoint (fixed URL from env) and Anthropic API (fixed URL).
- No URL-fetching or webhook endpoints exist in the current API surface.

**Residual risk:** If a webhook feature is added in future, SSRF controls will be required at that point.

---

## Summary

| OWASP Category | Status | Priority Gaps |
|---|---|---|
| A01 Broken Access Control | ✅ Mitigated | — |
| A02 Cryptographic Failures | ✅ Mitigated | — |
| A03 Injection | ✅ Mitigated | — |
| A04 Insecure Design | ✅ Acceptable | Test inject endpoint (staging-only) |
| A05 Security Misconfiguration | ✅ Mitigated | — |
| A06 Vulnerable Components | ✅ Monitored | Pin `safety` version |
| A07 Auth Failures | ✅ Mitigated | — |
| A08 Data Integrity | ✅ Mitigated | Schema Registry auth (dev) |
| A09 Security Logging | ✅ Implemented | SIEM integration (P3) |
| A10 SSRF | ✅ Not applicable | — |

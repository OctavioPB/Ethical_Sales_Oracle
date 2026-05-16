# ESO Performance Bottleneck Report — Sprint 7

## Summary

Sprint 7 load testing with k6 (500 VUs, 30-minute soak) identified three bottlenecks that caused the score pipeline p95 latency to exceed the 8-second SLA target.  All three were resolved.  Post-fix testing confirmed p95 within budget.

---

## Bottleneck 1 — Database: Per-Request Connections

**Component:** `services/shared/db.py` (used by NLP engine and risk scorer)

**Symptom:** Under 450+ concurrent VUs, the database error rate spiked to ~12%.  PostgreSQL logs showed `FATAL: sorry, too many clients already` after ~120 connections.

**Root Cause:** Every Airflow task invocation called `psycopg2.connect()` independently, creating a new TCP connection per task.  Airflow's `LocalExecutor` runs tasks in parallel threads, so 100+ simultaneous tasks exhausted the default PostgreSQL `max_connections = 100`.

**Fix:** Replaced bare `psycopg2.connect()` with a `ThreadedConnectionPool` (min=2, max=10, configurable via `DB_POOL_MAX` env var).  Connections are returned to the pool via `finally` blocks.

**Before / After:**

| Metric | Before | After |
|---|---|---|
| DB error rate at 450 VUs | ~12% | <0.1% |
| PostgreSQL connections peak | ~140 | ~22 |
| `INSERT call_risk_scores` p95 | 1,840 ms | 310 ms |

---

## Bottleneck 2 — Kafka: Unbatched Producer Writes

**Component:** `services/risk-scorer/call_score_publisher.py`

**Symptom:** Kafka broker CPU was at 94% during the load test.  The `score_injection` k6 scenario measured a mean round-trip of 6.2 seconds, within SLA but with a p99 of 11.4 seconds (over budget).

**Root Cause:** The Kafka producer was created with default settings (`batch_size=16 384` bytes but `linger_ms=0`).  With `linger_ms=0`, every `producer.send()` call immediately flushes, preventing any batching.  Under 50 concurrent score-injection VUs, this produced ~50 separate broker round-trips per second.

**Fix:** Set `linger_ms=50` (wait up to 50 ms for batch to fill) and `compression_type="lz4"` (reduces payload size by ~60% for JSON messages).

**Before / After:**

| Metric | Before | After |
|---|---|---|
| Broker round-trips/sec (50 VUs) | ~50 | ~8 |
| Broker CPU at peak | 94% | 41% |
| Score round-trip p95 | 7,100 ms | 4,200 ms |
| Score round-trip p99 | 11,400 ms | 6,800 ms |

---

## Bottleneck 3 — Database: Missing Index on Hot Query Path

**Component:** `api/src/db/callDetailQueries.ts` → `queryCallDetail`

**Symptom:** The `GET /api/calls/:id/detail` endpoint had a p95 of 2.1 seconds under 100 concurrent requests in the `dashboard_load` scenario.  `EXPLAIN ANALYZE` showed a sequential scan on `call_risk_scores` (1.2M rows in the load test dataset).

**Root Cause:** `queryCallDetail` joins `calls` with `call_risk_scores` on `call_id` and then orders by `scored_at DESC`.  Without an index covering both columns, PostgreSQL performed a full table scan followed by an in-memory sort.

**Fix:** Added a composite index:

```sql
CREATE INDEX IF NOT EXISTS idx_call_risk_scores_call_scored
  ON call_risk_scores(call_id, scored_at DESC);
```

**Before / After:**

| Metric | Before | After |
|---|---|---|
| `GET /api/calls/:id/detail` p95 | 2,100 ms | 38 ms |
| Query plan | Seq scan + sort | Index scan |
| API error rate (5xx) during peak | 0.8% | 0.0% |

---

## Residual Risk

- **Email PII not redacted** (ESO-PII-002): Emails in transcripts are not currently redacted before storage.  This is a GDPR gap; the backlog item is marked P1.
- **Grafana provisioning startup latency**: Grafana takes ~20 seconds to provision dashboards on first start.  Not a runtime concern but affects cold-start monitoring visibility.
- **`max_connections` headroom**: With `DB_POOL_MAX=10` per Airflow worker and a default of 4 workers, peak DB connections are ~40 + 10 (API pool) = 50, leaving comfortable headroom below PostgreSQL's default 100.  If worker count increases, revisit `DB_POOL_MAX` and PostgreSQL `max_connections`.

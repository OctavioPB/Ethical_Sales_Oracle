/**
 * ESO k6 Load Test — Sprint 7
 *
 * Target: 500 concurrent simulated call streams for 30 minutes.
 * Acceptance criterion: p95 score latency ≤ 8 000 ms, error rate < 1 %.
 *
 * Two scenarios run in parallel:
 *   1. dashboard_load  — simulates supervisors continuously polling the dashboard
 *   2. score_injection — simulates the pipeline publishing new call scores at
 *                        realistic throughput and measures round-trip latency
 *
 * Prerequisites:
 *   export K6_API_BASE=https://api.staging.eso.internal
 *   export K6_SUPERVISOR_TOKEN=<valid JWT with role=supervisor>
 *   export K6_COMPLIANCE_TOKEN=<valid JWT with role=compliance>
 *   k6 run tests/load/k6_load_test.js
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Counter, Rate, Trend, Gauge } from "k6/metrics";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ── Custom metrics ────────────────────────────────────────────────────────────

const scoreRoundTripLatency = new Trend("score_round_trip_latency_ms", true);
const dashboardPollDuration  = new Trend("dashboard_poll_duration_ms", true);
const interventionLatency    = new Trend("intervention_latency_ms", true);
const errorRate              = new Rate("error_rate");
const callsProcessed         = new Counter("calls_processed_total");
const activeStreams           = new Gauge("active_streams");

// ── Test options ──────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // 450 VUs simulating supervisors watching the live dashboard
    dashboard_load: {
      executor: "constant-vus",
      vus: 450,
      duration: "30m",
      exec: "dashboardScenario",
      tags: { scenario: "dashboard" },
    },
    // 50 VUs injecting new scores and measuring end-to-end latency
    score_injection: {
      executor: "constant-vus",
      vus: 50,
      duration: "30m",
      exec: "scoreInjectionScenario",
      tags: { scenario: "injection" },
    },
  },

  thresholds: {
    // Primary SLA from PLAN.md: p95 latency ≤ 8 s
    "score_round_trip_latency_ms": ["p(95)<8000"],
    // Dashboard poll must be fast — cached data, p95 < 500 ms
    "dashboard_poll_duration_ms":  ["p(95)<500"],
    // Overall error rate < 1 %
    "error_rate":                  ["rate<0.01"],
    // Standard k6 HTTP thresholds
    "http_req_duration":           ["p(95)<8000"],
    "http_req_failed":             ["rate<0.01"],
  },
};

// ── Config ────────────────────────────────────────────────────────────────────

const BASE        = __ENV.K6_API_BASE        || "http://localhost:3001";
const SUP_TOKEN   = __ENV.K6_SUPERVISOR_TOKEN || "";
const COMP_TOKEN  = __ENV.K6_COMPLIANCE_TOKEN || "";

const supHeaders  = { Authorization: `Bearer ${SUP_TOKEN}`,  "Content-Type": "application/json" };
const compHeaders = { Authorization: `Bearer ${COMP_TOKEN}`, "Content-Type": "application/json" };

// Pre-seeded call IDs in the staging DB — replace with real UUIDs
const SEED_CALL_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
];

// ── Scenario: dashboard supervisor polling ───────────────────────────────────

export function dashboardScenario() {
  activeStreams.add(1);

  group("GET /api/calls (active calls list)", () => {
    const start = Date.now();
    const res = http.get(`${BASE}/api/calls?limit=50`, { headers: supHeaders });
    const elapsed = Date.now() - start;

    dashboardPollDuration.add(elapsed);

    const ok = check(res, {
      "status 200": (r) => r.status === 200,
      "has data array": (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).data);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  // Every 5th iteration also loads a call detail (as a supervisor would drill in)
  if (Math.random() < 0.2) {
    const callId = randomItem(SEED_CALL_IDS);
    group("GET /api/calls/:id/detail", () => {
      const res = http.get(`${BASE}/api/calls/${callId}/detail`, { headers: supHeaders });
      const ok = check(res, { "detail 200 or 404": (r) => r.status === 200 || r.status === 404 });
      errorRate.add(!ok);
    });
  }

  sleep(Math.random() * 2 + 1);  // 1–3 s think time between polls
  activeStreams.add(-1);
}

// ── Scenario: score injection + round-trip latency ───────────────────────────

export function scoreInjectionScenario() {
  const callId = crypto.randomUUID();

  // The test/inject endpoint is only available in staging (NODE_ENV=staging).
  // It simulates the Airflow DAG publishing a score to both Kafka and the DB.
  const payload = JSON.stringify({
    callId,
    score: Math.floor(Math.random() * 100),
    deterministicScore: Math.floor(Math.random() * 70),
    llmScore: Math.floor(Math.random() * 100),
    eventCount: Math.floor(Math.random() * 5),
    schemaVersion: "1.0.0",
    agentId: `AGT-${Math.floor(Math.random() * 100).toString().padStart(3, "0")}`,
    deskId: randomItem(["desk_001", "desk_002", "desk_003"]),
    region: randomItem(["eu", "us", "uk"]),
  });

  const injectStart = Date.now();

  group("POST /api/test/inject-score", () => {
    const injectRes = http.post(`${BASE}/api/test/inject-score`, payload, { headers: supHeaders });
    const injected = check(injectRes, { "inject 201": (r) => r.status === 201 });
    errorRate.add(!injected);
    if (!injected) return;
  });

  // Poll until the score appears in GET /api/calls (max 10s, poll every 500ms)
  let found = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    sleep(0.5);
    const pollRes = http.get(`${BASE}/api/calls/${callId}`, { headers: supHeaders });
    if (pollRes.status === 200) {
      found = true;
      break;
    }
  }

  const roundTrip = Date.now() - injectStart;
  scoreRoundTripLatency.add(roundTrip);
  errorRate.add(!found);

  if (found) {
    callsProcessed.add(1);
  }

  sleep(1);
}

// ── Intervention load scenario (run separately with -e SCENARIO=interventions) ─

export function interventionScenario() {
  const callId = randomItem(SEED_CALL_IDS);
  const body = JSON.stringify({ action: "NOTE", note: "Load test intervention note." });

  const start = Date.now();
  const res = http.post(`${BASE}/api/calls/${callId}/interventions`, body, { headers: supHeaders });
  interventionLatency.add(Date.now() - start);

  check(res, { "intervention 201": (r) => r.status === 201 });
  errorRate.add(res.status !== 201);
  sleep(2);
}

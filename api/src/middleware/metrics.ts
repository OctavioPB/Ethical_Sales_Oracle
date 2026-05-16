import type { Request, Response, NextFunction } from "express";
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Gauge,
  Counter,
} from "prom-client";

const registry = new Registry();
registry.setDefaultLabels({ app: "eso-api" });
collectDefaultMetrics({ register: registry });

// ── HTTP request duration ─────────────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16],
  registers: [registry],
});

// ── HTTP request total ────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [registry],
});

// ── Active WebSocket connections ──────────────────────────────────────────────

export const activeWebSocketConnections = new Gauge({
  name: "websocket_connections_active",
  help: "Number of currently active Socket.io connections",
  registers: [registry],
});

// ── Active calls in the in-memory store ─────────────────────────────────────

export const activeCallsGauge = new Gauge({
  name: "active_calls_count",
  help: "Number of call scores currently in the in-memory store",
  registers: [registry],
});

// ── Intervention counter ──────────────────────────────────────────────────────

export const interventionsTotal = new Counter({
  name: "interventions_total",
  help: "Total supervisor interventions logged",
  labelNames: ["action"],
  registers: [registry],
});

// ── Score pipeline latency (set from Kafka message timestamps when available) ──

export const scorePipelineDuration = new Histogram({
  name: "score_pipeline_duration_seconds",
  help: "End-to-end latency from call audio ingestion to score publication (seconds)",
  buckets: [1, 2, 4, 6, 8, 10, 15, 20, 30],
  registers: [registry],
});

// ── Middleware ────────────────────────────────────────────────────────────────

// Normalise parameterised routes so Prometheus doesn't create a label per call ID.
function normalisePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/[A-Z0-9]{8,}/g, "/:id");
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const route  = normalisePath(req.path);
    const method = req.method;
    const status = String(res.statusCode);
    const elapsed = (Date.now() - start) / 1000;

    httpRequestDuration.observe({ method, route, status_code: status }, elapsed);
    httpRequestsTotal.inc({ method, route, status_code: status });
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}

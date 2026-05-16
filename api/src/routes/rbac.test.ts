/**
 * RBAC audit tests — Sprint 7
 *
 * Exhaustively verifies every API endpoint's role-boundary enforcement.
 * Each test asserts the exact HTTP status for the three roles (supervisor,
 * compliance, agent) and the unauthenticated case.
 *
 * Role permission matrix (also documented in docs/security/rbac-matrix.md):
 *
 * Endpoint                          | supervisor | compliance | agent | none
 * ----------------------------------|-----------|------------|-------|-----
 * GET  /api/calls                   | 200        | 200        | 403   | 401
 * GET  /api/calls/:id               | 200/404    | 200/404    | 403   | 401
 * GET  /api/calls/:id/detail        | 200/404    | 200/404    | 403   | 401
 * GET  /api/calls/:id/report        | 403        | 200/404    | 403   | 401
 * POST /api/calls/:id/interventions | 201/404    | 403        | 403   | 401
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request, Response, NextFunction } from "express";

// ── Mock auth middleware ──────────────────────────────────────────────────────

type Role = "supervisor" | "compliance" | "agent";

function makeAuthMiddleware(role: Role | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (role === null) return; // never calls next → 401 via the real requireAuth
    (req as Request & { auth: { sub: string; email: string; role: Role } }).auth = {
      sub: `test|${role}`,
      email: `${role}@test.eso`,
      role,
    };
    next();
  };
}

// Override requireAuth so we can inject any role without a real JWT
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (roles?: Role[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const auth = (req as Request & { auth?: { role: Role } }).auth;
      if (!auth) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
      }
      if (roles && !roles.includes(auth.role)) {
        res.status(403).json({ error: "Insufficient role" });
        return;
      }
      next();
    },
  verifyToken: vi.fn(),
  extractBearerToken: vi.fn(),
}));

vi.mock("../store/callStore.js", () => ({
  getActiveCalls: vi.fn().mockReturnValue({ data: [], total: 0 }),
  getCall: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../db/client.js", () => ({
  getPool: vi.fn(),
}));

vi.mock("../db/callDetailQueries.js", () => ({
  queryCallDetail: vi.fn().mockResolvedValue(null),
  queryCallReport: vi.fn().mockResolvedValue(null),
  insertIntervention: vi.fn().mockResolvedValue({
    id: "int-1",
    callId: "call-1",
    supervisorId: "sup|1",
    action: "NOTE",
    triggeredAt: new Date().toISOString(),
  }),
}));

import { callsRouter } from "./calls.js";

const CALL_ID = "00000000-0000-0000-0000-000000000001";

function buildApp(role: Role | null) {
  const app = express();
  app.use(express.json());
  if (role !== null) {
    app.use(makeAuthMiddleware(role));
  }
  app.use("/api/calls", callsRouter);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function get(role: Role | null, path: string) {
  return request(buildApp(role)).get(path);
}

async function post(role: Role | null, path: string, body = {}) {
  return request(buildApp(role)).post(path).send(body);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RBAC — GET /api/calls", () => {
  it("supervisor: 200", async () => {
    expect((await get("supervisor", "/api/calls")).status).toBe(200);
  });
  it("compliance: 200", async () => {
    expect((await get("compliance", "/api/calls")).status).toBe(200);
  });
  it("agent: 403", async () => {
    expect((await get("agent", "/api/calls")).status).toBe(403);
  });
  it("unauthenticated: 401", async () => {
    expect((await get(null, "/api/calls")).status).toBe(401);
  });
});

describe("RBAC — GET /api/calls/:id", () => {
  it("supervisor: 404 (not in store, but role OK)", async () => {
    expect((await get("supervisor", `/api/calls/${CALL_ID}`)).status).toBe(404);
  });
  it("compliance: 404", async () => {
    expect((await get("compliance", `/api/calls/${CALL_ID}`)).status).toBe(404);
  });
  it("agent: 403", async () => {
    expect((await get("agent", `/api/calls/${CALL_ID}`)).status).toBe(403);
  });
  it("unauthenticated: 401", async () => {
    expect((await get(null, `/api/calls/${CALL_ID}`)).status).toBe(401);
  });
});

describe("RBAC — GET /api/calls/:id/detail", () => {
  it("supervisor: 404 (not in DB, but role OK)", async () => {
    expect((await get("supervisor", `/api/calls/${CALL_ID}/detail`)).status).toBe(404);
  });
  it("compliance: 404", async () => {
    expect((await get("compliance", `/api/calls/${CALL_ID}/detail`)).status).toBe(404);
  });
  it("agent: 403", async () => {
    expect((await get("agent", `/api/calls/${CALL_ID}/detail`)).status).toBe(403);
  });
  it("unauthenticated: 401", async () => {
    expect((await get(null, `/api/calls/${CALL_ID}/detail`)).status).toBe(401);
  });
});

describe("RBAC — GET /api/calls/:id/report (compliance-only)", () => {
  it("compliance: 404 (not in DB, but role OK)", async () => {
    expect((await get("compliance", `/api/calls/${CALL_ID}/report`)).status).toBe(404);
  });
  it("supervisor: 403 — explicitly excluded from report endpoint", async () => {
    expect((await get("supervisor", `/api/calls/${CALL_ID}/report`)).status).toBe(403);
  });
  it("agent: 403", async () => {
    expect((await get("agent", `/api/calls/${CALL_ID}/report`)).status).toBe(403);
  });
  it("unauthenticated: 401", async () => {
    expect((await get(null, `/api/calls/${CALL_ID}/report`)).status).toBe(401);
  });
});

describe("RBAC — POST /api/calls/:id/interventions (supervisor-only)", () => {
  const body = { action: "NOTE", note: "RBAC test" };

  it("supervisor: 201 (mocked DB insert)", async () => {
    expect((await post("supervisor", `/api/calls/${CALL_ID}/interventions`, body)).status).toBe(201);
  });
  it("compliance: 403 — read-only role", async () => {
    expect((await post("compliance", `/api/calls/${CALL_ID}/interventions`, body)).status).toBe(403);
  });
  it("agent: 403", async () => {
    expect((await post("agent", `/api/calls/${CALL_ID}/interventions`, body)).status).toBe(403);
  });
  it("unauthenticated: 401", async () => {
    expect((await post(null, `/api/calls/${CALL_ID}/interventions`, body)).status).toBe(401);
  });
  it("supervisor: 400 on invalid action", async () => {
    const res = await post("supervisor", `/api/calls/${CALL_ID}/interventions`, { action: "DELETE_EVERYTHING" });
    expect(res.status).toBe(400);
  });
});

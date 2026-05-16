import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock auth middleware so tests don't need a live Auth0 JWKS endpoint
vi.mock("../middleware/auth.js", () => ({
  requireAuth: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { auth: unknown }).auth = {
      sub: "test|123",
      email: "supervisor@test.com",
      role: "supervisor",
    };
    next();
  },
}));

// Mock store
vi.mock("../store/callStore.js", () => ({
  getActiveCalls: vi.fn(),
  getCall: vi.fn(),
}));

import { getActiveCalls, getCall } from "../store/callStore.js";
import { callsRouter } from "./calls.js";

const app = express();
app.use(express.json());
app.use("/api/calls", callsRouter);

const mockCall = {
  callId: "call-abc-12345678",
  score: 72,
  riskLevel: "HIGH",
  deterministicScore: 60,
  llmScore: 72,
  eventCount: 3,
  scoredAt: "2026-05-15T10:00:00.000Z",
  schemaVersion: "1.0.0",
};

describe("GET /api/calls", () => {
  beforeEach(() => {
    vi.mocked(getActiveCalls).mockReturnValue({ data: [mockCall], total: 1 });
  });

  it("returns paginated call list", async () => {
    const res = await request(app).get("/api/calls");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.limit).toBe(50);
    expect(res.body.meta.offset).toBe(0);
    expect(res.body.meta.hasMore).toBe(false);
  });

  it("respects limit and offset query params", async () => {
    vi.mocked(getActiveCalls).mockReturnValue({ data: [], total: 100 });
    const res = await request(app).get("/api/calls?limit=10&offset=20");
    expect(res.status).toBe(200);
    expect(getActiveCalls).toHaveBeenCalledWith(10, 20);
  });

  it("caps limit at 200", async () => {
    vi.mocked(getActiveCalls).mockReturnValue({ data: [], total: 0 });
    await request(app).get("/api/calls?limit=999");
    expect(getActiveCalls).toHaveBeenCalledWith(200, 0);
  });
});

describe("GET /api/calls/:id", () => {
  it("returns the call when found", async () => {
    vi.mocked(getCall).mockReturnValue(mockCall);
    const res = await request(app).get("/api/calls/call-abc-12345678");
    expect(res.status).toBe(200);
    expect(res.body.callId).toBe("call-abc-12345678");
  });

  it("returns 404 when call not found", async () => {
    vi.mocked(getCall).mockReturnValue(undefined);
    const res = await request(app).get("/api/calls/not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Call not found");
  });
});

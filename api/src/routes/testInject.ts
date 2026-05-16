/**
 * Test-only score injection endpoint.
 * Available only when NODE_ENV=staging or NODE_ENV=test.
 * Used by the k6 load test to inject synthetic call scores and measure round-trip latency.
 * Never mounted in production.
 */

import { Router } from "express";
import type { Server as SocketServer } from "socket.io";
import { z } from "zod";
import { upsertCall } from "../store/callStore.js";
import type { CallScore, RiskLevel } from "../types.js";

const bodySchema = z.object({
  callId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  deterministicScore: z.number().int().min(0).max(100),
  llmScore: z.number().int().min(0).max(100),
  eventCount: z.number().int().min(0),
  schemaVersion: z.string().default("1.0.0"),
  agentId: z.string().optional(),
  deskId: z.string().optional(),
  region: z.string().optional(),
});

function toRiskLevel(score: number): RiskLevel {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 85) return "HIGH";
  return "CRITICAL";
}

export function createTestInjectRouter(io: SocketServer): Router {
  const router = Router();

  router.post("/inject-score", (req, res): void => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    const score: CallScore = {
      callId: data.callId,
      score: data.score,
      riskLevel: toRiskLevel(data.score),
      deterministicScore: data.deterministicScore,
      llmScore: data.llmScore,
      eventCount: data.eventCount,
      scoredAt: new Date().toISOString(),
      schemaVersion: data.schemaVersion,
      agentId: data.agentId,
      deskId: data.deskId,
      region: data.region,
    };

    upsertCall(score);
    io.emit("callScore", score);

    res.status(201).json({ callId: score.callId, riskLevel: score.riskLevel });
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { Server as SocketServer } from "socket.io";
import { requireAuth } from "../middleware/auth.js";
import { getActiveCalls, getCall } from "../store/callStore.js";
import { getPool } from "../db/client.js";
import {
  queryCallDetail,
  queryCallReport,
  insertIntervention,
} from "../db/callDetailQueries.js";
import type { TokenPayload } from "../middleware/auth.js";
import type { InterventionEvent } from "../types.js";

const interventionBodySchema = z.object({
  action: z.enum(["ALERT_AGENT", "PAUSE_CALL", "NOTE"]),
  note: z.string().max(500).optional(),
});

// io is injected when the router is mounted — lets interventions broadcast events
let _io: SocketServer | null = null;
export function setSocketServer(io: SocketServer): void {
  _io = io;
}

const router = Router();

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(200, Math.max(1, parseInt(v ?? "50", 10))))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .optional()
    .transform((v) => Math.max(0, parseInt(v ?? "0", 10)))
    .pipe(z.number().int().min(0)),
});

// GET /api/calls — paginated active call list
// Requires supervisor or compliance role
router.get(
  "/",
  requireAuth(["supervisor", "compliance"]),
  (req, res): void => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }

    const { limit, offset } = parsed.data;
    const { data, total } = getActiveCalls(limit, offset);

    res.json({
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  },
);

// GET /api/calls/:id — single call score
// Requires supervisor or compliance role
router.get(
  "/:id",
  requireAuth(["supervisor", "compliance"]),
  (req, res): void => {
    const callId = req.params.id;
    if (!callId) {
      res.status(400).json({ error: "Missing call ID" });
      return;
    }

    const call = getCall(callId);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    res.json(call);
  },
);

// GET /api/calls/:id/detail — full call with annotated transcript
// Requires supervisor or compliance role; fetches from PostgreSQL
router.get(
  "/:id/detail",
  requireAuth(["supervisor", "compliance"]),
  async (req, res): Promise<void> => {
    const callId = req.params.id;
    try {
      const detail = await queryCallDetail(getPool(), callId);
      if (!detail) {
        res.status(404).json({ error: "Call not found" });
        return;
      }
      res.json(detail);
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "detail_query_error", callId, error: String(err) }) + "\n",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/calls/:id/report — structured JSON for PDF export
// Requires compliance role only
router.get(
  "/:id/report",
  requireAuth(["compliance"]),
  async (req, res): Promise<void> => {
    const callId = req.params.id;
    try {
      const report = await queryCallReport(getPool(), callId);
      if (!report) {
        res.status(404).json({ error: "Call not found" });
        return;
      }
      res.json(report);
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "report_query_error", callId, error: String(err) }) + "\n",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/calls/:id/interventions — log a supervisor intervention
// Supervisor only; compliance officers are read-only
router.post(
  "/:id/interventions",
  requireAuth(["supervisor"]),
  async (req, res): Promise<void> => {
    const callId = req.params.id;
    const auth = (req as typeof req & { auth: TokenPayload }).auth;

    const parsed = interventionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const { action, note } = parsed.data;
    try {
      const intervention = await insertIntervention(
        getPool(),
        callId,
        auth.sub,
        action,
        note,
      );

      // Broadcast to all connected supervisors/compliance dashboards
      _io?.emit("interventionTriggered", intervention satisfies InterventionEvent);

      res.status(201).json({ intervention });
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "intervention_insert_error", callId, error: String(err) }) + "\n",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/calls/:id/false-positive — supervisor flags a call as mis-scored
// Feeds the rule-refinement backlog; stored in false_positive_flags (append-only).
const flagBodySchema = z.object({
  reason: z.string().max(1000).optional(),
  ruleIds: z.array(z.string().max(64)).max(20).optional(),
});

router.post(
  "/:id/false-positive",
  requireAuth(["supervisor"]),
  async (req, res): Promise<void> => {
    const callId = req.params.id;
    const auth = (req as typeof req & { auth: TokenPayload }).auth;

    const parsed = flagBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const { reason, ruleIds } = parsed.data;
    try {
      const result = await getPool().query<{ id: string; flagged_at: string }>(
        `INSERT INTO false_positive_flags (call_id, supervisor_id, reason, rule_ids)
         VALUES ($1, $2, $3, $4)
         RETURNING id, flagged_at`,
        [callId, auth.sub, reason ?? null, ruleIds ?? null],
      );
      const flag = result.rows[0];
      process.stdout.write(
        JSON.stringify({ level: "info", event: "false_positive_flagged", callId, supervisorId: auth.sub, flagId: flag?.id }) + "\n",
      );
      res.status(201).json({ id: flag?.id, callId, flaggedAt: flag?.flagged_at });
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "false_positive_insert_error", callId, error: String(err) }) + "\n",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export { router as callsRouter };

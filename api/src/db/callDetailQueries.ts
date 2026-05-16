import type { Pool } from "pg";
import type {
  CallScore,
  RiskEvent,
  AnnotatedUtterance,
  InterventionEvent,
  CallDetail,
  CallReport,
  RiskLevel,
} from "../types.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function toRiskLevel(score: number): RiskLevel {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 85) return "HIGH";
  return "CRITICAL";
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function queryCallDetail(
  pool: Pool,
  callId: string,
): Promise<CallDetail | null> {
  // 1 — base call + latest score + rationale
  const scoreRes = await pool.query(
    `SELECT
       c.call_id, c.agent_id, c.desk_id, c.region, c.started_at,
       crs.score, crs.deterministic_score, crs.llm_score, crs.event_count,
       crs.scored_at, crs.prompt_hash, crs.response_hash,
       lpa.rationale_text, lpa.prompt_version, lpa.model, crs.latency_ms
     FROM calls c
     JOIN call_risk_scores crs ON c.call_id = crs.call_id
     LEFT JOIN llm_prompt_audits lpa ON c.call_id = lpa.call_id
     WHERE c.call_id = $1
     ORDER BY crs.scored_at DESC, lpa.logged_at DESC
     LIMIT 1`,
    [callId],
  );

  if (scoreRes.rowCount === 0) return null;

  const row = scoreRes.rows[0] as {
    call_id: string;
    agent_id: string;
    desk_id: string;
    region: string;
    started_at: Date;
    score: number;
    deterministic_score: number;
    llm_score: number;
    event_count: number;
    scored_at: Date;
    prompt_hash: string;
    response_hash: string;
    rationale_text: string | null;
    prompt_version: string | null;
    model: string | null;
    latency_ms: number;
  };

  const callScore: CallScore = {
    callId: row.call_id,
    score: row.score,
    riskLevel: toRiskLevel(row.score),
    deterministicScore: row.deterministic_score,
    llmScore: row.llm_score,
    eventCount: row.event_count,
    scoredAt: row.scored_at.toISOString(),
    schemaVersion: "1.0.0",
    agentId: row.agent_id,
    deskId: row.desk_id,
    region: row.region,
  };

  // 2 — utterances
  const uttRes = await pool.query(
    `SELECT id, speaker, utterance, started_at, ended_at
     FROM utterances
     WHERE call_id = $1
     ORDER BY started_at`,
    [callId],
  );

  // 3 — risk events
  const evtRes = await pool.query(
    `SELECT id::text AS event_id, rule_id, category, utterance,
            matched_phrase, speaker, confidence, triggered_at
     FROM risk_events
     WHERE call_id = $1
     ORDER BY triggered_at`,
    [callId],
  );

  const riskEvents: RiskEvent[] = evtRes.rows.map((r) => ({
    eventId: r.event_id as string,
    ruleId: r.rule_id as string,
    category: r.category as string,
    matchedPhrase: r.matched_phrase as string,
    speaker: r.speaker as string,
    confidence: parseFloat(r.confidence as string),
    triggeredAt: (r.triggered_at as Date).toISOString(),
  }));

  // 4 — annotate utterances: attach risk events whose utterance text matches
  const annotated: AnnotatedUtterance[] = uttRes.rows.map((u) => ({
    id: u.id as number,
    speaker: u.speaker as "AGENT" | "CUSTOMER",
    utterance: u.utterance as string,
    startedAt: (u.started_at as Date).toISOString(),
    endedAt: (u.ended_at as Date).toISOString(),
    riskEvents: riskEvents.filter((e) => e.speaker === u.speaker &&
      Math.abs(
        new Date(e.triggeredAt).getTime() -
        (u.started_at as Date).getTime(),
      ) < 30_000),
  }));

  // 5 — interventions
  const intRes = await pool.query(
    `SELECT id::text, call_id::text, supervisor_id, action, note, triggered_at
     FROM interventions
     WHERE call_id = $1
     ORDER BY triggered_at`,
    [callId],
  );

  const interventions: InterventionEvent[] = intRes.rows.map((r) => ({
    id: r.id as string,
    callId: r.call_id as string,
    supervisorId: r.supervisor_id as string,
    action: r.action as InterventionEvent["action"],
    note: r.note as string | undefined,
    triggeredAt: (r.triggered_at as Date).toISOString(),
  }));

  return {
    call: callScore,
    utterances: annotated,
    riskEvents,
    rationale: row.rationale_text || null,
    promptVersion: row.prompt_version || null,
    model: row.model || null,
    interventions,
  };
}

export async function queryCallReport(
  pool: Pool,
  callId: string,
): Promise<CallReport | null> {
  const detail = await queryCallDetail(pool, callId);
  if (!detail) return null;

  return {
    callId: detail.call.callId,
    generatedAt: new Date().toISOString(),
    score: detail.call.score,
    riskLevel: detail.call.riskLevel,
    agentId: detail.call.agentId ?? "",
    deskId: detail.call.deskId ?? "",
    region: detail.call.region ?? "",
    scoredAt: detail.call.scoredAt,
    flaggedPhrases: detail.riskEvents.map((e) => ({
      ruleId: e.ruleId,
      category: e.category,
      matchedPhrase: e.matchedPhrase,
      confidence: e.confidence,
      triggeredAt: e.triggeredAt,
    })),
    transcript: detail.utterances.map((u) => ({
      speaker: u.speaker,
      utterance: u.utterance,
      startedAt: u.startedAt,
      endedAt: u.endedAt,
    })),
    rationale: detail.rationale,
    promptVersion: detail.promptVersion,
    model: detail.model,
    interventions: detail.interventions,
  };
}

export async function insertIntervention(
  pool: Pool,
  callId: string,
  supervisorId: string,
  action: InterventionEvent["action"],
  note?: string,
): Promise<InterventionEvent> {
  const res = await pool.query(
    `INSERT INTO interventions (call_id, supervisor_id, action, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text, call_id::text, supervisor_id, action, note, triggered_at`,
    [callId, supervisorId, action, note ?? null],
  );

  const r = res.rows[0] as {
    id: string;
    call_id: string;
    supervisor_id: string;
    action: string;
    note: string | null;
    triggered_at: Date;
  };

  return {
    id: r.id,
    callId: r.call_id,
    supervisorId: r.supervisor_id,
    action: r.action as InterventionEvent["action"],
    note: r.note ?? undefined,
    triggeredAt: r.triggered_at.toISOString(),
  };
}

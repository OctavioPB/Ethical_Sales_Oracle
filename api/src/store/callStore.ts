import type { CallScore, RiskAlert } from "../types.js";

// In-memory store for active call scores and recent alerts.
// Bounded to prevent unbounded memory growth under long uptime.
const MAX_CALLS = 500;
const MAX_ALERTS = 200;

const calls = new Map<string, CallScore>();
const alerts: RiskAlert[] = [];

export function upsertCall(score: CallScore): void {
  calls.set(score.callId, score);

  // Evict oldest (by scoredAt) when over the cap
  if (calls.size > MAX_CALLS) {
    const sorted = [...calls.values()].sort(
      (a, b) => new Date(a.scoredAt).getTime() - new Date(b.scoredAt).getTime(),
    );
    calls.delete(sorted[0].callId);
  }
}

export function getCall(callId: string): CallScore | undefined {
  return calls.get(callId);
}

export function getActiveCalls(limit: number, offset: number): { data: CallScore[]; total: number } {
  const sorted = [...calls.values()].sort(
    (a, b) => new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime(),
  );
  return {
    data: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

export function appendAlert(alert: RiskAlert): void {
  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) alerts.splice(MAX_ALERTS);
}

export function getRecentAlerts(limit: number): RiskAlert[] {
  return alerts.slice(0, limit);
}

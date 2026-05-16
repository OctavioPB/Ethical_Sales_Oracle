export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CallScore {
  callId: string;
  score: number;
  riskLevel: RiskLevel;
  deterministicScore: number;
  llmScore: number;
  eventCount: number;
  scoredAt: string;    // ISO 8601
  schemaVersion: string;
  // Enriched by the API from the calls table
  agentId?: string;
  deskId?: string;
  region?: string;
}

export interface RiskAlert {
  eventId: string;
  callId: string;
  ruleId: string;
  category: string;
  matchedPhrase: string;
  speaker: string;
  confidence: number;
  triggeredAt: string; // ISO 8601
  utterance?: string;
}

export interface RiskStreamState {
  calls: CallScore[];
  latestAlert: RiskAlert | null;
  isConnected: boolean;
  isPolling: boolean;
  lastUpdated: Date | null;
}

export interface AuthUser {
  sub: string;         // Auth0 subject
  email: string;
  role: "agent" | "supervisor" | "compliance";
  name?: string;
}

export type Page = "dashboard" | "call" | "reports" | "settings";

// ── Call detail ─────────────────────────────────────────────────────────────

export interface RiskEvent {
  eventId: string;
  ruleId: string;
  category: string;
  matchedPhrase: string;
  speaker: string;
  confidence: number;
  triggeredAt: string;  // ISO 8601
}

export interface AnnotatedUtterance {
  id: number;
  speaker: "AGENT" | "CUSTOMER";
  utterance: string;
  startedAt: string;   // ISO 8601
  endedAt: string;     // ISO 8601
  riskEvents: RiskEvent[];
}

export interface InterventionEvent {
  id: string;
  callId: string;
  supervisorId: string;
  action: "ALERT_AGENT" | "PAUSE_CALL" | "NOTE";
  note?: string;
  triggeredAt: string; // ISO 8601
}

export interface CallDetail {
  call: CallScore;
  utterances: AnnotatedUtterance[];
  riskEvents: RiskEvent[];
  rationale: string | null;
  promptVersion: string | null;
  model: string | null;
  interventions: InterventionEvent[];
}

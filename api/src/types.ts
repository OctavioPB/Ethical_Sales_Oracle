export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CallScore {
  callId: string;
  score: number;
  riskLevel: RiskLevel;
  deterministicScore: number;
  llmScore: number;
  eventCount: number;
  scoredAt: string;          // ISO 8601
  schemaVersion: string;
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
  triggeredAt: string;       // ISO 8601
  utterance?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  auth: {
    sub: string;
    email: string;
    role: "agent" | "supervisor" | "compliance";
  };
}

// ── Call detail ─────────────────────────────────────────────────────────────

export interface RiskEvent {
  eventId: string;
  ruleId: string;
  category: string;
  matchedPhrase: string;
  speaker: string;
  confidence: number;
  triggeredAt: string;
}

export interface AnnotatedUtterance {
  id: number;
  speaker: "AGENT" | "CUSTOMER";
  utterance: string;
  startedAt: string;
  endedAt: string;
  riskEvents: RiskEvent[];
}

export interface InterventionEvent {
  id: string;
  callId: string;
  supervisorId: string;
  action: "ALERT_AGENT" | "PAUSE_CALL" | "NOTE";
  note?: string;
  triggeredAt: string;
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

export interface CallReport {
  callId: string;
  generatedAt: string;
  score: number;
  riskLevel: RiskLevel;
  agentId: string;
  deskId: string;
  region: string;
  scoredAt: string;
  flaggedPhrases: Array<{
    ruleId: string;
    category: string;
    matchedPhrase: string;
    confidence: number;
    triggeredAt: string;
  }>;
  transcript: Array<{
    speaker: string;
    utterance: string;
    startedAt: string;
    endedAt: string;
  }>;
  rationale: string | null;
  promptVersion: string | null;
  model: string | null;
  interventions: InterventionEvent[];
}

"""
Core domain types for the NLP / risk engine.
Named risk_types.py (not types.py) to avoid shadowing Python's built-in types module.
All internal nlp-engine imports use: from risk_types import ...
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

RiskCategory = Literal[
    "PROHIBITED_PROMISE",
    "MISSING_DISCLAIMER",
    "PRESSURE_TACTIC",
    "OFF_SCRIPT_CLAIM",
]

Severity = Literal["HIGH", "CRITICAL"]
MatchType = Literal["exact", "regex"]
Speaker = Literal["AGENT", "CUSTOMER", "UNKNOWN"]


@dataclass
class RiskEvent:
    """
    Emitted by the NLP engine when a rule is triggered (phrase match or missing disclaimer).
    One event per rule per utterance — never duplicate rule hits on the same utterance.
    """

    event_id: str
    call_id: str
    rule_id: str
    category: RiskCategory
    utterance: str
    matched_phrase: str     # Exact substring that triggered the rule
    speaker: Speaker
    confidence: float       # 0.0 – 1.0
    triggered_at: datetime
    schema_version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "eventId": self.event_id,
            "callId": self.call_id,
            "ruleId": self.rule_id,
            "category": self.category,
            "utterance": self.utterance,
            "matchedPhrase": self.matched_phrase,
            "speaker": self.speaker,
            "confidence": round(self.confidence, 4),
            "triggeredAt": self.triggered_at.isoformat(),
            "schemaVersion": self.schema_version,
        }


@dataclass
class PhrasePattern:
    text: str
    match_type: MatchType = "exact"
    languages: list[str] = field(default_factory=lambda: ["en", "es"])


@dataclass
class RuleFixtures:
    positive: list[str] = field(default_factory=list)   # must match
    negative: list[str] = field(default_factory=list)   # must NOT match


@dataclass
class RuleDefinition:
    rule_id: str
    description: str
    severity: Severity
    enabled: bool
    phrases: list[PhrasePattern]
    fixtures: RuleFixtures = field(default_factory=RuleFixtures)


@dataclass
class DisclaimerRuleDefinition:
    """A disclaimer rule specifies phrases that MUST appear somewhere in the call."""

    rule_id: str
    description: str
    severity: Severity
    enabled: bool
    required_phrases: list[PhrasePattern]   # ANY one of these satisfies the requirement
    fixtures: RuleFixtures = field(default_factory=RuleFixtures)


@dataclass
class RuleSet:
    schema_version: str
    category: RiskCategory
    sector: str
    jurisdiction: str
    enabled: bool
    rules: list[RuleDefinition]


@dataclass
class DisclaimerRuleSet:
    schema_version: str
    category: Literal["MISSING_DISCLAIMER"]
    sector: str
    jurisdiction: str
    enabled: bool
    rules: list[DisclaimerRuleDefinition]


# ── Sprint 4: LLM scoring types ───────────────────────────────────────────────


@dataclass
class LLMScoreResult:
    """Result returned by the LLM scoring service. Never persisted directly — only hashes are stored."""

    score: int              # 0–100 contextual risk score
    rationale: str          # LLM-generated explanation (transient; not logged to DB)
    model: str              # e.g. "claude-sonnet-4-20250514"
    prompt_hash: str        # SHA-256 hex of the full prompt string
    response_hash: str      # SHA-256 hex of the raw API response text
    latency_ms: int
    prompt_version: str = "v1"


@dataclass
class CallRiskScore:
    """Final aggregated risk score published for a completed call."""

    call_id: str
    score: int              # 0–100 final score (max of deterministic and llm_score)
    deterministic_score: int    # phrase-match contribution, capped at 100
    llm_score: int              # LLM contextual contribution
    event_count: int            # total risk events from phrase matching + disclaimer checks
    scored_at: datetime
    schema_version: str = "1.0.0"

    @property
    def risk_level(self) -> RiskLevel:
        if self.score <= 30:
            return "LOW"
        if self.score <= 60:
            return "MEDIUM"
        if self.score <= 85:
            return "HIGH"
        return "CRITICAL"

    def to_dict(self) -> dict[str, Any]:
        return {
            "callId": self.call_id,
            "score": self.score,
            "riskLevel": self.risk_level,
            "deterministicScore": self.deterministic_score,
            "llmScore": self.llm_score,
            "eventCount": self.event_count,
            "scoredAt": self.scored_at.isoformat(),
            "schemaVersion": self.schema_version,
        }

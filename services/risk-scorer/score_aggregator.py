"""
Score aggregator.

Combines the deterministic phrase-match score with the LLM contextual score into
a single CallRiskScore. The final score is the maximum of the two components —
a conservative strategy that ensures neither detector can suppress the other.

Category weights (deterministic contribution per event):
  PROHIBITED_PROMISE  → 30 pts  (most severe: explicit false guarantees)
  PRESSURE_TACTIC     → 20 pts  (deliberate manipulation of customer decision)
  OFF_SCRIPT_CLAIM    → 20 pts  (unverifiable product claims)
  MISSING_DISCLAIMER  → 12 pts  (regulatory omission — serious but not intentional)
  (anything else)     → 10 pts  (fallback for future category additions)

Deterministic score is capped at 100. The LLM score (0–100) is then taken as an
alternative rather than additive signal — final = max(deterministic, llm_score).
"""

from __future__ import annotations

from datetime import datetime, timezone

from risk_types import CallRiskScore, LLMScoreResult, RiskEvent

_CATEGORY_WEIGHTS: dict[str, int] = {
    "PROHIBITED_PROMISE": 30,
    "PRESSURE_TACTIC": 20,
    "OFF_SCRIPT_CLAIM": 20,
    "MISSING_DISCLAIMER": 12,
}
_DEFAULT_WEIGHT = 10


class ScoreAggregator:
    """Stateless; safe to call from multiple threads or Airflow tasks."""

    def aggregate(
        self,
        risk_events: list[RiskEvent],
        llm_result: LLMScoreResult,
        call_id: str,
        scored_at: datetime | None = None,
    ) -> CallRiskScore:
        """
        Returns a CallRiskScore whose `score` is max(deterministic, llm_result.score).
        Both component scores are preserved in the returned object for auditability.
        """
        deterministic = min(
            100,
            sum(_CATEGORY_WEIGHTS.get(e.category, _DEFAULT_WEIGHT) for e in risk_events),
        )
        final = max(deterministic, llm_result.score)

        return CallRiskScore(
            call_id=call_id,
            score=final,
            deterministic_score=deterministic,
            llm_score=llm_result.score,
            event_count=len(risk_events),
            scored_at=scored_at or datetime.now(timezone.utc),
        )

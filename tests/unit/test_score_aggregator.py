"""
Unit tests for ScoreAggregator.

Acceptance criteria:
  - Final score = max(deterministic, llm_score)
  - Deterministic score uses correct category weights (PP=30, PT=20, MD=12)
  - Deterministic score capped at 100
  - Empty risk_events: deterministic=0, final=llm_score
  - risk_level property correct for all four bands (LOW/MEDIUM/HIGH/CRITICAL)
  - to_dict() returns camelCase keys with all expected fields
  - scored_at defaults to now(UTC) when not supplied
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from risk_types import CallRiskScore, LLMScoreResult, RiskEvent
from score_aggregator import ScoreAggregator

_FIXED_TS = datetime(2026, 5, 15, 9, 0, 0, tzinfo=timezone.utc)


def _make_event(category: str, rule_id: str = "PP-001") -> RiskEvent:
    return RiskEvent(
        event_id="evt-001",
        call_id="call-001",
        rule_id=rule_id,
        category=category,
        utterance="test",
        matched_phrase="test phrase",
        speaker="AGENT",
        confidence=1.0,
        triggered_at=_FIXED_TS,
    )


def _make_llm(score: int) -> LLMScoreResult:
    return LLMScoreResult(
        score=score,
        rationale="mocked",
        model="mock-model",
        prompt_hash="a" * 64,
        response_hash="b" * 64,
        latency_ms=42,
    )


@pytest.fixture
def aggregator() -> ScoreAggregator:
    return ScoreAggregator()


# ── Deterministic score weights ───────────────────────────────────────────────


class TestDeterministicScore:
    def test_prohibited_promise_weight_30(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PROHIBITED_PROMISE")]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 30

    def test_pressure_tactic_weight_20(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PRESSURE_TACTIC")]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 20

    def test_missing_disclaimer_weight_12(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("MISSING_DISCLAIMER")]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 12

    def test_off_script_claim_weight_20(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("OFF_SCRIPT_CLAIM")]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 20

    def test_unknown_category_uses_default_10(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("UNKNOWN_CATEGORY")]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 10

    def test_multiple_events_accumulate(self, aggregator: ScoreAggregator) -> None:
        events = [
            _make_event("PROHIBITED_PROMISE"),  # 30
            _make_event("PRESSURE_TACTIC"),      # 20
            _make_event("MISSING_DISCLAIMER"),   # 12
        ]
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 62

    def test_deterministic_capped_at_100(self, aggregator: ScoreAggregator) -> None:
        # 4 PP = 120 → capped at 100
        events = [_make_event("PROHIBITED_PROMISE")] * 4
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 100

    def test_zero_events_deterministic_is_zero(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.deterministic_score == 0


# ── Final score = max(deterministic, llm_score) ───────────────────────────────


class TestFinalScore:
    def test_llm_wins_when_higher(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("MISSING_DISCLAIMER")]  # det=12
        result = aggregator.aggregate(events, _make_llm(90), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 90

    def test_deterministic_wins_when_higher(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PROHIBITED_PROMISE")] * 3  # det=90
        result = aggregator.aggregate(events, _make_llm(40), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 90

    def test_equal_scores_returns_that_score(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PROHIBITED_PROMISE")] * 2  # det=60
        result = aggregator.aggregate(events, _make_llm(60), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 60

    def test_empty_events_llm_score_is_final(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(55), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 55

    def test_llm_zero_deterministic_wins(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PROHIBITED_PROMISE")]  # det=30
        result = aggregator.aggregate(events, _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 30

    def test_both_zero_final_is_zero(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.score == 0


# ── CallRiskScore metadata ─────────────────────────────────────────────────────


class TestCallRiskScoreMetadata:
    def test_event_count_matches_input(self, aggregator: ScoreAggregator) -> None:
        events = [_make_event("PROHIBITED_PROMISE")] * 3
        result = aggregator.aggregate(events, _make_llm(50), call_id="c", scored_at=_FIXED_TS)
        assert result.event_count == 3

    def test_call_id_preserved(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="my-call-id", scored_at=_FIXED_TS)
        assert result.call_id == "my-call-id"

    def test_scored_at_preserved(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.scored_at == _FIXED_TS

    def test_scored_at_defaults_to_utc_now(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="c")
        assert result.scored_at.tzinfo is not None

    def test_llm_score_stored_separately(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(73), call_id="c", scored_at=_FIXED_TS)
        assert result.llm_score == 73

    def test_schema_version_default(self, aggregator: ScoreAggregator) -> None:
        result = aggregator.aggregate([], _make_llm(0), call_id="c", scored_at=_FIXED_TS)
        assert result.schema_version == "1.0.0"


# ── risk_level property ───────────────────────────────────────────────────────


class TestRiskLevel:
    @pytest.mark.parametrize("score,expected", [
        (0, "LOW"),
        (15, "LOW"),
        (30, "LOW"),
        (31, "MEDIUM"),
        (45, "MEDIUM"),
        (60, "MEDIUM"),
        (61, "HIGH"),
        (72, "HIGH"),
        (85, "HIGH"),
        (86, "CRITICAL"),
        (95, "CRITICAL"),
        (100, "CRITICAL"),
    ])
    def test_risk_level_bands(self, score: int, expected: str) -> None:
        cs = CallRiskScore(
            call_id="c", score=score, deterministic_score=0,
            llm_score=0, event_count=0, scored_at=_FIXED_TS,
        )
        assert cs.risk_level == expected


# ── to_dict() ─────────────────────────────────────────────────────────────────


class TestToDict:
    @pytest.fixture
    def score_dict(self, aggregator: ScoreAggregator) -> dict:
        events = [_make_event("PROHIBITED_PROMISE"), _make_event("PRESSURE_TACTIC")]
        result = aggregator.aggregate(events, _make_llm(88), call_id="call-x", scored_at=_FIXED_TS)
        return result.to_dict()

    def test_camel_case_keys_present(self, score_dict: dict) -> None:
        for key in ("callId", "score", "riskLevel", "deterministicScore", "llmScore",
                    "eventCount", "scoredAt", "schemaVersion"):
            assert key in score_dict, f"Missing key: {key}"

    def test_scored_at_is_iso_format(self, score_dict: dict) -> None:
        datetime.fromisoformat(score_dict["scoredAt"])  # should not raise

    def test_risk_level_in_dict(self, score_dict: dict) -> None:
        assert score_dict["riskLevel"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")

    def test_score_values_correct(self, score_dict: dict) -> None:
        # det = 30 + 20 = 50; llm = 88; final = 88
        assert score_dict["score"] == 88
        assert score_dict["deterministicScore"] == 50
        assert score_dict["llmScore"] == 88
        assert score_dict["eventCount"] == 2

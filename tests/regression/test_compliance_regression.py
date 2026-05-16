"""
Compliance regression suite — Sprint 4 acceptance criterion.

Each test represents a known mis-selling script that MUST produce a Critical
risk score (≥ 86) every time. A regression failure here means the detection
engine has weakened — this is a P0 blocker for any release.

Test strategy:
  - Use the real RiskPhraseMatcher and DisclaimerChecker (reads production YAML rules).
  - LLM scorer is mocked with a deterministic score representing what an LLM would
    reasonably assign to clear mis-selling (90). This ensures:
      (a) The test does not require a live ANTHROPIC_API_KEY in CI.
      (b) The critical-score threshold is reached even if the LLM under-scores
          (any deterministic score above 86 will still pass via max()).
  - Tests that reach ≥ 86 from the deterministic path alone are noted — they are
    the strongest regression guards because they would pass even with LLM score=0.

Scripts:
  A — Classic guaranteed return + FOMO: multi-PP + PT violations, no disclaimers
  B — Zero-risk + scarcity: PP-002 + PT-002, no disclaimers
  C — "Cannot lose" + deadline: PP-003 + PT-001, no disclaimers
  D — Full prohibited-promise barrage: 3 distinct PP rules triggered
  E — Pressure-only call: multiple PT violations, all 4 disclaimers missing
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from disclaimer_checker import DisclaimerChecker
from phrase_matcher import RiskPhraseMatcher
from risk_types import CallRiskScore, LLMScoreResult, RiskEvent
from score_aggregator import ScoreAggregator

_RULES_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "rules"
_SPACY_MODEL = "en_core_web_sm"
_MOCK_LLM_SCORE = 90   # reasonable score for a clear mis-selling call
_CRITICAL_THRESHOLD = 86


def _mock_llm_result(score: int = _MOCK_LLM_SCORE) -> LLMScoreResult:
    return LLMScoreResult(
        score=score,
        rationale="mocked for regression test",
        model="mock-model",
        prompt_hash="a" * 64,
        response_hash="b" * 64,
        latency_ms=0,
    )


@pytest.fixture(scope="module")
def matcher() -> RiskPhraseMatcher:
    return RiskPhraseMatcher(rules_dir=_RULES_DIR, spacy_model=_SPACY_MODEL)


@pytest.fixture(scope="module")
def checker() -> DisclaimerChecker:
    return DisclaimerChecker(rules_dir=_RULES_DIR)


@pytest.fixture(scope="module")
def aggregator() -> ScoreAggregator:
    return ScoreAggregator()


def _score_script(
    utterances: list[dict[str, Any]],
    matcher: RiskPhraseMatcher,
    checker: DisclaimerChecker,
    aggregator: ScoreAggregator,
    call_id: str = "regression",
    mock_llm_score: int = _MOCK_LLM_SCORE,
) -> CallRiskScore:
    phrase_events = matcher.match_transcript(utterances, call_id=call_id)
    disclaimer_events = checker.check_transcript(utterances, call_id=call_id)
    all_events = phrase_events + disclaimer_events
    return aggregator.aggregate(
        risk_events=all_events,
        llm_result=_mock_llm_result(mock_llm_score),
        call_id=call_id,
        scored_at=datetime(2026, 5, 15, 9, 0, tzinfo=timezone.utc),
    )


# ── Script A: guaranteed return + FOMO + all disclaimers missing ─────────────


class TestScriptA_GuaranteedReturnAndFOMO:
    """
    An agent makes a guaranteed return promise, creates FOMO urgency, claims
    the product is risk-free, and delivers zero disclaimers.

    Minimum deterministic: PP-001(30) + PP-002(30) + PT-003(20) + 4×MD(48) = 128 → 100
    """

    UTTERANCES = [
        {
            "text": "This product offers a guaranteed return of fifteen percent per annum.",
            "speaker": "AGENT",
        },
        {
            "text": "Your investment is completely risk free — capital is fully protected.",
            "speaker": "AGENT",
        },
        {
            "text": "If you don't act now you will miss out on these returns entirely.",
            "speaker": "AGENT",
        },
        {
            "text": "I can process your application while we are on this call today.",
            "speaker": "AGENT",
        },
    ]

    def test_score_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(self.UTTERANCES, matcher, checker, aggregator, "script-A")
        assert result.score >= _CRITICAL_THRESHOLD, (
            f"Script A scored {result.score} — expected ≥ {_CRITICAL_THRESHOLD}. "
            f"det={result.deterministic_score}, llm={result.llm_score}, "
            f"events={result.event_count}"
        )
        assert result.risk_level == "CRITICAL"

    def test_deterministic_alone_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        """Regression: deterministic score must reach Critical without relying on LLM."""
        result = _score_script(
            self.UTTERANCES, matcher, checker, aggregator, "script-A-det", mock_llm_score=0
        )
        assert result.deterministic_score >= _CRITICAL_THRESHOLD, (
            f"Script A deterministic score {result.deterministic_score} is below Critical. "
            f"The phrase rules may have regressed."
        )


# ── Script B: zero-risk + scarcity + no disclaimers ──────────────────────────


class TestScriptB_ZeroRiskAndScarcity:
    """
    Agent claims product is completely risk-free and creates artificial scarcity
    to pressure the customer into a quick decision.

    Minimum deterministic: PP-002(30) + PT-002(20) + 4×MD(48) = 98 → 98
    """

    UTTERANCES = [
        {
            "text": "This is a zero risk investment — you simply cannot lose money.",
            "speaker": "AGENT",
        },
        {
            "text": "The product is completely risk free for the investor.",
            "speaker": "AGENT",
        },
        {
            "text": "We have limited allocation and I cannot guarantee your spot after today.",
            "speaker": "AGENT",
        },
        {
            "text": "This is an exclusive opportunity not available to the general public.",
            "speaker": "AGENT",
        },
    ]

    def test_score_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(self.UTTERANCES, matcher, checker, aggregator, "script-B")
        assert result.score >= _CRITICAL_THRESHOLD, (
            f"Script B scored {result.score}. det={result.deterministic_score}, events={result.event_count}"
        )

    def test_multiple_rule_categories_triggered(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        phrase_events = matcher.match_transcript(self.UTTERANCES, call_id="script-B")
        disclaimer_events = checker.check_transcript(self.UTTERANCES, call_id="script-B")
        categories = {e.category for e in phrase_events + disclaimer_events}
        assert "PROHIBITED_PROMISE" in categories
        assert "PRESSURE_TACTIC" in categories
        assert "MISSING_DISCLAIMER" in categories


# ── Script C: "cannot lose" + deadline pressure + no disclaimers ─────────────


class TestScriptC_CannotLoseAndDeadline:
    """
    Agent asserts no investor has ever lost money and uses explicit time pressure.

    Minimum deterministic: PP-003(30) + PT-001(20) + 4×MD(48) = 98 → 98
    """

    UTTERANCES = [
        {
            "text": "No investor has ever lost a penny with us in ten years of operation.",
            "speaker": "AGENT",
        },
        {
            "text": "With this product you simply can't lose money — the returns are locked in.",
            "speaker": "AGENT",
        },
        {
            "text": "The offer closes today so you need to make a decision right now.",
            "speaker": "AGENT",
        },
        {
            "text": "This is a today only rate that I cannot hold for you beyond midnight.",
            "speaker": "AGENT",
        },
    ]

    def test_score_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(self.UTTERANCES, matcher, checker, aggregator, "script-C")
        assert result.score >= _CRITICAL_THRESHOLD, (
            f"Script C scored {result.score}. det={result.deterministic_score}, events={result.event_count}"
        )

    def test_pp003_and_pt001_both_fired(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        phrase_events = matcher.match_transcript(self.UTTERANCES, call_id="script-C")
        rule_ids = {e.rule_id for e in phrase_events}
        assert "PP-003" in rule_ids, "PP-003 (cannot lose) must fire for Script C"
        assert "PT-001" in rule_ids, "PT-001 (deadline pressure) must fire for Script C"


# ── Script D: prohibited-promise barrage (three distinct PP rules) ────────────


class TestScriptD_ProhibitedPromiseBarrage:
    """
    Agent triggers three distinct prohibited-promise rules in a single call.

    Minimum deterministic: PP-001(30) + PP-002(30) + PP-003(30) + 4×MD(48) = 138 → 100
    Passes even with LLM score=0.
    """

    UTTERANCES = [
        {
            "text": "We guarantee a return on your investment regardless of market conditions.",
            "speaker": "AGENT",
        },
        {
            "text": "It is one hundred percent safe — your capital is fully protected.",
            "speaker": "AGENT",
        },
        {
            "text": "Our clients cannot lose money on this structured product.",
            "speaker": "AGENT",
        },
        {
            "text": "I just need your signature and we can get your allocation confirmed.",
            "speaker": "AGENT",
        },
    ]

    def test_score_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(self.UTTERANCES, matcher, checker, aggregator, "script-D")
        assert result.score >= _CRITICAL_THRESHOLD

    def test_deterministic_alone_is_critical_without_llm(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(
            self.UTTERANCES, matcher, checker, aggregator, "script-D-det", mock_llm_score=0
        )
        assert result.deterministic_score >= _CRITICAL_THRESHOLD, (
            f"Script D deterministic {result.deterministic_score} < {_CRITICAL_THRESHOLD}. "
            f"PP rule weights may have regressed."
        )

    def test_three_distinct_pp_rules_fired(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        phrase_events = matcher.match_transcript(self.UTTERANCES, call_id="script-D")
        pp_ids = {e.rule_id for e in phrase_events if e.category == "PROHIBITED_PROMISE"}
        assert len(pp_ids) >= 3, (
            f"Expected ≥ 3 distinct PP rules, got {pp_ids}. Regression in rule coverage."
        )


# ── Script E: pressure-only call, all disclaimers missing ────────────────────


class TestScriptE_PressureTacticsAndMissingDisclaimers:
    """
    No explicit prohibited promises — agent uses multiple pressure tactics and
    delivers zero required disclaimers. Tests that MD + PT alone can reach Critical.

    Minimum deterministic: PT-001(20) + PT-002(20) + PT-003(20) + 4×MD(48) = 108 → 100
    """

    UTTERANCES = [
        {
            "text": "The offer closes today so you need to make a decision right now.",
            "speaker": "AGENT",
        },
        {
            "text": "This is an exclusive opportunity not available to the general public.",
            "speaker": "AGENT",
        },
        {
            "text": "Don't miss out — other clients are already confirming their positions.",
            "speaker": "AGENT",
        },
        {
            "text": "You must decide today or the allocation will be given to another client.",
            "speaker": "AGENT",
        },
        {
            "text": "This is genuinely one of the best products we have ever offered our clients.",
            "speaker": "AGENT",
        },
    ]

    def test_score_is_critical(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        result = _score_script(self.UTTERANCES, matcher, checker, aggregator, "script-E")
        assert result.score >= _CRITICAL_THRESHOLD, (
            f"Script E scored {result.score}. det={result.deterministic_score}, "
            f"events={result.event_count}"
        )

    def test_all_four_disclaimers_missing(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        disclaimer_events = checker.check_transcript(self.UTTERANCES, call_id="script-E")
        missing_ids = {e.rule_id for e in disclaimer_events}
        assert {"MD-001", "MD-002", "MD-003", "MD-004"}.issubset(missing_ids), (
            f"Expected all 4 disclaimer rules to fire. Got: {missing_ids}"
        )

    def test_pressure_tactics_all_fired(
        self, matcher: RiskPhraseMatcher, checker: DisclaimerChecker, aggregator: ScoreAggregator
    ) -> None:
        phrase_events = matcher.match_transcript(self.UTTERANCES, call_id="script-E")
        pt_ids = {e.rule_id for e in phrase_events if e.category == "PRESSURE_TACTIC"}
        assert len(pt_ids) >= 3, (
            f"Expected ≥ 3 PT rules to fire, got {pt_ids}"
        )

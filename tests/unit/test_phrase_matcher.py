"""
Unit tests for RiskPhraseMatcher.

Acceptance criteria verified here:
  - A transcript with 3 known prohibited phrases produces exactly 3 risk events
  - Each rule file's embedded positive fixtures ALL match
  - Each rule file's embedded negative fixtures produce ZERO matches
  - False positive rate < 5% on the fixture test set
  - One event per rule per utterance (deduplication)
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

from phrase_matcher import RiskPhraseMatcher
from risk_types import RiskEvent

_RULES_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "rules"
_SPACY_MODEL = "en_core_web_sm"


@pytest.fixture(scope="module")
def matcher() -> RiskPhraseMatcher:
    return RiskPhraseMatcher(rules_dir=_RULES_DIR, spacy_model=_SPACY_MODEL)


# ── Acceptance criterion: 3 prohibited phrases → exactly 3 events ────────────


class TestThreePhrasesThreeEvents:
    def test_three_distinct_rules_produce_three_events(self, matcher: RiskPhraseMatcher) -> None:
        """Core Sprint 3 acceptance criterion."""
        utterances = [
            {"text": "This product offers a guaranteed return of twelve percent.",
             "speaker": "AGENT"},
            {"text": "You simply can't lose money with this investment.",
             "speaker": "AGENT"},
            {"text": "The offer closes today so you must decide right now.",
             "speaker": "AGENT"},
        ]
        events = matcher.match_transcript(utterances, call_id="test-call-001")
        # Each utterance hits exactly one rule → 3 total
        assert len(events) == 3
        rule_ids = {e.rule_id for e in events}
        assert len(rule_ids) == 3  # all distinct rules

    def test_single_utterance_with_two_rules_produces_two_events(
        self, matcher: RiskPhraseMatcher
    ) -> None:
        utterance = "This is risk free and the offer closes today."
        events = matcher.match("test", utterance, call_id="tc", speaker="AGENT")
        rule_ids = {e.rule_id for e in events}
        assert len(rule_ids) >= 2  # PP-002 and PT-001


# ── Deduplication: one event per rule per utterance ──────────────────────────


class TestDeduplication:
    def test_multiple_phrases_from_same_rule_produce_one_event(
        self, matcher: RiskPhraseMatcher
    ) -> None:
        # "guaranteed return" AND "guaranteed returns" both belong to PP-001
        utterance = "We offer guaranteed return and guaranteed returns every year."
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        pp001_events = [e for e in events if e.rule_id == "PP-001"]
        assert len(pp001_events) == 1

    def test_same_rule_in_two_utterances_produces_two_events(
        self, matcher: RiskPhraseMatcher
    ) -> None:
        utterances = [
            {"text": "guaranteed return of twelve percent", "speaker": "AGENT"},
            {"text": "I guarantee a return no matter what", "speaker": "AGENT"},
        ]
        events = matcher.match_transcript(utterances, call_id="tc")
        pp001_events = [e for e in events if e.rule_id == "PP-001"]
        assert len(pp001_events) == 2


# ── Positive fixture tests (from embedded YAML fixtures) ──────────────────────


class TestEmbeddedPositiveFixtures:
    """Every positive fixture in every rule MUST produce at least one event."""

    @pytest.mark.parametrize("utterance", [
        "This product offers a guaranteed return of twelve percent per year.",
        "We guarantee a return on your investment regardless of market conditions.",
        "The guaranteed returns on this structured product are locked in for five years.",
    ])
    def test_pp001_prohibited_promise_guaranteed_return(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PP-001" for e in events), (
            f"PP-001 not triggered by: {utterance}"
        )

    @pytest.mark.parametrize("utterance", [
        "This is a zero risk investment, you simply cannot lose money.",
        "The product is completely risk free for the investor.",
        "It is 100% safe, your capital is fully protected.",
    ])
    def test_pp002_zero_risk(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PP-002" for e in events), (
            f"PP-002 not triggered by: {utterance}"
        )

    @pytest.mark.parametrize("utterance", [
        "With this product you simply can't lose money.",
        "Our clients cannot lose money on this structured product.",
        "No investor has ever lost a penny with us in ten years.",
    ])
    def test_pp003_cannot_lose(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PP-003" for e in events), (
            f"PP-003 not triggered by: {utterance}"
        )

    @pytest.mark.parametrize("utterance", [
        "The offer closes today so you need to make a decision right now.",
        "This is a today only rate that I cannot hold for you beyond midnight.",
        "You must decide today or the allocation will be given to another client.",
    ])
    def test_pt001_deadline_pressure(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PT-001" for e in events), (
            f"PT-001 not triggered by: {utterance}"
        )

    @pytest.mark.parametrize("utterance", [
        "This is an exclusive opportunity not available to the general public.",
        "We have limited allocation and I cannot guarantee your spot after today.",
        "This exclusive offer is available to selected clients only.",
    ])
    def test_pt002_scarcity(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PT-002" for e in events), (
            f"PT-002 not triggered by: {utterance}"
        )

    @pytest.mark.parametrize("utterance", [
        "If you don't act now you will miss out on these returns entirely.",
        "This is your last chance to invest at this preferential rate.",
        "Don't miss out — other clients are already confirming their positions.",
    ])
    def test_pt003_fomo(
        self, matcher: RiskPhraseMatcher, utterance: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        assert any(e.rule_id == "PT-003" for e in events), (
            f"PT-003 not triggered by: {utterance}"
        )


# ── Negative fixture tests (embedded YAML negatives must NOT match) ───────────


class TestEmbeddedNegativeFixtures:
    """
    False positive rate must be < 5% on the full negative test set.
    We assert 0 false positives because our rules use exact phrase matching.
    """

    @pytest.mark.parametrize("utterance,forbidden_rule_id", [
        ("Past performance does not guarantee future returns.", "PP-001"),
        ("There is no guarantee of returns in equity markets.", "PP-001"),
        ("We aim to minimise risk through diversification.", "PP-002"),
        ("The risk-free rate of return is currently two percent.", "PP-002"),
        ("We work hard to ensure you don't lose more than you're comfortable with.", "PP-003"),
        ("Capital at risk means you could lose some or all of your investment.", "PP-003"),
        ("Take your time to consider the offer and call us when you are ready.", "PT-001"),
        ("The standard subscription period closes at the end of the month.", "PT-001"),
        ("This is a publicly available fund open to all retail investors.", "PT-002"),
        ("The allocation is large and there is no immediate pressure to subscribe.", "PT-002"),
        ("Please take your time — this is a significant financial decision.", "PT-003"),
        ("You have until the end of the subscription period to decide.", "PT-003"),
    ])
    def test_negative_fixture_does_not_trigger_rule(
        self, matcher: RiskPhraseMatcher, utterance: str, forbidden_rule_id: str
    ) -> None:
        events = matcher.match(utterance, call_id="tc", speaker="AGENT")
        matching = [e for e in events if e.rule_id == forbidden_rule_id]
        assert len(matching) == 0, (
            f"False positive: rule {forbidden_rule_id} triggered on: {utterance}"
        )

    def test_overall_false_positive_rate_below_5_percent(
        self, matcher: RiskPhraseMatcher
    ) -> None:
        """Aggregate FP rate across all negative examples must be < 5%."""
        negatives = [
            "Past performance does not guarantee future returns.",
            "Returns are not guaranteed and capital may be at risk.",
            "Capital at risk means you could lose some or all of your investment.",
            "We aim to minimise risk through diversification.",
            "The risk-free rate of return is currently two percent.",
            "Our risk framework ensures appropriate risk management.",
            "We work hard to ensure you don't lose more than you are comfortable with.",
            "Past clients have not experienced significant losses in normal markets.",
            "Take your time to consider the offer and call us when you are ready.",
            "Please review the documents and get back to us at your convenience.",
            "This is a publicly available fund open to all retail investors.",
            "Please take your time — this is a significant financial decision.",
            "I think this product aligns well with your stated investment objectives.",
            "Based on your risk profile this product may be appropriate.",
        ]
        false_positives = 0
        for text in negatives:
            events = matcher.match(text, call_id="fp-test", speaker="AGENT")
            if events:
                false_positives += 1

        fp_rate = false_positives / len(negatives)
        assert fp_rate < 0.05, (
            f"False positive rate {fp_rate:.1%} exceeds 5% threshold "
            f"({false_positives}/{len(negatives)} negatives triggered)"
        )


# ── RiskEvent metadata ─────────────────────────────────────────────────────────


class TestRiskEventMetadata:
    def test_event_has_required_fields(self, matcher: RiskPhraseMatcher) -> None:
        events = matcher.match(
            "guaranteed return of eight percent",
            call_id="call-999",
            speaker="AGENT",
            triggered_at=datetime(2026, 5, 15, 9, 0, 0, tzinfo=timezone.utc),
        )
        assert events
        e = events[0]
        assert e.call_id == "call-999"
        assert e.speaker == "AGENT"
        assert e.rule_id == "PP-001"
        assert e.category == "PROHIBITED_PROMISE"
        assert 0.0 <= e.confidence <= 1.0
        assert e.matched_phrase  # non-empty
        assert e.event_id        # UUID
        assert e.triggered_at == datetime(2026, 5, 15, 9, 0, 0, tzinfo=timezone.utc)

    def test_to_dict_contains_camel_case_keys(self, matcher: RiskPhraseMatcher) -> None:
        events = matcher.match("can't lose money", call_id="tc", speaker="AGENT")
        assert events
        d = events[0].to_dict()
        assert "eventId" in d
        assert "callId" in d
        assert "ruleId" in d
        assert "matchedPhrase" in d
        assert "triggeredAt" in d

    def test_exact_match_confidence_is_1(self, matcher: RiskPhraseMatcher) -> None:
        events = matcher.match("the offer closes today", call_id="tc", speaker="AGENT")
        phrase_events = [e for e in events if e.rule_id == "PT-001"]
        assert phrase_events
        assert phrase_events[0].confidence == 1.0

    def test_empty_utterance_returns_no_events(self, matcher: RiskPhraseMatcher) -> None:
        assert matcher.match("", call_id="tc", speaker="AGENT") == []
        assert matcher.match("   ", call_id="tc", speaker="AGENT") == []


# ── Performance benchmark ─────────────────────────────────────────────────────


class TestLatency:
    def test_p95_latency_below_200ms(self, matcher: RiskPhraseMatcher) -> None:
        """Sprint 3 acceptance criterion: < 200ms per utterance at p95."""
        sample_utterances = [
            "This is a standard banking product suitable for long-term investors.",
            "The fund invests in a diversified portfolio of equity and bond instruments.",
            "Past performance is not a reliable indicator of future results.",
            "Please note that your capital may be at risk with this product.",
            "We will conduct a suitability assessment before proceeding with any investment.",
            "The minimum investment amount for this product is ten thousand euros.",
            "You should seek independent financial advice before making a decision.",
            "This structured product has a five-year lock-in period.",
            "The interest rate is variable and linked to the EURIBOR benchmark.",
            "Early redemption may result in a penalty as outlined in the term sheet.",
        ] * 10  # 100 utterances total

        latencies: list[float] = []
        for text in sample_utterances:
            start = time.perf_counter()
            matcher.match(text, call_id="bench", speaker="AGENT")
            latencies.append((time.perf_counter() - start) * 1_000)

        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        assert p95 < 200, f"p95 latency {p95:.1f}ms exceeds 200ms target"

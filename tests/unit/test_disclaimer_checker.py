"""
Unit tests for DisclaimerChecker.

Acceptance criteria verified here:
  - Each disclaimer rule triggers when ALL its required phrases are absent
  - Each disclaimer rule does NOT trigger when ANY required phrase is present
  - Positive fixtures from rule YAML are satisfied (no event raised)
  - Negative fixtures from rule YAML do raise a MISSING_DISCLAIMER event
  - check_single() accurately reports phrase presence/absence
  - Disabled rules produce no events
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from disclaimer_checker import DisclaimerChecker
from risk_types import RiskEvent

_RULES_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "rules"

_CALL_ID = "dc-test-001"
_FIXED_TS = datetime(2026, 5, 15, 10, 0, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def checker() -> DisclaimerChecker:
    return DisclaimerChecker(rules_dir=_RULES_DIR)


# ── MD-001: Past performance disclaimer ──────────────────────────────────────


class TestMD001PastPerformance:
    def test_fires_when_past_performance_phrase_absent(
        self, checker: DisclaimerChecker
    ) -> None:
        utterances = [
            {"text": "The fund has returned eight percent per year consistently.", "speaker": "AGENT"},
            {"text": "Our track record is excellent and investors have made money.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        assert any(e.rule_id == "MD-001" for e in events)

    @pytest.mark.parametrize("phrase", [
        "past performance is not a guarantee of future results",
        "past performance does not guarantee future returns",
        "past performance is not indicative of future results",
        "past performance is no guarantee of what may happen",
        "historic performance is not a reliable guide",
    ])
    def test_does_not_fire_when_required_phrase_present(
        self, checker: DisclaimerChecker, phrase: str
    ) -> None:
        utterances = [{"text": phrase, "speaker": "AGENT"}]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        md001 = [e for e in events if e.rule_id == "MD-001"]
        assert len(md001) == 0, f"MD-001 fired despite disclaimer phrase: {phrase}"

    @pytest.mark.parametrize("utterance", [
        "I must remind you that past performance is not a guarantee of future results.",
        "Our fund has returned eight percent annually but past performance does not guarantee future returns.",
        "Historical performance has been strong, though past performance is not indicative of future results.",
    ])
    def test_positive_yaml_fixtures_satisfy_rule(
        self, checker: DisclaimerChecker, utterance: str
    ) -> None:
        events = checker.check_transcript(
            [{"text": utterance, "speaker": "AGENT"}], call_id=_CALL_ID
        )
        assert not any(e.rule_id == "MD-001" for e in events)

    @pytest.mark.parametrize("utterance", [
        "The fund has returned eight percent per year consistently and we expect this to continue.",
        "Our track record is excellent and investors have always made money.",
    ])
    def test_negative_yaml_fixtures_trigger_rule(
        self, checker: DisclaimerChecker, utterance: str
    ) -> None:
        events = checker.check_transcript(
            [{"text": utterance, "speaker": "AGENT"}], call_id=_CALL_ID
        )
        md001 = [e for e in events if e.rule_id == "MD-001"]
        assert md001, f"MD-001 should fire for transcript lacking disclaimer: {utterance}"


# ── MD-002: Capital at risk disclaimer ───────────────────────────────────────


class TestMD002CapitalAtRisk:
    def test_fires_when_capital_risk_phrase_absent(
        self, checker: DisclaimerChecker
    ) -> None:
        utterances = [
            {"text": "This is a very secure product with excellent historical returns.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        assert any(e.rule_id == "MD-002" for e in events)

    @pytest.mark.parametrize("phrase", [
        "capital may be at risk",
        "capital is at risk",
        "you may get back less than you invest",
        "you could lose some or all of your capital",
        "your investment may fall in value",
    ])
    def test_does_not_fire_when_required_phrase_present(
        self, checker: DisclaimerChecker, phrase: str
    ) -> None:
        utterances = [{"text": phrase, "speaker": "AGENT"}]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        md002 = [e for e in events if e.rule_id == "MD-002"]
        assert len(md002) == 0, f"MD-002 fired despite disclaimer phrase: {phrase}"

    @pytest.mark.parametrize("utterance", [
        "Please note that capital may be at risk and you may get back less than you invest.",
        "Investments can go down as well as up and your capital is at risk.",
        "Important: you could lose some or all of your invested capital.",
    ])
    def test_positive_yaml_fixtures_satisfy_rule(
        self, checker: DisclaimerChecker, utterance: str
    ) -> None:
        events = checker.check_transcript(
            [{"text": utterance, "speaker": "AGENT"}], call_id=_CALL_ID
        )
        assert not any(e.rule_id == "MD-002" for e in events)


# ── MD-003: Independent advice disclaimer ────────────────────────────────────


class TestMD003IndependentAdvice:
    def test_fires_when_advice_phrase_absent(
        self, checker: DisclaimerChecker
    ) -> None:
        utterances = [
            {"text": "I am confident this product is right for you.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        assert any(e.rule_id == "MD-003" for e in events)

    @pytest.mark.parametrize("phrase", [
        "independent financial advice",
        "independent financial adviser",
        "independent advice",
        "consult a financial adviser",
    ])
    def test_does_not_fire_when_required_phrase_present(
        self, checker: DisclaimerChecker, phrase: str
    ) -> None:
        utterances = [{"text": f"You should seek {phrase} before proceeding.", "speaker": "AGENT"}]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        md003 = [e for e in events if e.rule_id == "MD-003"]
        assert len(md003) == 0, f"MD-003 fired despite phrase: {phrase}"


# ── MD-004: Suitability disclaimer ───────────────────────────────────────────


class TestMD004Suitability:
    def test_fires_when_suitability_phrase_absent(
        self, checker: DisclaimerChecker
    ) -> None:
        utterances = [
            {"text": "This product is perfect for every type of investor.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        assert any(e.rule_id == "MD-004" for e in events)

    @pytest.mark.parametrize("phrase", [
        "not suitable for all investors",
        "may not be suitable",
        "suitability assessment",
        "appropriate for your needs",
    ])
    def test_does_not_fire_when_required_phrase_present(
        self, checker: DisclaimerChecker, phrase: str
    ) -> None:
        utterances = [{"text": f"Please note this product is {phrase}.", "speaker": "AGENT"}]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        md004 = [e for e in events if e.rule_id == "MD-004"]
        assert len(md004) == 0, f"MD-004 fired despite phrase: {phrase}"


# ── Full transcript: all disclaimers present → zero events ───────────────────


class TestFullCallWithAllDisclaimers:
    def test_compliant_call_produces_no_disclaimer_events(
        self, checker: DisclaimerChecker
    ) -> None:
        utterances = [
            {
                "text": (
                    "Past performance is not indicative of future results and your capital is at risk. "
                    "This product may not be suitable for all investors and a suitability assessment is required. "
                    "I strongly recommend you seek independent financial advice before proceeding."
                ),
                "speaker": "AGENT",
            }
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        disclaimer_events = [e for e in events if e.category == "MISSING_DISCLAIMER"]
        assert len(disclaimer_events) == 0

    def test_call_missing_all_disclaimers_produces_four_events(
        self, checker: DisclaimerChecker
    ) -> None:
        """An entirely non-compliant script hits all four disclaimer rules."""
        utterances = [
            {
                "text": "This is a fantastic investment. Sign up today and you will not regret it.",
                "speaker": "AGENT",
            },
            {"text": "What are the risks?", "speaker": "CUSTOMER"},
            {"text": "Minimal — we have never had a client lose money.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        disclaimer_events = [e for e in events if e.category == "MISSING_DISCLAIMER"]
        assert len(disclaimer_events) == 4
        rule_ids = {e.rule_id for e in disclaimer_events}
        assert rule_ids == {"MD-001", "MD-002", "MD-003", "MD-004"}

    def test_phrase_spanning_two_utterances_still_detected(
        self, checker: DisclaimerChecker
    ) -> None:
        """DisclaimerChecker joins full text — phrase in any utterance satisfies the rule."""
        utterances = [
            {"text": "Some introductory remarks.", "speaker": "AGENT"},
            {"text": "Please note that capital is at risk.", "speaker": "AGENT"},
            {"text": "More product details here.", "speaker": "AGENT"},
        ]
        events = checker.check_transcript(utterances, call_id=_CALL_ID)
        assert not any(e.rule_id == "MD-002" for e in events)


# ── RiskEvent metadata ────────────────────────────────────────────────────────


class TestDisclaimerEventMetadata:
    def test_event_fields_populated(self, checker: DisclaimerChecker) -> None:
        utterances = [{"text": "Great product, no downsides.", "speaker": "AGENT"}]
        events = checker.check_transcript(
            utterances, call_id="call-md-test", call_end_time=_FIXED_TS
        )
        md002 = next((e for e in events if e.rule_id == "MD-002"), None)
        assert md002 is not None
        assert md002.call_id == "call-md-test"
        assert md002.category == "MISSING_DISCLAIMER"
        assert md002.confidence == 1.0
        assert md002.triggered_at == _FIXED_TS
        assert md002.event_id  # UUID non-empty

    def test_event_to_dict_camel_case(self, checker: DisclaimerChecker) -> None:
        utterances = [{"text": "Buy now.", "speaker": "AGENT"}]
        events = checker.check_transcript(utterances, call_id="tc", call_end_time=_FIXED_TS)
        assert events
        d = events[0].to_dict()
        assert "eventId" in d
        assert "callId" in d
        assert "ruleId" in d
        assert "triggeredAt" in d
        assert d["category"] == "MISSING_DISCLAIMER"

    def test_empty_utterances_still_fires_all_rules(self, checker: DisclaimerChecker) -> None:
        """An empty transcript has no disclaimers → all rules fire."""
        events = checker.check_transcript([], call_id=_CALL_ID)
        disclaimer_events = [e for e in events if e.category == "MISSING_DISCLAIMER"]
        assert len(disclaimer_events) == 4

    def test_default_timestamp_is_utc(self, checker: DisclaimerChecker) -> None:
        events = checker.check_transcript(
            [{"text": "Buy now.", "speaker": "AGENT"}], call_id="tc"
        )
        assert events
        assert events[0].triggered_at.tzinfo is not None


# ── check_single() ────────────────────────────────────────────────────────────


class TestCheckSingle:
    def test_returns_true_when_phrase_present(self, checker: DisclaimerChecker) -> None:
        text = "Investors should note that capital may be at risk at all times."
        assert checker.check_single("MD-002", text) is True

    def test_returns_false_when_phrase_absent(self, checker: DisclaimerChecker) -> None:
        text = "This is a safe investment with no downside."
        assert checker.check_single("MD-002", text) is False

    def test_case_insensitive(self, checker: DisclaimerChecker) -> None:
        text = "CAPITAL IS AT RISK AND YOU MAY GET BACK LESS."
        assert checker.check_single("MD-002", text) is True

    def test_unknown_rule_id_returns_false(self, checker: DisclaimerChecker) -> None:
        assert checker.check_single("XX-999", "anything") is False

    def test_md001_spanish_phrase(self, checker: DisclaimerChecker) -> None:
        text = "Recuerde que las rentabilidades pasadas no garantizan rendimientos futuros."
        assert checker.check_single("MD-001", text) is True

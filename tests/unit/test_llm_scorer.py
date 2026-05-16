"""
Unit tests for LLMScorer.

All tests mock the Anthropic client — no live API calls are made.
Acceptance criteria:
  - Prompt is built with agent-only utterances, numbered, CUSTOMER lines omitted
  - Prompt substitutes {{TRANSCRIPT}} and {{RISK_EVENTS}} from the template
  - SHA-256 hashes are returned for both prompt and response
  - Valid JSON responses parse to (score, rationale)
  - Markdown-fenced JSON is stripped before parsing
  - Out-of-range score raises LLMScorerError
  - Malformed JSON raises LLMScorerError
  - _call_with_retry retries up to 3 times then raises LLMScorerError
  - Exponential backoff sleep is called between retries
  - score() returns a fully populated LLMScoreResult
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, call, patch

import pytest

from errors import LLMScorerError
from llm_scorer import LLMScorer, _sha256
from risk_types import LLMScoreResult, RiskEvent

_RULES_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "rules"
_PROMPTS_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "prompts"

_FAKE_API_KEY = "sk-ant-test-key"
_FAKE_MODEL = "claude-test-model"


def _make_scorer(mock_client: MagicMock) -> LLMScorer:
    with patch("llm_scorer.anthropic.Anthropic", return_value=mock_client):
        return LLMScorer(api_key=_FAKE_API_KEY, model=_FAKE_MODEL)


def _make_response(text: str) -> MagicMock:
    content_block = MagicMock()
    content_block.text = text
    msg = MagicMock()
    msg.content = [content_block]
    return msg


def _make_risk_event(rule_id: str = "PP-001", category: str = "PROHIBITED_PROMISE") -> RiskEvent:
    return RiskEvent(
        event_id="evt-001",
        call_id="call-001",
        rule_id=rule_id,
        category=category,
        utterance="guaranteed return",
        matched_phrase="guaranteed return",
        speaker="AGENT",
        confidence=1.0,
        triggered_at=datetime(2026, 5, 15, 9, 0, tzinfo=timezone.utc),
    )


# ── _sha256 helper ────────────────────────────────────────────────────────────


def test_sha256_returns_64_hex_chars() -> None:
    result = _sha256("hello world")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)


def test_sha256_is_deterministic() -> None:
    assert _sha256("same") == _sha256("same")


def test_sha256_differs_for_different_inputs() -> None:
    assert _sha256("a") != _sha256("b")


# ── LLMScorer construction ────────────────────────────────────────────────────


class TestConstruction:
    def test_loads_template_successfully(self) -> None:
        mock_client = MagicMock()
        scorer = _make_scorer(mock_client)
        assert "{{TRANSCRIPT}}" not in scorer._template  # placeholders are in the raw file
        # After stripping comment lines the template should still be non-empty
        assert len(scorer._template) > 100

    def test_raises_if_prompt_version_not_found(self) -> None:
        mock_client = MagicMock()
        with patch("llm_scorer.anthropic.Anthropic", return_value=mock_client):
            with pytest.raises(LLMScorerError, match="not found"):
                LLMScorer(api_key=_FAKE_API_KEY, model=_FAKE_MODEL, prompt_version="v99")

    def test_comment_lines_stripped_from_template(self) -> None:
        mock_client = MagicMock()
        scorer = _make_scorer(mock_client)
        for line in scorer._template.splitlines():
            assert not line.startswith("# "), f"Comment line leaked into template: {line!r}"


# ── _build_prompt ─────────────────────────────────────────────────────────────


class TestBuildPrompt:
    @pytest.fixture
    def scorer(self) -> LLMScorer:
        return _make_scorer(MagicMock())

    def test_agent_lines_numbered_sequentially(self, scorer: LLMScorer) -> None:
        utterances = [
            {"text": "Hello.", "speaker": "AGENT"},
            {"text": "I want a refund.", "speaker": "CUSTOMER"},
            {"text": "I understand.", "speaker": "AGENT"},
        ]
        prompt = scorer._build_prompt(utterances, [])
        assert "[1] Hello." in prompt
        assert "[2] I understand." in prompt

    def test_customer_lines_excluded(self, scorer: LLMScorer) -> None:
        utterances = [
            {"text": "Good product?", "speaker": "CUSTOMER"},
            {"text": "Absolutely.", "speaker": "AGENT"},
        ]
        prompt = scorer._build_prompt(utterances, [])
        assert "Good product?" not in prompt
        assert "Absolutely." in prompt

    def test_no_agent_utterances_shows_placeholder(self, scorer: LLMScorer) -> None:
        utterances = [{"text": "Just me.", "speaker": "CUSTOMER"}]
        prompt = scorer._build_prompt(utterances, [])
        assert "(no agent utterances)" in prompt

    def test_risk_events_formatted_in_prompt(self, scorer: LLMScorer) -> None:
        event = _make_risk_event()
        prompt = scorer._build_prompt([], [event])
        assert "PP-001" in prompt
        assert "PROHIBITED_PROMISE" in prompt
        assert "guaranteed return" in prompt
        assert "1.00" in prompt

    def test_no_risk_events_shows_placeholder(self, scorer: LLMScorer) -> None:
        prompt = scorer._build_prompt([], [])
        assert "(none detected" in prompt

    def test_transcript_placeholder_substituted(self, scorer: LLMScorer) -> None:
        prompt = scorer._build_prompt(
            [{"text": "Test utterance.", "speaker": "AGENT"}], []
        )
        assert "{{TRANSCRIPT}}" not in prompt

    def test_risk_events_placeholder_substituted(self, scorer: LLMScorer) -> None:
        prompt = scorer._build_prompt([], [_make_risk_event()])
        assert "{{RISK_EVENTS}}" not in prompt

    def test_supports_utterance_key_as_fallback(self, scorer: LLMScorer) -> None:
        utterances = [{"utterance": "Hi there.", "speaker": "AGENT"}]
        prompt = scorer._build_prompt(utterances, [])
        assert "Hi there." in prompt


# ── _parse_response ───────────────────────────────────────────────────────────


class TestParseResponse:
    @pytest.fixture
    def scorer(self) -> LLMScorer:
        return _make_scorer(MagicMock())

    def test_valid_json_returns_score_and_rationale(self, scorer: LLMScorer) -> None:
        raw = '{"score": 87, "rationale": "Multiple prohibited promises detected."}'
        score, rationale = scorer._parse_response(raw)
        assert score == 87
        assert rationale == "Multiple prohibited promises detected."

    def test_fenced_json_is_stripped(self, scorer: LLMScorer) -> None:
        raw = '```json\n{"score": 55, "rationale": "Moderate risk."}\n```'
        score, _ = scorer._parse_response(raw)
        assert score == 55

    def test_fenced_json_without_language_tag(self, scorer: LLMScorer) -> None:
        raw = '```\n{"score": 30, "rationale": "Low risk."}\n```'
        score, _ = scorer._parse_response(raw)
        assert score == 30

    def test_score_zero_is_valid(self, scorer: LLMScorer) -> None:
        raw = '{"score": 0, "rationale": "Clean call."}'
        score, _ = scorer._parse_response(raw)
        assert score == 0

    def test_score_100_is_valid(self, scorer: LLMScorer) -> None:
        raw = '{"score": 100, "rationale": "Maximum risk."}'
        score, _ = scorer._parse_response(raw)
        assert score == 100

    def test_score_above_100_raises(self, scorer: LLMScorer) -> None:
        raw = '{"score": 101, "rationale": "Impossible."}'
        with pytest.raises(LLMScorerError, match="outside 0"):
            scorer._parse_response(raw)

    def test_score_below_0_raises(self, scorer: LLMScorer) -> None:
        raw = '{"score": -1, "rationale": "Impossible."}'
        with pytest.raises(LLMScorerError, match="outside 0"):
            scorer._parse_response(raw)

    def test_missing_score_key_raises(self, scorer: LLMScorer) -> None:
        raw = '{"rationale": "Missing score."}'
        with pytest.raises(LLMScorerError):
            scorer._parse_response(raw)

    def test_malformed_json_raises(self, scorer: LLMScorer) -> None:
        raw = "this is not json"
        with pytest.raises(LLMScorerError, match="parse"):
            scorer._parse_response(raw)

    def test_missing_rationale_returns_empty_string(self, scorer: LLMScorer) -> None:
        raw = '{"score": 50}'
        _, rationale = scorer._parse_response(raw)
        assert rationale == ""


# ── _call_with_retry ─────────────────────────────────────────────────────────


class TestCallWithRetry:
    def test_succeeds_on_first_attempt(self) -> None:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_response('{"score": 70, "rationale": "ok"}')
        scorer = _make_scorer(mock_client)
        text, latency = scorer._call_with_retry("prompt")
        assert "score" in text
        assert latency >= 0
        assert mock_client.messages.create.call_count == 1

    def test_retries_on_transient_failure(self) -> None:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = [
            RuntimeError("transient"),
            _make_response('{"score": 60, "rationale": "ok"}'),
        ]
        scorer = _make_scorer(mock_client)
        with patch("llm_scorer.time.sleep"):
            text, _ = scorer._call_with_retry("prompt")
        assert mock_client.messages.create.call_count == 2
        assert "score" in text

    def test_sleeps_between_retries(self) -> None:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = [
            RuntimeError("fail1"),
            RuntimeError("fail2"),
            _make_response('{"score": 10, "rationale": "fine"}'),
        ]
        scorer = _make_scorer(mock_client)
        with patch("llm_scorer.time.sleep") as mock_sleep:
            scorer._call_with_retry("prompt")
        assert mock_sleep.call_count == 2
        # First sleep = 1.0s, second = 2.0s
        assert mock_sleep.call_args_list[0] == call(1.0)
        assert mock_sleep.call_args_list[1] == call(2.0)

    def test_raises_after_three_failures(self) -> None:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = RuntimeError("always fails")
        scorer = _make_scorer(mock_client)
        with patch("llm_scorer.time.sleep"):
            with pytest.raises(LLMScorerError, match="3 attempts"):
                scorer._call_with_retry("prompt")
        assert mock_client.messages.create.call_count == 3

    def test_llm_scorer_error_has_attempts_attribute(self) -> None:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = RuntimeError("fail")
        scorer = _make_scorer(mock_client)
        with patch("llm_scorer.time.sleep"):
            with pytest.raises(LLMScorerError) as exc_info:
                scorer._call_with_retry("prompt")
        assert exc_info.value.attempts == 3


# ── score() end-to-end ────────────────────────────────────────────────────────


class TestScore:
    def _score_with_response(self, raw_response: str) -> LLMScoreResult:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_response(raw_response)
        scorer = _make_scorer(mock_client)
        utterances = [{"text": "Your investment is guaranteed.", "speaker": "AGENT"}]
        return scorer.score(utterances=utterances, risk_events=[], call_id="call-999")

    def test_returns_llm_score_result(self) -> None:
        result = self._score_with_response('{"score": 75, "rationale": "High risk."}')
        assert isinstance(result, LLMScoreResult)

    def test_score_field_correct(self) -> None:
        result = self._score_with_response('{"score": 75, "rationale": "High risk."}')
        assert result.score == 75

    def test_rationale_field_correct(self) -> None:
        result = self._score_with_response('{"score": 75, "rationale": "High risk."}')
        assert result.rationale == "High risk."

    def test_model_field_set(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert result.model == _FAKE_MODEL

    def test_prompt_hash_is_sha256(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert len(result.prompt_hash) == 64
        assert all(c in "0123456789abcdef" for c in result.prompt_hash)

    def test_response_hash_is_sha256(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert len(result.response_hash) == 64

    def test_prompt_and_response_hashes_differ(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert result.prompt_hash != result.response_hash

    def test_latency_ms_is_non_negative(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert result.latency_ms >= 0

    def test_prompt_version_default(self) -> None:
        result = self._score_with_response('{"score": 50, "rationale": "ok"}')
        assert result.prompt_version == "v1"

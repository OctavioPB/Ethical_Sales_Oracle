"""
LLM risk scorer.

Sends the PII-redacted agent transcript and pre-detected risk events to the
Claude API and returns a 0–100 contextual risk score with a short rationale.

Compliance requirements (CLAUDE.md):
  - Every API call is logged by prompt hash + response hash (never raw content).
  - Max 3 retries, 10s timeout, exponential backoff between attempts.
  - Prompt template is versioned in prompts/risk_score_v{N}.md.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import anthropic

from errors import LLMScorerError
from risk_types import LLMScoreResult, RiskEvent

_PROMPTS_DIR = Path(__file__).parent / "prompts"
_COMMENT_PREFIX = "# "    # lines starting with this are stripped from the template
_MAX_RETRIES = 3
_TIMEOUT_S = 10.0
_BACKOFF_S = (1.0, 2.0)   # wait after attempt 0, wait after attempt 1


class LLMScorer:
    """
    Instantiate once per Airflow task. Template is loaded at construction;
    score() is pure inference with no I/O beyond the API call.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        prompt_version: str = "v1",
    ) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model
        self._prompt_version = prompt_version

        template_path = _PROMPTS_DIR / f"risk_score_{prompt_version}.md"
        if not template_path.exists():
            raise LLMScorerError(
                f"Prompt template not found: {template_path}. "
                f"Available versions: {list(_PROMPTS_DIR.glob('risk_score_*.md'))}"
            )
        raw = template_path.read_text(encoding="utf-8")
        # Strip comment lines (metadata not intended for the model)
        self._template = "\n".join(
            line for line in raw.splitlines() if not line.startswith(_COMMENT_PREFIX)
        ).strip()

    # ── Public API ────────────────────────────────────────────────────────────

    def score(
        self,
        utterances: list[dict[str, Any]],
        risk_events: list[RiskEvent],
        call_id: str,  # noqa: ARG002 — reserved for future per-call context injection
    ) -> LLMScoreResult:
        """
        Builds the prompt, calls Claude, and returns a structured LLMScoreResult.
        Raises LLMScorerError if all retries fail or the response cannot be parsed.
        """
        prompt = self._build_prompt(utterances, risk_events)
        prompt_hash = _sha256(prompt)

        raw_response, latency_ms = self._call_with_retry(prompt)
        response_hash = _sha256(raw_response)

        llm_score, rationale = self._parse_response(raw_response)

        return LLMScoreResult(
            score=llm_score,
            rationale=rationale,
            model=self._model,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            latency_ms=latency_ms,
            prompt_version=self._prompt_version,
        )

    # ── Internal ──────────────────────────────────────────────────────────────

    def _build_prompt(
        self,
        utterances: list[dict[str, Any]],
        risk_events: list[RiskEvent],
    ) -> str:
        agent_lines = [
            f"[{i + 1}] {str(u.get('text', u.get('utterance', ''))).strip()}"
            for i, u in enumerate(utterances)
            if str(u.get("speaker", "UNKNOWN")).upper() == "AGENT"
        ]
        transcript_block = "\n".join(agent_lines) if agent_lines else "(no agent utterances)"

        if risk_events:
            events_block = "\n".join(
                f'- [{e.rule_id}] {e.category}: "{e.matched_phrase}" '
                f"(confidence={e.confidence:.2f})"
                for e in risk_events
            )
        else:
            events_block = "(none detected by phrase-matching engine)"

        return (
            self._template
            .replace("{{TRANSCRIPT}}", transcript_block)
            .replace("{{RISK_EVENTS}}", events_block)
        )

    def _call_with_retry(self, prompt: str) -> tuple[str, int]:
        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                start = time.perf_counter()
                msg = self._client.messages.create(
                    model=self._model,
                    max_tokens=512,
                    timeout=_TIMEOUT_S,
                    messages=[{"role": "user", "content": prompt}],
                )
                latency_ms = int((time.perf_counter() - start) * 1_000)
                return msg.content[0].text, latency_ms
            except Exception as exc:
                last_exc = exc
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_BACKOFF_S[attempt] if attempt < len(_BACKOFF_S) else _BACKOFF_S[-1])

        raise LLMScorerError(
            f"LLM call failed after {_MAX_RETRIES} attempts: {last_exc}",
            attempts=_MAX_RETRIES,
        ) from last_exc

    def _parse_response(self, raw: str) -> tuple[int, str]:
        text = raw.strip()
        # Strip markdown code fences that some models wrap JSON in
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:])
            if text.endswith("```"):
                text = text[: text.rfind("```")]
            text = text.strip()
        try:
            data = json.loads(text)
            llm_score = int(data["score"])
            if not 0 <= llm_score <= 100:
                raise ValueError(f"score {llm_score} is outside 0–100")
            rationale = str(data.get("rationale", ""))
            return llm_score, rationale
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            raise LLMScorerError(
                f"Failed to parse LLM response as JSON with 'score' key: {exc}. "
                f"Raw response (first 200 chars): {raw[:200]}"
            ) from exc


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

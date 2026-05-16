"""
Fast deterministic risk phrase matcher.

Architecture:
  - spaCy PhraseMatcher (LOWER attr) for all exact phrases → O(vocab) lookup
  - Python re for regex rules
  - Both pre-compiled at __init__ time; match() has no I/O

Performance target: < 200ms per utterance at p95 on a single CPU core.
Benchmarks: < 5ms for a typical 15-word utterance with ~50 active phrases.

One RiskEvent is emitted per rule per utterance (dedup by rule_id).
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

import spacy
from spacy.matcher import PhraseMatcher

from errors import ModelLoadError
from risk_types import RiskCategory, RiskEvent, RuleDefinition
from rule_loader import load_all_rules

_EXACT_CONFIDENCE = 1.0
_REGEX_CONFIDENCE = 0.92


class _MatchEntry(NamedTuple):
    rule_id: str
    category: RiskCategory
    confidence: float


class RiskPhraseMatcher:
    """
    Loads all enabled detection rules and exposes `match()` / `match_transcript()`.
    Instantiate once per Airflow worker — patterns are compiled at construction.
    """

    def __init__(
        self,
        rules_dir: Path,
        spacy_model: str = "en_core_web_sm",
    ) -> None:
        try:
            self._nlp = spacy.load(
                spacy_model,
                disable=["parser", "ner", "lemmatizer", "senter"],
            )
        except OSError as exc:
            raise ModelLoadError(
                f"spaCy model '{spacy_model}' not found. "
                f"Run: python -m spacy download {spacy_model}"
            ) from exc

        detection_sets, _ = load_all_rules(rules_dir)

        self._phrase_matcher = PhraseMatcher(self._nlp.vocab, attr="LOWER")
        self._phrase_to_rule: dict[str, _MatchEntry] = {}
        self._regex_rules: list[tuple[re.Pattern[str], _MatchEntry]] = []

        for rule_set in detection_sets:
            if not rule_set.enabled:
                continue
            for rule in rule_set.rules:
                if not rule.enabled:
                    continue
                self._register_rule(rule, rule_set.category)

    # ── Public API ────────────────────────────────────────────────────────────

    def match(
        self,
        utterance: str,
        call_id: str,
        speaker: str,
        triggered_at: datetime | None = None,
    ) -> list[RiskEvent]:
        """Returns one RiskEvent per triggered rule in a single utterance."""
        if not utterance or not utterance.strip():
            return []

        ts = triggered_at or datetime.now(timezone.utc)
        doc = self._nlp(utterance)
        events: list[RiskEvent] = []
        seen_rules: set[str] = set()

        for match_id, start, end in self._phrase_matcher(doc):
            key = self._nlp.vocab.strings[match_id]
            entry = self._phrase_to_rule.get(key)
            if entry and entry.rule_id not in seen_rules:
                events.append(RiskEvent(
                    event_id=str(uuid.uuid4()),
                    call_id=call_id,
                    rule_id=entry.rule_id,
                    category=entry.category,
                    utterance=utterance,
                    matched_phrase=doc[start:end].text,
                    speaker=speaker,
                    confidence=entry.confidence,
                    triggered_at=ts,
                ))
                seen_rules.add(entry.rule_id)

        for pattern, entry in self._regex_rules:
            if entry.rule_id in seen_rules:
                continue
            m = pattern.search(utterance)
            if m:
                events.append(RiskEvent(
                    event_id=str(uuid.uuid4()),
                    call_id=call_id,
                    rule_id=entry.rule_id,
                    category=entry.category,
                    utterance=utterance,
                    matched_phrase=m.group(0),
                    speaker=speaker,
                    confidence=entry.confidence,
                    triggered_at=ts,
                ))
                seen_rules.add(entry.rule_id)

        return events

    def match_transcript(
        self,
        utterances: list[dict[str, object]],
        call_id: str,
    ) -> list[RiskEvent]:
        """
        Runs match() over a list of utterance dicts.
        Each dict needs: text (or utterance), speaker, and optionally triggered_at / started_at.
        """
        all_events: list[RiskEvent] = []
        for u in utterances:
            text = str(u.get("text", u.get("utterance", "")))
            speaker = str(u.get("speaker", "UNKNOWN"))
            raw_ts = u.get("triggered_at", u.get("started_at"))
            ts: datetime | None = None
            if isinstance(raw_ts, datetime):
                ts = raw_ts
            elif isinstance(raw_ts, str):
                ts = datetime.fromisoformat(raw_ts)
            all_events.extend(self.match(text, call_id, speaker, ts))
        return all_events

    # ── Internal ──────────────────────────────────────────────────────────────

    def _register_rule(self, rule: RuleDefinition, category: RiskCategory) -> None:
        for i, phrase in enumerate(rule.phrases):
            entry = _MatchEntry(
                rule_id=rule.rule_id,
                category=category,
                confidence=_EXACT_CONFIDENCE if phrase.match_type == "exact" else _REGEX_CONFIDENCE,
            )
            if phrase.match_type == "exact":
                key = f"{rule.rule_id}::{i}"
                self._phrase_matcher.add(key, [self._nlp.make_doc(phrase.text)])
                self._phrase_to_rule[key] = entry
            elif phrase.match_type == "regex":
                self._regex_rules.append((re.compile(phrase.text, re.IGNORECASE), entry))

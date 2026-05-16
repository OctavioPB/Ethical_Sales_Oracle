"""
Missing disclaimer detector.

For each DisclaimerRule, checks whether ANY required_phrase appears in the
full call transcript. If none appear → emit a MISSING_DISCLAIMER RiskEvent.

Runs once per call (after all utterances are available), not per utterance.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from risk_types import DisclaimerRuleDefinition, DisclaimerRuleSet, RiskEvent
from rule_loader import load_all_rules


class DisclaimerChecker:
    """
    Loads disclaimer rules once; check_transcript() is pure inference.
    Thread-safe after construction.
    """

    def __init__(self, rules_dir: Path) -> None:
        _, disclaimer_sets = load_all_rules(rules_dir)
        self._rule_sets: list[DisclaimerRuleSet] = disclaimer_sets

        self._compiled: dict[str, list[re.Pattern[str]]] = {}
        self._rule_meta: dict[str, DisclaimerRuleDefinition] = {}

        for ds in disclaimer_sets:
            if not ds.enabled:
                continue
            for rule in ds.rules:
                if not rule.enabled:
                    continue
                patterns: list[re.Pattern[str]] = []
                for phrase in rule.required_phrases:
                    if phrase.match_type == "exact":
                        patterns.append(re.compile(re.escape(phrase.text), re.IGNORECASE))
                    elif phrase.match_type == "regex":
                        patterns.append(re.compile(phrase.text, re.IGNORECASE))
                self._compiled[rule.rule_id] = patterns
                self._rule_meta[rule.rule_id] = rule

    def check_transcript(
        self,
        utterances: list[dict[str, Any]],
        call_id: str,
        call_end_time: datetime | None = None,
    ) -> list[RiskEvent]:
        """
        Returns one RiskEvent per disclaimer rule whose required phrases are
        entirely absent from the call transcript.
        """
        ts = call_end_time or datetime.now(timezone.utc)
        full_text = " ".join(
            str(u.get("text", u.get("utterance", ""))) for u in utterances
        )

        events: list[RiskEvent] = []
        for rule_id, patterns in self._compiled.items():
            rule = self._rule_meta[rule_id]
            if not rule.enabled:
                continue
            if not any(p.search(full_text) for p in patterns):
                events.append(RiskEvent(
                    event_id=str(uuid.uuid4()),
                    call_id=call_id,
                    rule_id=rule_id,
                    category="MISSING_DISCLAIMER",
                    utterance="",
                    matched_phrase="",
                    speaker="AGENT",
                    confidence=1.0,
                    triggered_at=ts,
                ))
        return events

    def check_single(self, rule_id: str, full_call_text: str) -> bool:
        """True if the disclaimer for rule_id IS satisfied (phrase found)."""
        return any(p.search(full_call_text) for p in self._compiled.get(rule_id, []))

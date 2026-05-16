"""
Loads and validates rule YAML files from the rules/ directory.

Validation enforced at load time:
  - rule_id matches pattern [A-Z]{2}-\d{3}
  - rule_id is unique across all loaded files
  - Each rule has >= 3 positive and >= 2 negative test fixtures
  - match_type is "exact" or "regex"
  - severity is "HIGH" or "CRITICAL"
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from errors import NLPEngineError
from risk_types import (
    DisclaimerRuleDefinition,
    DisclaimerRuleSet,
    PhrasePattern,
    RuleDefinition,
    RuleFixtures,
    RuleSet,
)

_RULE_ID_RE = re.compile(r"^[A-Z]{2}-\d{3}$")
_VALID_MATCH_TYPES = {"exact", "regex"}
_VALID_SEVERITIES = {"HIGH", "CRITICAL"}

_DETECTION_FILES = ["prohibited_promises.yaml", "pressure_tactics.yaml"]
_DISCLAIMER_FILES = ["missing_disclaimers.yaml"]


class RuleLoadError(NLPEngineError):
    def __init__(self, message: str, file: str = "", rule_id: str = "") -> None:
        super().__init__(message)
        self.file = file
        self.rule_id = rule_id


def load_all_rules(
    rules_dir: Path,
) -> tuple[list[RuleSet], list[DisclaimerRuleSet]]:
    """
    Loads all rule files and returns validated rule sets.
    Raises RuleLoadError on any schema violation.
    """
    seen_ids: set[str] = set()
    detection_sets: list[RuleSet] = []
    disclaimer_sets: list[DisclaimerRuleSet] = []

    for fname in _DETECTION_FILES:
        path = rules_dir / fname
        if not path.exists():
            continue
        raw = _read_yaml(path)
        rule_set = _parse_detection_rule_set(raw, fname, seen_ids)
        if rule_set.enabled:
            detection_sets.append(rule_set)

    for fname in _DISCLAIMER_FILES:
        path = rules_dir / fname
        if not path.exists():
            continue
        raw = _read_yaml(path)
        disc_set = _parse_disclaimer_rule_set(raw, fname, seen_ids)
        if disc_set.enabled:
            disclaimer_sets.append(disc_set)

    return detection_sets, disclaimer_sets


def extract_fixtures(rules_dir: Path) -> dict[str, dict[str, list[str]]]:
    """
    Returns {rule_id: {positive: [...], negative: [...], category: str}}
    for all rules. Used by test_rule_fixtures.py to auto-generate test cases.
    """
    detection_sets, disclaimer_sets = load_all_rules(rules_dir)
    result: dict[str, dict[str, list[str]]] = {}

    for rs in detection_sets:
        for rule in rs.rules:
            result[rule.rule_id] = {
                "positive": rule.fixtures.positive,
                "negative": rule.fixtures.negative,
                "category": rs.category,
            }

    for ds in disclaimer_sets:
        for rule in ds.rules:
            result[rule.rule_id] = {
                "positive": rule.fixtures.positive,
                "negative": rule.fixtures.negative,
                "category": ds.category,
            }

    return result


# ── Internal parsers ──────────────────────────────────────────────────────────


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise RuleLoadError("Expected a YAML mapping at root", file=path.name)
        return data
    except yaml.YAMLError as exc:
        raise RuleLoadError(f"YAML parse error: {exc}", file=path.name) from exc


def _parse_detection_rule_set(
    data: dict[str, Any], fname: str, seen_ids: set[str]
) -> RuleSet:
    rules = [_parse_rule(r, fname, seen_ids) for r in data.get("rules", [])]
    return RuleSet(
        schema_version=str(data.get("schema_version", "1.0.0")),
        category=data["category"],
        sector=data.get("sector", "all"),
        jurisdiction=data.get("jurisdiction", "all"),
        enabled=bool(data.get("enabled", True)),
        rules=rules,
    )


def _parse_disclaimer_rule_set(
    data: dict[str, Any], fname: str, seen_ids: set[str]
) -> DisclaimerRuleSet:
    rules = [_parse_disclaimer_rule(r, fname, seen_ids) for r in data.get("rules", [])]
    return DisclaimerRuleSet(
        schema_version=str(data.get("schema_version", "1.0.0")),
        category="MISSING_DISCLAIMER",
        sector=data.get("sector", "all"),
        jurisdiction=data.get("jurisdiction", "all"),
        enabled=bool(data.get("enabled", True)),
        rules=rules,
    )


def _parse_rule(raw: dict[str, Any], fname: str, seen_ids: set[str]) -> RuleDefinition:
    rule_id = str(raw.get("rule_id", ""))
    _validate_rule_id(rule_id, fname, seen_ids)
    severity = str(raw.get("severity", ""))
    if severity not in _VALID_SEVERITIES:
        raise RuleLoadError(f"Invalid severity '{severity}'", file=fname, rule_id=rule_id)
    phrases = [_parse_phrase(p, fname, rule_id) for p in raw.get("phrases", [])]
    fixtures = _parse_fixtures(raw.get("test_fixtures", {}), fname, rule_id)
    return RuleDefinition(
        rule_id=rule_id,
        description=str(raw.get("description", "")).strip(),
        severity=severity,
        enabled=bool(raw.get("enabled", True)),
        phrases=phrases,
        fixtures=fixtures,
    )


def _parse_disclaimer_rule(
    raw: dict[str, Any], fname: str, seen_ids: set[str]
) -> DisclaimerRuleDefinition:
    rule_id = str(raw.get("rule_id", ""))
    _validate_rule_id(rule_id, fname, seen_ids)
    severity = str(raw.get("severity", ""))
    if severity not in _VALID_SEVERITIES:
        raise RuleLoadError(f"Invalid severity '{severity}'", file=fname, rule_id=rule_id)
    required = [_parse_phrase(p, fname, rule_id) for p in raw.get("required_phrases", [])]
    fixtures = _parse_fixtures(raw.get("test_fixtures", {}), fname, rule_id)
    return DisclaimerRuleDefinition(
        rule_id=rule_id,
        description=str(raw.get("description", "")).strip(),
        severity=severity,
        enabled=bool(raw.get("enabled", True)),
        required_phrases=required,
        fixtures=fixtures,
    )


def _parse_phrase(raw: Any, fname: str, rule_id: str) -> PhrasePattern:
    if isinstance(raw, str):
        return PhrasePattern(text=raw)
    if not isinstance(raw, dict):
        raise RuleLoadError("Each phrase must be a string or mapping", file=fname, rule_id=rule_id)
    match_type = str(raw.get("match_type", "exact"))
    if match_type not in _VALID_MATCH_TYPES:
        raise RuleLoadError(
            f"Invalid match_type '{match_type}'", file=fname, rule_id=rule_id
        )
    return PhrasePattern(
        text=str(raw["text"]),
        match_type=match_type,
        languages=list(raw.get("languages", ["en", "es"])),
    )


def _parse_fixtures(raw: dict[str, Any], fname: str, rule_id: str) -> RuleFixtures:
    positive = list(raw.get("positive", []))
    negative = list(raw.get("negative", []))
    if len(positive) < 3:
        raise RuleLoadError(
            f"Rule {rule_id} has {len(positive)} positive fixtures — minimum is 3",
            file=fname, rule_id=rule_id,
        )
    if len(negative) < 2:
        raise RuleLoadError(
            f"Rule {rule_id} has {len(negative)} negative fixtures — minimum is 2",
            file=fname, rule_id=rule_id,
        )
    return RuleFixtures(positive=positive, negative=negative)


def _validate_rule_id(rule_id: str, fname: str, seen_ids: set[str]) -> None:
    if not _RULE_ID_RE.match(rule_id):
        raise RuleLoadError(
            f"Invalid rule_id '{rule_id}' — must match [A-Z]{{2}}-\\d{{3}}",
            file=fname, rule_id=rule_id,
        )
    if rule_id in seen_ids:
        raise RuleLoadError(
            f"Duplicate rule_id '{rule_id}'", file=fname, rule_id=rule_id
        )
    seen_ids.add(rule_id)

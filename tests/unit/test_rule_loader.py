"""
Unit tests for rule_loader.

Acceptance criteria verified here:
  - All rule files load without error
  - Each rule ID matches [A-Z]{2}-\\d{3} and is unique across all files
  - Every rule has >= 3 positive and >= 2 negative fixtures
  - Disabled rule sets are excluded from the returned lists
  - Malformed YAML raises RuleLoadError with descriptive messages
  - extract_fixtures() returns a dict covering every loaded rule
  - All expected rule IDs are present (PP-001..PP-004, PT-001..PT-004, MD-001..MD-004)
"""

from __future__ import annotations

import re
import textwrap
from pathlib import Path

import pytest
import yaml

from rule_loader import RuleLoadError, extract_fixtures, load_all_rules
from risk_types import DisclaimerRuleSet, RuleSet

_RULES_DIR = Path(__file__).parent.parent.parent / "services" / "nlp-engine" / "rules"

_EXPECTED_DETECTION_IDS = {
    "PP-001", "PP-002", "PP-003", "PP-004",
    "PT-001", "PT-002", "PT-003", "PT-004",
}
_EXPECTED_DISCLAIMER_IDS = {"MD-001", "MD-002", "MD-003", "MD-004"}
_RULE_ID_RE = re.compile(r"^[A-Z]{2}-\d{3}$")


# ── Happy-path: production rule files ────────────────────────────────────────


class TestLoadProductionRules:
    @pytest.fixture(scope="class")
    def loaded(self) -> tuple[list[RuleSet], list[DisclaimerRuleSet]]:
        return load_all_rules(_RULES_DIR)

    def test_returns_two_detection_rule_sets(self, loaded: tuple) -> None:
        detection_sets, _ = loaded
        assert len(detection_sets) == 2  # prohibited_promises + pressure_tactics

    def test_returns_one_disclaimer_rule_set(self, loaded: tuple) -> None:
        _, disclaimer_sets = loaded
        assert len(disclaimer_sets) == 1  # missing_disclaimers

    def test_all_expected_detection_rule_ids_present(self, loaded: tuple) -> None:
        detection_sets, _ = loaded
        found_ids = {r.rule_id for rs in detection_sets for r in rs.rules}
        assert _EXPECTED_DETECTION_IDS.issubset(found_ids)

    def test_all_expected_disclaimer_rule_ids_present(self, loaded: tuple) -> None:
        _, disclaimer_sets = loaded
        found_ids = {r.rule_id for ds in disclaimer_sets for r in ds.rules}
        assert _EXPECTED_DISCLAIMER_IDS.issubset(found_ids)

    def test_all_rule_ids_match_pattern(self, loaded: tuple) -> None:
        detection_sets, disclaimer_sets = loaded
        all_ids = (
            [r.rule_id for rs in detection_sets for r in rs.rules]
            + [r.rule_id for ds in disclaimer_sets for r in ds.rules]
        )
        for rule_id in all_ids:
            assert _RULE_ID_RE.match(rule_id), f"Rule ID '{rule_id}' violates naming convention"

    def test_all_rule_ids_are_globally_unique(self, loaded: tuple) -> None:
        detection_sets, disclaimer_sets = loaded
        all_ids = (
            [r.rule_id for rs in detection_sets for r in rs.rules]
            + [r.rule_id for ds in disclaimer_sets for r in ds.rules]
        )
        assert len(all_ids) == len(set(all_ids)), "Duplicate rule IDs found"

    def test_every_rule_has_required_fixture_counts(self, loaded: tuple) -> None:
        detection_sets, disclaimer_sets = loaded
        for rs in detection_sets:
            for rule in rs.rules:
                assert len(rule.fixtures.positive) >= 3, (
                    f"{rule.rule_id} has fewer than 3 positive fixtures"
                )
                assert len(rule.fixtures.negative) >= 2, (
                    f"{rule.rule_id} has fewer than 2 negative fixtures"
                )
        for ds in disclaimer_sets:
            for rule in ds.rules:
                assert len(rule.fixtures.positive) >= 3, (
                    f"{rule.rule_id} has fewer than 3 positive fixtures"
                )
                assert len(rule.fixtures.negative) >= 2, (
                    f"{rule.rule_id} has fewer than 2 negative fixtures"
                )

    def test_all_detection_rules_have_at_least_one_phrase(self, loaded: tuple) -> None:
        detection_sets, _ = loaded
        for rs in detection_sets:
            for rule in rs.rules:
                assert len(rule.phrases) >= 1, f"{rule.rule_id} has no phrases"

    def test_all_disclaimer_rules_have_at_least_one_required_phrase(self, loaded: tuple) -> None:
        _, disclaimer_sets = loaded
        for ds in disclaimer_sets:
            for rule in ds.rules:
                assert len(rule.required_phrases) >= 1, (
                    f"{rule.rule_id} has no required_phrases"
                )

    def test_all_rules_are_enabled_by_default(self, loaded: tuple) -> None:
        detection_sets, disclaimer_sets = loaded
        for rs in detection_sets:
            assert rs.enabled
            for rule in rs.rules:
                assert rule.enabled
        for ds in disclaimer_sets:
            assert ds.enabled
            for rule in ds.rules:
                assert rule.enabled

    def test_detection_categories_are_valid(self, loaded: tuple) -> None:
        valid = {"PROHIBITED_PROMISE", "PRESSURE_TACTIC"}
        detection_sets, _ = loaded
        for rs in detection_sets:
            assert rs.category in valid, f"Unexpected category: {rs.category}"

    def test_disclaimer_category(self, loaded: tuple) -> None:
        _, disclaimer_sets = loaded
        for ds in disclaimer_sets:
            assert ds.category == "MISSING_DISCLAIMER"

    def test_match_types_are_valid(self, loaded: tuple) -> None:
        valid = {"exact", "regex"}
        detection_sets, disclaimer_sets = loaded
        for rs in detection_sets:
            for rule in rs.rules:
                for phrase in rule.phrases:
                    assert phrase.match_type in valid

    def test_phrase_text_is_non_empty(self, loaded: tuple) -> None:
        detection_sets, disclaimer_sets = loaded
        for rs in detection_sets:
            for rule in rs.rules:
                for phrase in rule.phrases:
                    assert phrase.text.strip(), f"{rule.rule_id} has an empty phrase"


# ── extract_fixtures() ────────────────────────────────────────────────────────


class TestExtractFixtures:
    @pytest.fixture(scope="class")
    def fixtures(self) -> dict:
        return extract_fixtures(_RULES_DIR)

    def test_returns_all_rule_ids(self, fixtures: dict) -> None:
        expected = _EXPECTED_DETECTION_IDS | _EXPECTED_DISCLAIMER_IDS
        assert expected.issubset(fixtures.keys())

    def test_each_entry_has_positive_and_negative_lists(self, fixtures: dict) -> None:
        for rule_id, data in fixtures.items():
            assert "positive" in data, f"{rule_id} missing 'positive'"
            assert "negative" in data, f"{rule_id} missing 'negative'"
            assert isinstance(data["positive"], list)
            assert isinstance(data["negative"], list)

    def test_each_entry_has_category(self, fixtures: dict) -> None:
        for rule_id, data in fixtures.items():
            assert "category" in data, f"{rule_id} missing 'category'"
            assert data["category"]

    def test_positive_list_non_empty(self, fixtures: dict) -> None:
        for rule_id, data in fixtures.items():
            assert data["positive"], f"{rule_id} has empty positive fixtures"

    def test_negative_list_non_empty(self, fixtures: dict) -> None:
        for rule_id, data in fixtures.items():
            assert data["negative"], f"{rule_id} has empty negative fixtures"


# ── Validation error cases (in-memory YAML) ──────────────────────────────────


@pytest.fixture()
def tmp_rules_dir(tmp_path: Path) -> Path:
    return tmp_path


def _write_rule_file(rules_dir: Path, name: str, content: str) -> None:
    (rules_dir / name).write_text(textwrap.dedent(content), encoding="utf-8")


class TestValidationErrors:
    def test_invalid_rule_id_pattern_raises(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: BAD-ID
                description: Bad
                severity: HIGH
                enabled: true
                phrases:
                  - text: "bad phrase"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """)
        with pytest.raises(RuleLoadError, match="Invalid rule_id"):
            load_all_rules(tmp_rules_dir)

    def test_duplicate_rule_id_raises(self, tmp_rules_dir: Path) -> None:
        rule_block = """\
              - rule_id: PP-001
                description: Dup
                severity: HIGH
                enabled: true
                phrases:
                  - text: "phrase one"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", f"""\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
            {rule_block}
            {rule_block}
        """)
        with pytest.raises(RuleLoadError, match="Duplicate rule_id"):
            load_all_rules(tmp_rules_dir)

    def test_too_few_positive_fixtures_raises(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: PP-001
                description: Test
                severity: HIGH
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: exact
                test_fixtures:
                  positive: ["only one"]
                  negative: ["neg one", "neg two"]
        """)
        with pytest.raises(RuleLoadError, match="positive fixtures"):
            load_all_rules(tmp_rules_dir)

    def test_too_few_negative_fixtures_raises(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: PP-001
                description: Test
                severity: HIGH
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["only one"]
        """)
        with pytest.raises(RuleLoadError, match="negative fixtures"):
            load_all_rules(tmp_rules_dir)

    def test_invalid_severity_raises(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: PP-001
                description: Test
                severity: MEDIUM
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """)
        with pytest.raises(RuleLoadError, match="Invalid severity"):
            load_all_rules(tmp_rules_dir)

    def test_invalid_match_type_raises(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: PP-001
                description: Test
                severity: HIGH
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: fuzzy
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """)
        with pytest.raises(RuleLoadError, match="Invalid match_type"):
            load_all_rules(tmp_rules_dir)

    def test_missing_file_is_silently_skipped(self, tmp_rules_dir: Path) -> None:
        """Missing rule files do not raise — rules dir may not have all files yet."""
        detection_sets, disclaimer_sets = load_all_rules(tmp_rules_dir)
        assert detection_sets == []
        assert disclaimer_sets == []

    def test_malformed_yaml_raises(self, tmp_rules_dir: Path) -> None:
        (tmp_rules_dir / "prohibited_promises.yaml").write_text(
            "rules: [\n  - {\n  bad yaml here",
            encoding="utf-8",
        )
        with pytest.raises(RuleLoadError, match="YAML parse error"):
            load_all_rules(tmp_rules_dir)

    def test_disabled_rule_set_excluded(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: false
            rules:
              - rule_id: PP-001
                description: Disabled rule set
                severity: HIGH
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """)
        detection_sets, _ = load_all_rules(tmp_rules_dir)
        assert len(detection_sets) == 0

    def test_valid_minimal_rule_set_loads_cleanly(self, tmp_rules_dir: Path) -> None:
        _write_rule_file(tmp_rules_dir, "prohibited_promises.yaml", """\
            schema_version: "1.0.0"
            category: PROHIBITED_PROMISE
            enabled: true
            rules:
              - rule_id: PP-001
                description: Valid minimal rule
                severity: HIGH
                enabled: true
                phrases:
                  - text: "guaranteed return"
                    match_type: exact
                test_fixtures:
                  positive: ["a", "b", "c"]
                  negative: ["x", "y"]
        """)
        detection_sets, _ = load_all_rules(tmp_rules_dir)
        assert len(detection_sets) == 1
        assert detection_sets[0].rules[0].rule_id == "PP-001"

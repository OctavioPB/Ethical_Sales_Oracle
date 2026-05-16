"""
Unit tests for PII redaction.

Uses `en_core_web_sm` (small model, fast, sufficient for NER tests in CI).
Install before running: python -m spacy download en_core_web_sm
"""

from __future__ import annotations

import pytest

from pii_redactor import PiiRedactor


@pytest.fixture(scope="module")
def redactor() -> PiiRedactor:
    return PiiRedactor(spacy_model="en_core_web_sm")


# ── PERSON name redaction ────────────────────────────────────────────────────


class TestPersonNameRedaction:
    def test_redacts_full_name_in_sentence(self, redactor: PiiRedactor) -> None:
        text = "Hello, my name is John Smith and I'd like to discuss your product."
        result, was_redacted = redactor.redact(text)
        assert "John Smith" not in result
        assert "[NAME]" in result
        assert was_redacted

    def test_redacts_name_at_sentence_start(self, redactor: PiiRedactor) -> None:
        text = "Maria García is calling from Madrid."
        result, was_redacted = redactor.redact(text)
        assert "Maria García" not in result
        assert was_redacted

    def test_preserves_product_and_regulatory_terms(self, redactor: PiiRedactor) -> None:
        text = "MiFID II requires a suitability assessment before any investment."
        result, _ = redactor.redact(text)
        assert "MiFID II" in result

    def test_no_redaction_when_no_pii(self, redactor: PiiRedactor) -> None:
        text = "The guaranteed return policy is prohibited under FTC regulations."
        result, was_redacted = redactor.redact(text)
        assert result == text
        assert not was_redacted

    def test_empty_string_returns_unchanged(self, redactor: PiiRedactor) -> None:
        result, was_redacted = redactor.redact("")
        assert result == ""
        assert not was_redacted

    def test_whitespace_only_returns_unchanged(self, redactor: PiiRedactor) -> None:
        result, was_redacted = redactor.redact("   ")
        assert result == "   "
        assert not was_redacted

    def test_multiple_names_in_one_utterance(self, redactor: PiiRedactor) -> None:
        text = "I'm transferring you from Alice Brown to David Patel right now."
        result, was_redacted = redactor.redact(text)
        assert "Alice Brown" not in result
        assert "David Patel" not in result
        assert was_redacted


# ── Phone number redaction ───────────────────────────────────────────────────


class TestPhoneRedaction:
    def test_redacts_us_format_dashes(self, redactor: PiiRedactor) -> None:
        text = "You can reach me at 555-867-5309."
        result, was_redacted = redactor.redact(text)
        assert "555-867-5309" not in result
        assert "[PHONE]" in result
        assert was_redacted

    def test_redacts_us_format_dots(self, redactor: PiiRedactor) -> None:
        text = "Call me on 212.555.0192 any time."
        result, was_redacted = redactor.redact(text)
        assert "212.555.0192" not in result
        assert was_redacted

    def test_redacts_international_format(self, redactor: PiiRedactor) -> None:
        text = "My number is +44 20 7946 0958."
        result, was_redacted = redactor.redact(text)
        assert "+44 20 7946 0958" not in result
        assert was_redacted

    def test_redacts_spanish_mobile(self, redactor: PiiRedactor) -> None:
        text = "Llámame al 612 345 678."
        result, was_redacted = redactor.redact(text)
        assert "612 345 678" not in result
        assert was_redacted


# ── Account / card number redaction ─────────────────────────────────────────


class TestAccountNumberRedaction:
    def test_redacts_8_digit_account(self, redactor: PiiRedactor) -> None:
        text = "Your account number is 12345678."
        result, was_redacted = redactor.redact(text)
        assert "12345678" not in result
        assert "[ACCOUNT]" in result
        assert was_redacted

    def test_redacts_16_digit_card_number(self, redactor: PiiRedactor) -> None:
        text = "The card ending in 4539578763621486 was declined."
        result, was_redacted = redactor.redact(text)
        assert "4539578763621486" not in result
        assert was_redacted

    def test_does_not_redact_short_numbers(self, redactor: PiiRedactor) -> None:
        text = "The interest rate is 3.75 percent with a 5 year term."
        result, was_redacted = redactor.redact(text)
        # Short numbers like "3.75" and "5" should not be flagged
        assert "3" in result
        assert "5" in result

    def test_does_not_redact_year(self, redactor: PiiRedactor) -> None:
        text = "The contract was signed in 2024."
        result, _ = redactor.redact(text)
        assert "2024" in result


# ── IBAN redaction ───────────────────────────────────────────────────────────


class TestIBANRedaction:
    def test_redacts_uk_iban(self, redactor: PiiRedactor) -> None:
        text = "Please transfer to GB82WEST12345698765432."
        result, was_redacted = redactor.redact(text)
        assert "GB82WEST12345698765432" not in result
        assert "[IBAN]" in result
        assert was_redacted

    def test_redacts_spanish_iban(self, redactor: PiiRedactor) -> None:
        text = "Mi IBAN es ES9121000418450200051332."
        result, was_redacted = redactor.redact(text)
        assert "ES9121000418450200051332" not in result
        assert was_redacted


# ── Return type contract ─────────────────────────────────────────────────────


class TestReturnTypeContract:
    def test_returns_tuple_of_str_and_bool(self, redactor: PiiRedactor) -> None:
        result = redactor.redact("Some text")
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], bool)

    def test_was_redacted_false_when_no_pii(self, redactor: PiiRedactor) -> None:
        _, was_redacted = redactor.redact("This product has a guaranteed return.")
        assert not was_redacted

    def test_was_redacted_true_when_pii_present(self, redactor: PiiRedactor) -> None:
        _, was_redacted = redactor.redact("Call 555-123-4567 for details.")
        assert was_redacted

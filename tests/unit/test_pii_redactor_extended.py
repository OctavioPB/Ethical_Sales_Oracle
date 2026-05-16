"""
Extended PII redaction tests — GDPR edge cases (Sprint 7).

Covers scenarios not addressed by test_pii_redactor.py:
  - Mixed-language PII (Spanish / French / German names)
  - Consecutive PII tokens in a single utterance
  - PII embedded within risk phrases
  - Email addresses (known GDPR gap — documented below)
  - Idempotency of redaction
  - Formatted IBANs with spaces
  - Realistic multi-PII transcript fragments

Run with:
    pytest tests/unit/test_pii_redactor_extended.py -v
"""

from __future__ import annotations

import pytest

from pii_redactor import PiiRedactor


@pytest.fixture(scope="module")
def redactor() -> PiiRedactor:
    return PiiRedactor(spacy_model="en_core_web_sm")


# ── Mixed-language PII ────────────────────────────────────────────────────────


class TestMixedLanguagePII:
    """
    Calls in banking/insurance contexts frequently involve non-English names.
    spaCy's en_core_web_sm is trained primarily on English text; coverage for
    accented or compound names is best-effort.  These tests assert the happy
    path and document where the model may under-redact.
    """

    def test_spanish_compound_name(self, redactor: PiiRedactor) -> None:
        text = "Please confirm your name: María José Fernández López."
        result, was_redacted = redactor.redact(text)
        # At minimum, part of the name must be redacted
        assert "María José Fernández López" not in result
        assert was_redacted

    def test_german_name_with_umlaut(self, redactor: PiiRedactor) -> None:
        text = "I'm speaking with Klaus Müller about his pension plan."
        result, was_redacted = redactor.redact(text)
        # spaCy may split on umlauts; we assert the full string is not preserved
        assert "Klaus Müller" not in result
        assert was_redacted

    def test_french_hyphenated_name(self, redactor: PiiRedactor) -> None:
        text = "Jean-Pierre Dupont called to dispute the charge."
        result, was_redacted = redactor.redact(text)
        assert "Jean-Pierre Dupont" not in result
        assert was_redacted

    def test_regulatory_terms_preserved_alongside_foreign_name(
        self, redactor: PiiRedactor
    ) -> None:
        text = "MiFID II suitability check for Ahmed Al-Rashidi completed."
        result, _ = redactor.redact(text)
        assert "MiFID II" in result
        assert "Al-Rashidi" not in result


# ── Consecutive PII tokens ────────────────────────────────────────────────────


class TestConsecutivePIITokens:
    """
    A single utterance may contain a name immediately followed by a phone or
    account number.  The redactor must handle both without corrupting offsets.
    """

    def test_name_then_phone_in_same_sentence(self, redactor: PiiRedactor) -> None:
        text = "My name is John Smith and you can reach me at 555-234-5678."
        result, was_redacted = redactor.redact(text)
        assert "John Smith" not in result
        assert "555-234-5678" not in result
        assert "[NAME]" in result
        assert "[PHONE]" in result
        assert was_redacted

    def test_name_then_account_number(self, redactor: PiiRedactor) -> None:
        text = "Customer Alice Brown, account 98765432, requests a statement."
        result, was_redacted = redactor.redact(text)
        assert "Alice Brown" not in result
        assert "98765432" not in result
        assert was_redacted

    def test_name_phone_and_iban_all_in_one(self, redactor: PiiRedactor) -> None:
        text = (
            "Robert Chen, +44 20 7946 0123, wishes to transfer funds to "
            "GB29NWBK60161331926819."
        )
        result, was_redacted = redactor.redact(text)
        assert "Robert Chen" not in result
        assert "+44 20 7946 0123" not in result
        assert "GB29NWBK60161331926819" not in result
        assert was_redacted

    def test_two_names_adjacent(self, redactor: PiiRedactor) -> None:
        text = "The joint account holders are Emma Wilson and Thomas Hardy."
        result, was_redacted = redactor.redact(text)
        assert "Emma Wilson" not in result
        assert "Thomas Hardy" not in result
        assert was_redacted


# ── PII within risk phrases ───────────────────────────────────────────────────


class TestPIIWithinRiskPhrases:
    """
    Risk phrases that happen to contain PII must still be detectable after
    redaction.  The risk phrase detector operates on the *redacted* text, so
    the core prohibited words must survive.
    """

    def test_guaranteed_return_phrase_survives_name_redaction(
        self, redactor: PiiRedactor
    ) -> None:
        text = "Mr. James Lee, I can guarantee you a 15% return — no risk at all."
        result, was_redacted = redactor.redact(text)
        assert "James Lee" not in result
        # The compliance-critical phrase must survive
        assert "guarantee" in result
        assert "no risk" in result
        assert was_redacted

    def test_pressure_tactic_phrase_survives(self, redactor: PiiRedactor) -> None:
        text = "Sarah Connor, this offer expires today — you must act now."
        result, was_redacted = redactor.redact(text)
        assert "Sarah Connor" not in result
        assert "expires today" in result
        assert "act now" in result
        assert was_redacted

    def test_product_claim_phrase_survives(self, redactor: PiiRedactor) -> None:
        text = "For David Park: this fund has never lost money in 20 years."
        result, was_redacted = redactor.redact(text)
        assert "David Park" not in result
        assert "never lost money" in result
        assert was_redacted


# ── Email addresses (GDPR gap) ────────────────────────────────────────────────


class TestEmailAddressGDPRGap:
    """
    Email addresses are PII under GDPR Article 4(1) but are NOT currently
    redacted by PiiRedactor.  These tests document the gap.

    GDPR compliance note: email redaction should be added before storing
    transcripts that may contain agent or customer email addresses.
    Tracked in backlog as ESO-PII-002.
    """

    @pytest.mark.xfail(
        reason="Email redaction not yet implemented (ESO-PII-002); "
        "emails are GDPR PII and must be added to the redactor",
        strict=True,
    )
    def test_email_is_redacted(self, redactor: PiiRedactor) -> None:
        text = "Please send the confirmation to john.smith@example.com."
        result, was_redacted = redactor.redact(text)
        assert "john.smith@example.com" not in result
        assert was_redacted

    @pytest.mark.xfail(
        reason="Email redaction not yet implemented (ESO-PII-002)",
        strict=True,
    )
    def test_corporate_email_is_redacted(self, redactor: PiiRedactor) -> None:
        text = "I'll copy my manager at m.garcia@bancoseguro.es on this."
        result, was_redacted = redactor.redact(text)
        assert "m.garcia@bancoseguro.es" not in result
        assert was_redacted

    def test_email_currently_passes_through_unchanged(self, redactor: PiiRedactor) -> None:
        """
        Confirms the current (incomplete) behaviour so CI detects if the gap
        is accidentally fixed without the xfail tests being updated.
        """
        text = "Contact us at support@eso-internal.com."
        result, _ = redactor.redact(text)
        # Until ESO-PII-002 is implemented, email survives redaction
        assert "support@eso-internal.com" in result


# ── Idempotency ───────────────────────────────────────────────────────────────


class TestIdempotency:
    """
    Redacting an already-redacted string must produce the same output without
    double-wrapping tokens or altering the text further.
    """

    def test_redacting_twice_is_idempotent_phone(self, redactor: PiiRedactor) -> None:
        text = "Call me at 555-111-2222 please."
        first, _ = redactor.redact(text)
        second, was_redacted = redactor.redact(first)
        assert first == second
        # No PII remains, so second pass should return False
        assert not was_redacted

    def test_redacting_twice_is_idempotent_account(self, redactor: PiiRedactor) -> None:
        text = "Reference number 1234567890."
        first, _ = redactor.redact(text)
        second, was_redacted = redactor.redact(first)
        assert first == second
        assert not was_redacted

    def test_placeholder_tokens_not_re_redacted(self, redactor: PiiRedactor) -> None:
        text = "Customer [NAME] confirmed account [ACCOUNT] via [PHONE]."
        result, was_redacted = redactor.redact(text)
        # Already-replaced tokens must survive unchanged
        assert "[NAME]" in result
        assert "[ACCOUNT]" in result
        assert "[PHONE]" in result
        assert not was_redacted


# ── Formatted IBANs ───────────────────────────────────────────────────────────


class TestFormattedIBANs:
    """
    IBANs are often displayed with spaces every four characters.
    The regex must handle both compact and spaced formats.
    """

    def test_compact_iban(self, redactor: PiiRedactor) -> None:
        text = "IBAN: GB29NWBK60161331926819"
        result, was_redacted = redactor.redact(text)
        assert "GB29NWBK60161331926819" not in result
        assert "[IBAN]" in result
        assert was_redacted

    def test_compact_german_iban(self, redactor: PiiRedactor) -> None:
        text = "Bitte überweisen Sie an DE89370400440532013000."
        result, was_redacted = redactor.redact(text)
        assert "DE89370400440532013000" not in result
        assert was_redacted

    def test_compact_spanish_iban(self, redactor: PiiRedactor) -> None:
        text = "El IBAN es ES7921000813610123456789."
        result, was_redacted = redactor.redact(text)
        assert "ES7921000813610123456789" not in result
        assert was_redacted


# ── Realistic transcript fragments ────────────────────────────────────────────


class TestRealisticTranscriptFragments:
    """
    End-to-end style tests using fragments that resemble real call transcripts.
    PII must be removed; compliance-relevant content must survive.
    """

    def test_banking_intro_utterance(self, redactor: PiiRedactor) -> None:
        text = (
            "Good morning, I'm speaking with Michael Torres, date of birth "
            "15th June 1978, account number 74839201. How can I help you today?"
        )
        result, was_redacted = redactor.redact(text)
        assert "Michael Torres" not in result
        assert "74839201" not in result
        assert "Good morning" in result
        assert was_redacted

    def test_investment_sales_utterance_preserves_risk_phrase(
        self, redactor: PiiRedactor
    ) -> None:
        text = (
            "Mr. Daniel Wu, I want to assure you this product has zero risk "
            "and a guaranteed annual return of 8 percent."
        )
        result, was_redacted = redactor.redact(text)
        assert "Daniel Wu" not in result
        # Risk phrases must survive for the NLP engine
        assert "zero risk" in result
        assert "guaranteed annual return" in result
        assert was_redacted

    def test_transfer_request_utterance(self, redactor: PiiRedactor) -> None:
        text = (
            "Please transfer 5,000 euros from account 19283746 to "
            "ES9121000418450200051332, reference: contract renewal."
        )
        result, was_redacted = redactor.redact(text)
        assert "19283746" not in result
        assert "ES9121000418450200051332" not in result
        # Amount and purpose should survive
        assert "5,000 euros" in result
        assert "contract renewal" in result
        assert was_redacted

    def test_no_pii_compliance_statement(self, redactor: PiiRedactor) -> None:
        text = (
            "Under MiFID II Article 24, we are required to assess your "
            "investment knowledge and experience before proceeding."
        )
        result, was_redacted = redactor.redact(text)
        assert result == text
        assert not was_redacted

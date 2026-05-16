"""Unit tests for TranscriptCleaner."""

from __future__ import annotations

import pytest

from cleaner import TranscriptCleaner


@pytest.fixture(scope="module")
def cleaner() -> TranscriptCleaner:
    return TranscriptCleaner()


class TestNoiseMarkerRemoval:
    def test_removes_silence_marker(self, cleaner: TranscriptCleaner) -> None:
        assert cleaner.clean("[SILENCE] and then I said") == "and then I said"

    def test_removes_inaudible_marker(self, cleaner: TranscriptCleaner) -> None:
        assert cleaner.clean("the rate is [INAUDIBLE] percent") == "the rate is  percent".strip()

    def test_removes_blank_audio_marker(self, cleaner: TranscriptCleaner) -> None:
        assert "[BLANK_AUDIO]" not in cleaner.clean("[BLANK_AUDIO] Hello there")

    def test_removes_sound_markers(self, cleaner: TranscriptCleaner) -> None:
        assert "*cough*" not in cleaner.clean("so *cough* as I was saying")

    def test_removes_parenthesised_silence(self, cleaner: TranscriptCleaner) -> None:
        assert "(silence)" not in cleaner.clean("(silence) Right, so the product")

    def test_removes_case_insensitive(self, cleaner: TranscriptCleaner) -> None:
        assert cleaner.clean("[silence]") == ""
        assert cleaner.clean("[Silence]") == ""


class TestFillerWordRemoval:
    def test_removes_um(self, cleaner: TranscriptCleaner) -> None:
        result = cleaner.clean("The product is um very suitable for you.")
        assert "um" not in result
        assert "suitable" in result

    def test_removes_uh(self, cleaner: TranscriptCleaner) -> None:
        result = cleaner.clean("Uh let me check that for you.")
        assert result.startswith("let") or "uh" not in result.lower()

    def test_removes_er(self, cleaner: TranscriptCleaner) -> None:
        assert "er " not in cleaner.clean("the er annual return is")

    def test_removes_hmm(self, cleaner: TranscriptCleaner) -> None:
        assert "hmm" not in cleaner.clean("hmm that is a good question")

    def test_removes_you_know(self, cleaner: TranscriptCleaner) -> None:
        result = cleaner.clean("This product is, you know, very popular.")
        assert "you know" not in result

    def test_preserves_like_in_financial_context(self, cleaner: TranscriptCleaner) -> None:
        text = "It is similar to a like-for-like comparison."
        result = cleaner.clean(text)
        assert "like-for-like" in result

    def test_preserves_so_in_mid_sentence(self, cleaner: TranscriptCleaner) -> None:
        text = "The rate is so competitive in the current market."
        result = cleaner.clean(text)
        # "so" in the middle of a sentence (not followed by comma) should stay
        assert "so competitive" in result


class TestWhitespaceNormalisation:
    def test_collapses_double_spaces(self, cleaner: TranscriptCleaner) -> None:
        result = cleaner.clean("Hello  there  how are  you")
        assert "  " not in result

    def test_strips_leading_trailing_spaces(self, cleaner: TranscriptCleaner) -> None:
        result = cleaner.clean("  hello world  ")
        assert result == "hello world"

    def test_empty_string(self, cleaner: TranscriptCleaner) -> None:
        assert cleaner.clean("") == ""

    def test_only_filler_becomes_empty(self, cleaner: TranscriptCleaner) -> None:
        assert cleaner.clean("um uh er") == ""


class TestCleanBatch:
    def test_filters_empty_results(self, cleaner: TranscriptCleaner) -> None:
        texts = ["um", "[SILENCE]", "Hello there."]
        result = cleaner.clean_batch(texts)
        assert len(result) == 1
        assert result[0] == "Hello there."

    def test_preserves_order(self, cleaner: TranscriptCleaner) -> None:
        texts = ["First sentence.", "um", "Second sentence."]
        result = cleaner.clean_batch(texts)
        assert result == ["First sentence.", "Second sentence."]


class TestRegulatoryTermsPreserved:
    @pytest.mark.parametrize(
        "text",
        [
            "The MiFID II suitability assessment is required.",
            "Under FTC Act Section 5 this constitutes an unfair practice.",
            "The guaranteed return claim violates CNMV Circular 1/2022.",
            "EMA promotional guidelines apply to all pharma communications.",
        ],
    )
    def test_preserves_regulatory_text(
        self, cleaner: TranscriptCleaner, text: str
    ) -> None:
        result = cleaner.clean(text)
        assert result == text

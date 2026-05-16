"""
Transcript cleaner: removes noise markers and spoken filler words.

Design constraints:
  - Must NOT remove regulatory terms (e.g., "like-for-like comparison").
  - Only removes "like" / "so" when used as discourse markers, not in financial context.
  - Preserves punctuation and sentence structure.
"""

from __future__ import annotations

import re

# Whisper noise / silence markers
_NOISE_PATTERNS: list[str] = [
    r"\[SILENCE\]",
    r"\[INAUDIBLE\]",
    r"\[NOISE\]",
    r"\[BLANK_AUDIO\]",
    r"\(silence\)",
    r"\(inaudible\)",
    r"\*[^*]+\*",           # *cough*, *background noise*
]

# Spoken filler words / discourse markers
# Using word boundaries and negative lookaheads to avoid false positives.
_FILLER_PATTERNS: list[str] = [
    r"\bum+\b",
    r"\buh+\b",
    r"\berr?m?\b",
    r"\bah+\b",
    r"\bhmm+\b",
    r"\byou\s+know(?=\s|,|$)",
    r"\bI\s+mean(?=\s|,|$)",
    r"(?<!\w)so(?=\s*,)",           # "so," at phrase boundaries only
    r"\blike(?=\s*,)",              # "like," (discourse) — not "like-for-like"
]

_NOISE_RE = re.compile("|".join(_NOISE_PATTERNS), re.IGNORECASE)
_FILLER_RE = re.compile("|".join(_FILLER_PATTERNS), re.IGNORECASE)
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
_LEADING_PUNCT_RE = re.compile(r"^[\s,\.;]+")
_TRAILING_PUNCT_RE = re.compile(r"[\s,;]+$")


class TranscriptCleaner:
    def clean(self, text: str) -> str:
        """
        Applies noise removal and filler-word stripping.
        Returns the cleaned string; returns empty string if nothing remains.
        """
        if not text:
            return text

        cleaned = _NOISE_RE.sub("", text)
        cleaned = _FILLER_RE.sub("", cleaned)
        cleaned = _MULTI_SPACE_RE.sub(" ", cleaned)
        cleaned = _LEADING_PUNCT_RE.sub("", cleaned)
        cleaned = _TRAILING_PUNCT_RE.sub("", cleaned)

        return cleaned.strip()

    def clean_batch(self, texts: list[str]) -> list[str]:
        """Cleans a list; filters out utterances that are entirely filler."""
        return [c for t in texts if (c := self.clean(t))]

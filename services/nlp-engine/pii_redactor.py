"""
PII Redaction using spaCy NER + regex.

Detected and replaced:
  PERSON entities (spaCy NER)  → [NAME]
  Phone numbers (regex)        → [PHONE]
  IBANs (regex)                → [IBAN]
  Account / card numbers       → [ACCOUNT]  (8–19 digit sequences)

NOT redacted (intentionally preserved):
  ORG / product names, regulatory terms, dates, currencies.
"""

from __future__ import annotations

import re

from .errors import ModelLoadError

# ── Regex patterns ──────────────────────────────────────────────────────────
# Phone: international (+44 / +1) and domestic formats, various separators
_PHONE_RE = re.compile(
    r"""
    (?:
        \+\d{1,3}[\s.\-]?          # optional country code
    )?
    (?:\(?\d{2,4}\)?[\s.\-]?)?     # optional area code
    \d{3,4}[\s.\-]?\d{4,5}         # main number
    """,
    re.VERBOSE,
)

# IBAN: 2-letter country code + 2 check digits + up to 30 alphanum chars
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b")

# Account / card numbers: 8–19 consecutive digits (not preceded/followed by more digits)
_ACCOUNT_RE = re.compile(r"(?<!\d)\d{8,19}(?!\d)")


class PiiRedactor:
    """
    Loads a spaCy model once and reuses it across calls.
    Use `en_core_web_lg` in production; `en_core_web_sm` is sufficient for tests.
    """

    def __init__(self, spacy_model: str = "en_core_web_lg") -> None:
        try:
            import spacy  # type: ignore[import]

            self._nlp = spacy.load(spacy_model, exclude=["parser", "lemmatizer", "senter"])
        except OSError as exc:
            raise ModelLoadError(
                f"spaCy model '{spacy_model}' not found. "
                f"Run: python -m spacy download {spacy_model}"
            ) from exc
        except ImportError as exc:
            raise ModelLoadError("spaCy is not installed. Run: pip install spacy") from exc

    def redact(self, text: str) -> tuple[str, bool]:
        """
        Returns (redacted_text, was_pii_found).
        Replacements are applied in this order: NER → phone → IBAN → account.
        Order matters because phone regex can match substrings of IBANs.
        """
        if not text or not text.strip():
            return text, False

        redacted = text
        was_redacted = False

        # ── 1. spaCy NER: PERSON entities ───────────────────────────────────
        doc = self._nlp(redacted)
        # Collect in reverse char-offset order to preserve positions during replacement
        person_spans = [
            (ent.start_char, ent.end_char)
            for ent in doc.ents
            if ent.label_ == "PERSON"
        ]
        for start, end in sorted(person_spans, reverse=True):
            redacted = redacted[:start] + "[NAME]" + redacted[end:]
            was_redacted = True

        # ── 2. IBAN (before generic account regex to prevent partial matches) ─
        new = _IBAN_RE.sub("[IBAN]", redacted)
        if new != redacted:
            was_redacted = True
        redacted = new

        # ── 3. Phone numbers ────────────────────────────────────────────────
        new = _PHONE_RE.sub("[PHONE]", redacted)
        if new != redacted:
            was_redacted = True
        redacted = new

        # ── 4. Account / card numbers ───────────────────────────────────────
        new = _ACCOUNT_RE.sub("[ACCOUNT]", redacted)
        if new != redacted:
            was_redacted = True
        redacted = new

        return redacted, was_redacted

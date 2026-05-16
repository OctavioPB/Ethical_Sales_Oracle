class NLPEngineError(Exception):
    pass


class PiiRedactionError(NLPEngineError):
    def __init__(self, message: str, utterance_preview: str = "") -> None:
        super().__init__(message)
        # Store only a short, non-sensitive preview for diagnostics.
        self.utterance_preview = utterance_preview[:30] if utterance_preview else ""


class ModelLoadError(NLPEngineError):
    pass


class LLMScorerError(NLPEngineError):
    """Raised when the LLM scoring service fails after all retries, or returns an unparseable response."""

    def __init__(self, message: str, attempts: int = 0) -> None:
        super().__init__(message)
        self.attempts = attempts

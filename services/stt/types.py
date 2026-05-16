from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TranscriptSegment:
    """A single time-aligned segment of text from the STT engine."""

    start_ms: int
    end_ms: int
    text: str
    # Whisper returns avg_logprob (negative); we normalise to 0–1 range.
    confidence: float = 0.0

    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


@dataclass
class TranscriptResult:
    """Full STT output for one audio chunk."""

    segments: list[TranscriptSegment] = field(default_factory=list)
    language: str = "en"
    full_text: str = ""
    provider: str = ""          # "whisper" | "azure"
    model_version: str = ""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


Speaker = Literal["AGENT", "CUSTOMER"]


@dataclass
class SpeakerSegment:
    """A time-window attributed to a single speaker by the diarization model."""

    start_ms: int
    end_ms: int
    speaker_label: str      # Raw pyannote label: SPEAKER_00, SPEAKER_01, …

    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms

    def overlaps(self, start_ms: int, end_ms: int) -> bool:
        return self.start_ms < end_ms and start_ms < self.end_ms

    def overlap_ms(self, start_ms: int, end_ms: int) -> int:
        return max(0, min(self.end_ms, end_ms) - max(self.start_ms, start_ms))


@dataclass
class DiarizedUtterance:
    """A transcript segment with an assigned AGENT / CUSTOMER label."""

    call_id: str
    speaker: Speaker
    text: str
    start_ms: int
    end_ms: int
    confidence: float = 0.0
    pii_redacted: bool = False

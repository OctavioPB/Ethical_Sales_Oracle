"""
Maps raw pyannote speaker labels (SPEAKER_00, SPEAKER_01) to AGENT / CUSTOMER.

Strategy (configurable):
  - "first_speaker": the speaker who talks first = AGENT (default).
  - "most_talktime": speaker with the most total talk time = AGENT.

Both are heuristics. The resolution is per-utterance: each transcript segment
is attributed to the speaker whose diarization window covers the most of it.
"""

from __future__ import annotations

from typing import Literal

from .types import Speaker, SpeakerSegment

MappingStrategy = Literal["first_speaker", "most_talktime"]

_FALLBACK_SPEAKER: Speaker = "AGENT"


class SpeakerMapper:
    def __init__(self, strategy: MappingStrategy = "first_speaker") -> None:
        self._strategy = strategy

    def build_map(self, segments: list[SpeakerSegment]) -> dict[str, Speaker]:
        """
        Returns a mapping of raw pyannote label → AGENT | CUSTOMER.
        Only two-speaker calls are fully supported; additional speakers are
        assigned AGENT or CUSTOMER deterministically (by label sort order).
        """
        if not segments:
            return {}

        labels = sorted({s.speaker_label for s in segments})

        if self._strategy == "first_speaker":
            dominant_label = min(
                labels,
                key=lambda lbl: next(
                    (s.start_ms for s in segments if s.speaker_label == lbl),
                    float("inf"),
                ),
            )
        else:  # most_talktime
            talk_time: dict[str, int] = {}
            for seg in segments:
                talk_time[seg.speaker_label] = (
                    talk_time.get(seg.speaker_label, 0) + seg.duration_ms()
                )
            dominant_label = max(talk_time, key=lambda k: talk_time[k])

        speaker_map: dict[str, Speaker] = {}
        for label in labels:
            speaker_map[label] = "AGENT" if label == dominant_label else "CUSTOMER"

        return speaker_map

    def resolve_speaker(
        self,
        seg_start_ms: int,
        seg_end_ms: int,
        diarization: list[SpeakerSegment],
        speaker_map: dict[str, Speaker],
    ) -> Speaker:
        """
        Assigns AGENT or CUSTOMER to a transcript segment by finding
        the diarization window with the most overlap.
        Falls back to AGENT if no overlap is found.
        """
        best_overlap = 0
        best_label: str | None = None

        for ds in diarization:
            overlap = ds.overlap_ms(seg_start_ms, seg_end_ms)
            if overlap > best_overlap:
                best_overlap = overlap
                best_label = ds.speaker_label

        if best_label is None:
            return _FALLBACK_SPEAKER

        return speaker_map.get(best_label, _FALLBACK_SPEAKER)

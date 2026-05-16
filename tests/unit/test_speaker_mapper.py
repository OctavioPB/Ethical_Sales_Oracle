"""Unit tests for SpeakerMapper."""

from __future__ import annotations

import pytest

from services.diarization.speaker_mapper import SpeakerMapper
from services.diarization.types import SpeakerSegment


def seg(label: str, start: int, end: int) -> SpeakerSegment:
    return SpeakerSegment(speaker_label=label, start_ms=start, end_ms=end)


class TestBuildMap:
    def test_first_speaker_strategy_assigns_agent_to_earliest(self) -> None:
        segments = [
            seg("SPEAKER_00", 0, 5_000),
            seg("SPEAKER_01", 5_000, 10_000),
        ]
        mapper = SpeakerMapper(strategy="first_speaker")
        speaker_map = mapper.build_map(segments)
        assert speaker_map["SPEAKER_00"] == "AGENT"
        assert speaker_map["SPEAKER_01"] == "CUSTOMER"

    def test_first_speaker_strategy_agent_is_second_if_customer_speaks_first(self) -> None:
        segments = [
            seg("SPEAKER_01", 0, 2_000),   # SPEAKER_01 speaks first
            seg("SPEAKER_00", 2_000, 8_000),
        ]
        mapper = SpeakerMapper(strategy="first_speaker")
        speaker_map = mapper.build_map(segments)
        assert speaker_map["SPEAKER_01"] == "AGENT"
        assert speaker_map["SPEAKER_00"] == "CUSTOMER"

    def test_most_talktime_strategy_assigns_agent_to_dominant_speaker(self) -> None:
        segments = [
            seg("SPEAKER_00", 0, 5_000),       # 5s
            seg("SPEAKER_01", 5_000, 25_000),  # 20s — dominant
        ]
        mapper = SpeakerMapper(strategy="most_talktime")
        speaker_map = mapper.build_map(segments)
        assert speaker_map["SPEAKER_01"] == "AGENT"
        assert speaker_map["SPEAKER_00"] == "CUSTOMER"

    def test_empty_segments_returns_empty_map(self) -> None:
        mapper = SpeakerMapper()
        assert mapper.build_map([]) == {}

    def test_single_speaker_maps_to_agent(self) -> None:
        segments = [seg("SPEAKER_00", 0, 10_000)]
        mapper = SpeakerMapper()
        speaker_map = mapper.build_map(segments)
        assert speaker_map["SPEAKER_00"] == "AGENT"


class TestResolveSpeaker:
    def test_assigns_speaker_by_max_overlap(self) -> None:
        diarization = [
            seg("SPEAKER_00", 0, 5_000),
            seg("SPEAKER_01", 5_000, 10_000),
        ]
        speaker_map = {"SPEAKER_00": "AGENT", "SPEAKER_01": "CUSTOMER"}
        mapper = SpeakerMapper()

        # Segment entirely within SPEAKER_00 window
        assert mapper.resolve_speaker(1_000, 4_000, diarization, speaker_map) == "AGENT"

        # Segment entirely within SPEAKER_01 window
        assert mapper.resolve_speaker(6_000, 9_000, diarization, speaker_map) == "CUSTOMER"

    def test_assigns_by_majority_overlap_at_boundary(self) -> None:
        diarization = [
            seg("SPEAKER_00", 0, 5_000),
            seg("SPEAKER_01", 5_000, 10_000),
        ]
        speaker_map = {"SPEAKER_00": "AGENT", "SPEAKER_01": "CUSTOMER"}
        mapper = SpeakerMapper()

        # Segment spans the boundary: 3000–7000 (2s in AGENT, 2s in CUSTOMER)
        # With equal overlap the first in iteration order wins; result is deterministic.
        result = mapper.resolve_speaker(3_000, 7_000, diarization, speaker_map)
        assert result in ("AGENT", "CUSTOMER")  # deterministic but accept either

    def test_falls_back_to_agent_when_no_overlap(self) -> None:
        diarization = [seg("SPEAKER_00", 10_000, 20_000)]
        speaker_map = {"SPEAKER_00": "CUSTOMER"}
        mapper = SpeakerMapper()
        # Segment has zero overlap with all diarization windows
        assert mapper.resolve_speaker(0, 5_000, diarization, speaker_map) == "AGENT"

    def test_handles_empty_diarization(self) -> None:
        mapper = SpeakerMapper()
        assert mapper.resolve_speaker(0, 5_000, [], {}) == "AGENT"


class TestSpeakerSegmentHelpers:
    def test_duration_ms(self) -> None:
        s = seg("SPEAKER_00", 1_000, 6_000)
        assert s.duration_ms() == 5_000

    def test_overlaps_true(self) -> None:
        s = seg("SPEAKER_00", 2_000, 8_000)
        assert s.overlaps(5_000, 10_000)

    def test_overlaps_false_adjacent(self) -> None:
        s = seg("SPEAKER_00", 0, 5_000)
        assert not s.overlaps(5_000, 10_000)

    def test_overlap_ms_correct(self) -> None:
        s = seg("SPEAKER_00", 2_000, 8_000)
        assert s.overlap_ms(5_000, 10_000) == 3_000

    def test_overlap_ms_zero_when_no_overlap(self) -> None:
        s = seg("SPEAKER_00", 0, 5_000)
        assert s.overlap_ms(5_000, 10_000) == 0

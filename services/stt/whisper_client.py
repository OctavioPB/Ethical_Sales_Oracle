"""Whisper STT client (self-hosted). Transcribes raw PCM audio bytes."""

from __future__ import annotations

import numpy as np

from .errors import STTError
from .types import TranscriptResult, TranscriptSegment

# Import lazily so the module can be imported without GPU/model present (useful in tests).
_whisper: object | None = None


def _load_whisper() -> object:
    global _whisper
    if _whisper is None:
        import whisper  # type: ignore[import]

        _whisper = whisper
    return _whisper


class WhisperClient:
    """
    Wraps openai-whisper for batch transcription of 15-second PCM chunks.
    The model is loaded once per process — reuse one instance per Airflow worker.
    """

    def __init__(self, model_name: str = "large-v3") -> None:
        whisper = _load_whisper()
        self._model = whisper.load_model(model_name)  # type: ignore[attr-defined]
        self._model_name = model_name

    def transcribe(self, audio_bytes: bytes, sample_rate: int = 16_000) -> TranscriptResult:
        if not audio_bytes:
            raise STTError("Empty audio buffer", provider="whisper")

        # PCM 16-bit → float32 normalised to [-1, 1]
        audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_f32 = audio_int16.astype(np.float32) / 32_768.0

        # Whisper always expects 16 kHz mono. If resampling is needed it should
        # happen in the ingestion service before Kafka publish.
        result = self._model.transcribe(  # type: ignore[attr-defined]
            audio_f32,
            word_timestamps=True,
            verbose=False,
            fp16=False,   # set True on CUDA for speed
        )

        segments: list[TranscriptSegment] = []
        for seg in result.get("segments", []):
            text = seg.get("text", "").strip()
            if not text:
                continue
            raw_logprob: float = seg.get("avg_logprob", -1.0)
            # avg_logprob is ≤ 0; map to 0–1 confidence (clamped)
            confidence = max(0.0, min(1.0, 1.0 + raw_logprob))
            segments.append(
                TranscriptSegment(
                    start_ms=int(seg["start"] * 1_000),
                    end_ms=int(seg["end"] * 1_000),
                    text=text,
                    confidence=confidence,
                )
            )

        return TranscriptResult(
            segments=segments,
            language=result.get("language", "en"),
            full_text=result.get("text", "").strip(),
            provider="whisper",
            model_version=self._model_name,
        )

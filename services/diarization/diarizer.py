"""
pyannote.audio speaker diarization wrapper.

Setup (one-time):
  1. Accept pyannote model agreement on huggingface.co
  2. Set HF_TOKEN env var to a Hugging Face read token
"""

from __future__ import annotations

import io

import numpy as np

from .errors import DiarizationError, DiarizationModelNotFoundError
from .types import SpeakerSegment

_PYANNOTE_MODEL = "pyannote/speaker-diarization-3.1"


class Diarizer:
    """
    Runs speaker diarization on assembled PCM audio and returns
    a list of time-labelled speaker segments (SPEAKER_00, SPEAKER_01, …).

    The pipeline is loaded once at construction time — reuse one instance per worker.
    """

    def __init__(self, hf_token: str) -> None:
        try:
            from pyannote.audio import Pipeline  # type: ignore[import]
        except ImportError as exc:
            raise DiarizationModelNotFoundError(
                "pyannote.audio is not installed. Run: pip install pyannote.audio"
            ) from exc

        try:
            self._pipeline = Pipeline.from_pretrained(
                _PYANNOTE_MODEL,
                use_auth_token=hf_token,
            )
        except Exception as exc:
            raise DiarizationModelNotFoundError(
                f"Could not load pyannote model '{_PYANNOTE_MODEL}'. "
                "Ensure HF_TOKEN is set and you have accepted the model agreement."
            ) from exc

    def diarize(self, audio_bytes: bytes, sample_rate: int = 16_000) -> list[SpeakerSegment]:
        """
        Diarizes the full call audio (all chunks concatenated).
        Returns time segments ordered by start_ms.
        """
        if not audio_bytes:
            raise DiarizationError("Empty audio buffer supplied to diarizer")

        wav_buffer = self._pcm_to_wav(audio_bytes, sample_rate)

        try:
            import soundfile as sf  # type: ignore[import]

            wav_buffer.seek(0)
            audio_array, sr = sf.read(wav_buffer, dtype="float32")
        except ImportError as exc:
            raise DiarizationError(
                "soundfile is not installed. Run: pip install soundfile"
            ) from exc

        diarization = self._pipeline(
            {"waveform": _to_tensor(audio_array), "sample_rate": sr}
        )

        segments: list[SpeakerSegment] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(
                SpeakerSegment(
                    start_ms=int(turn.start * 1_000),
                    end_ms=int(turn.end * 1_000),
                    speaker_label=speaker,
                )
            )

        return sorted(segments, key=lambda s: s.start_ms)

    @staticmethod
    def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int) -> io.BytesIO:
        import wave

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)          # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)
        buf.seek(0)
        return buf


def _to_tensor(audio: "np.ndarray") -> object:  # type: ignore[type-arg]
    """Converts numpy array to a torch tensor expected by pyannote."""
    import torch  # type: ignore[import]

    if audio.ndim == 1:
        audio = audio[np.newaxis, :]
    return torch.from_numpy(audio)

"""Azure Cognitive Services STT fallback client."""

from __future__ import annotations

import io
import wave

from .errors import STTError, STTTimeoutError
from .types import TranscriptResult, TranscriptSegment


class AzureSTTClient:
    """
    Wraps azure-cognitiveservices-speech for real-time transcription.
    Used as the fallback when STT_PROVIDER=azure or when the Whisper cluster is degraded.

    Requires: pip install azure-cognitiveservices-speech
    """

    def __init__(self, subscription_key: str, region: str = "westeurope") -> None:
        if not subscription_key:
            raise STTError("AZURE_STT_KEY is required for Azure provider", provider="azure")

        try:
            import azure.cognitiveservices.speech as speechsdk  # type: ignore[import]
        except ImportError as exc:
            raise STTError(
                "azure-cognitiveservices-speech is not installed. "
                "Run: pip install azure-cognitiveservices-speech",
                provider="azure",
            ) from exc

        self._sdk = speechsdk
        self._key = subscription_key
        self._region = region

    def transcribe(self, audio_bytes: bytes, sample_rate: int = 16_000) -> TranscriptResult:
        if not audio_bytes:
            raise STTError("Empty audio buffer", provider="azure")

        # Azure SDK reads from a WAV stream; wrap PCM bytes in a WAV container.
        wav_buffer = self._pcm_to_wav(audio_bytes, sample_rate)

        speech_config = self._sdk.SpeechConfig(
            subscription=self._key,
            region=self._region,
        )
        speech_config.speech_recognition_language = "en-US"
        speech_config.request_word_level_timestamps()

        audio_stream = self._sdk.AudioDataStream(
            self._sdk.AudioDataStream(
                self._sdk.PullAudioInputStream(
                    self._sdk.PullAudioInputStreamCallback(),
                )
            )
        )
        audio_input = self._sdk.AudioConfig(stream=self._sdk.PushAudioInputStream(
            self._sdk.AudioStreamFormat.get_wave_format_pcm(sample_rate, 16, 1)
        ))

        recognizer = self._sdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_input,
        )

        # For production use continuous recognition; this is the simplified batch form.
        result = recognizer.recognize_once_async().get()

        if result.reason == self._sdk.ResultReason.RecognizedSpeech:
            return TranscriptResult(
                segments=[
                    TranscriptSegment(
                        start_ms=0,
                        end_ms=len(audio_bytes) // (sample_rate // 1_000 * 2),
                        text=result.text,
                        confidence=0.9,
                    )
                ],
                language="en",
                full_text=result.text,
                provider="azure",
                model_version="azure-speech-v1",
            )
        elif result.reason == self._sdk.ResultReason.NoMatch:
            return TranscriptResult(provider="azure")
        elif result.reason == self._sdk.ResultReason.Canceled:
            details = self._sdk.CancellationDetails.from_result(result)
            if "timeout" in str(details.error_details).lower():
                raise STTTimeoutError(details.error_details, provider="azure")
            raise STTError(details.error_details, provider="azure")
        else:
            raise STTError(f"Unexpected result reason: {result.reason}", provider="azure")

    @staticmethod
    def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)       # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)
        return buf.getvalue()

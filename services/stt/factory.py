"""Creates the correct STT client based on the STT_PROVIDER env var."""

from __future__ import annotations

from typing import Protocol

from .types import TranscriptResult


class STTClient(Protocol):
    def transcribe(self, audio_bytes: bytes, sample_rate: int = 16_000) -> TranscriptResult: ...


def create_stt_client(
    provider: str,
    model_name: str = "large-v3",
    azure_key: str = "",
    azure_region: str = "westeurope",
) -> STTClient:
    if provider == "whisper":
        from .whisper_client import WhisperClient

        return WhisperClient(model_name=model_name)

    if provider == "azure":
        from .azure_client import AzureSTTClient

        return AzureSTTClient(subscription_key=azure_key, region=azure_region)

    raise ValueError(
        f"Unknown STT provider '{provider}'. Valid values: 'whisper', 'azure'. "
        "Set STT_PROVIDER env var."
    )

from abc import ABC, abstractmethod
from pydantic import BaseModel, Field


class TranscriptionResult(BaseModel):
    text: str
    language: str = 'en'
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    provider: str = 'bhashini'


class SynthesisResult(BaseModel):
    audio_base64: str | None = None
    audio_format: str = 'wav'
    audio_url: str | None = None
    provider: str = 'bhashini'


class VoiceProvider(ABC):
    """Abstract interface for speech-to-text (ASR) and text-to-speech (TTS)."""

    name: str = 'base_voice_provider'

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        """Transcribe audio recording to text."""
        pass

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        language: str = 'en',
    ) -> SynthesisResult:
        """Synthesize text into speech audio."""
        pass

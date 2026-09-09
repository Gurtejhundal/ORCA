import logging
from backend.core.config import Settings
from backend.voice.base import VoiceProvider, TranscriptionResult, SynthesisResult
from backend.voice.bhashini import BhashiniVoiceProvider
from backend.voice.browser_fallback import BrowserFallbackVoiceProvider

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    'audio/webm',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/x-m4a',
    'audio/m4a',
    'application/octet-stream',
}
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10 MB


class VoiceService:
    """Service coordinating speech-to-text, text-to-speech, and provider fallbacks."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.bhashini = BhashiniVoiceProvider(
            api_key=settings.bhashini_api_key,
            user_id=settings.bhashini_user_id,
            base_url=settings.bhashini_base_url,
            pipeline_id=settings.bhashini_pipeline_id,
        )
        self.fallback = BrowserFallbackVoiceProvider()

    def validate_audio(self, audio_bytes: bytes, mime_type: str) -> None:
        if not audio_bytes:
            raise ValueError('Audio is empty')
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise ValueError(f"Audio file size exceeds limit of {MAX_AUDIO_SIZE // (1024*1024)} MB")
        clean_mime = mime_type.split(';')[0].strip().lower()
        if clean_mime and clean_mime not in ALLOWED_MIME_TYPES:
            raise ValueError('Unsupported audio MIME type')

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        self.validate_audio(audio_bytes, mime_type)

        if self.bhashini.is_configured:
            try:
                return await self.bhashini.transcribe(audio_bytes, mime_type, language_hint)
            except Exception as exc:
                logger.warning("bhashini_asr_failed: %s; falling back to browser fallback", exc)

        return await self.fallback.transcribe(audio_bytes, mime_type, language_hint)

    async def synthesize(
        self,
        text: str,
        language: str = 'en',
    ) -> SynthesisResult:
        if self.bhashini.is_configured:
            try:
                return await self.bhashini.synthesize(text, language)
            except Exception as exc:
                logger.warning("bhashini_tts_failed: %s; falling back to browser fallback", exc)

        return await self.fallback.synthesize(text, language)

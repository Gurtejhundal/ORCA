from backend.voice.base import VoiceProvider, TranscriptionResult, SynthesisResult


class BrowserFallbackVoiceProvider(VoiceProvider):
    """Fallback voice provider that signals the browser to use Web Speech APIs."""

    name = 'browser_fallback'

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        from backend.core.exceptions import SourceUnavailable
        raise SourceUnavailable('Speech transcription', 'No working server speech provider; use browser speech recognition or configure Bhashini')

    async def synthesize(
        self,
        text: str,
        language: str = 'en',
    ) -> SynthesisResult:
        # Browser handles synthesis via Web Speech SpeechSynthesisUtterance
        return SynthesisResult(
            audio_base64=None,
            audio_format='browser_speech_synthesis',
            audio_url=None,
            provider=self.name,
        )

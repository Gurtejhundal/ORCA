import base64
import logging
import httpx
from backend.voice.base import VoiceProvider, TranscriptionResult, SynthesisResult

logger = logging.getLogger(__name__)


class BhashiniVoiceProvider(VoiceProvider):
    """Voice provider using Government of India's Bhashini ULCA / Dhruva APIs for Indic ASR & TTS."""

    name = 'bhashini'

    def __init__(
        self,
        api_key: str,
        user_id: str = '',
        base_url: str = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
        pipeline_id: str = '',
    ):
        self.api_key = api_key
        self.user_id = user_id
        self.base_url = base_url
        self.pipeline_id = pipeline_id

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        if not self.is_configured:
            raise RuntimeError("Bhashini API credentials not configured")

        source_lang = language_hint or 'hi'
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang
                        },
                        "audioFormat": "wav" if "wav" in mime_type else "mp3" if "mp3" in mime_type else "webm"
                    }
                }
            ],
            "inputData": {
                "audio": [
                    {
                        "audioContent": audio_b64
                    }
                ]
            }
        }

        headers = {
            "Authorization": self.api_key,
            "userID": self.user_id,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            # Parse ASR response
            tasks = data.get("pipelineResponse", [])
            for task in tasks:
                if task.get("taskType") == "asr":
                    output = task.get("output", [])
                    if output and "source" in output[0]:
                        return TranscriptionResult(
                            text=output[0]["source"],
                            language=source_lang,
                            confidence=0.92,
                            provider=self.name,
                        )

        raise RuntimeError("No transcript received from Bhashini ASR pipeline")

    async def synthesize(
        self,
        text: str,
        language: str = 'en',
    ) -> SynthesisResult:
        if not self.is_configured:
            raise RuntimeError("Bhashini API credentials not configured")

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {
                            "sourceLanguage": language
                        },
                        "gender": "male"
                    }
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": text
                    }
                ]
            }
        }

        headers = {
            "Authorization": self.api_key,
            "userID": self.user_id,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            tasks = data.get("pipelineResponse", [])
            for task in tasks:
                if task.get("taskType") == "tts":
                    audio_out = task.get("audio", [])
                    if audio_out and "audioContent" in audio_out[0]:
                        return SynthesisResult(
                            audio_base64=audio_out[0]["audioContent"],
                            audio_format="wav",
                            provider=self.name,
                        )

        raise RuntimeError("No audio received from Bhashini TTS pipeline")

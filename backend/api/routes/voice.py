from typing import Any
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from backend.voice.base import TranscriptionResult, SynthesisResult
from backend.core.exceptions import SourceUnavailable
from backend.voice.service import MAX_AUDIO_SIZE

router = APIRouter(prefix='/api/v1/voice', tags=['Voice Intelligence (Bhashini & Speech)'])


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize to speech")
    language: str = Field('hi', description="ISO 639-1 language code (e.g. 'hi', 'en', 'ta')")


class VoiceChatResponse(BaseModel):
    transcript: str
    language: str
    answer: str
    confidence: float
    warnings: list[str]
    evidence: list[dict[str, Any]]
    map_actions: list[dict[str, Any]]
    audio: dict[str, Any]
    session_id: str
    run_id: str


@router.post('/transcribe', response_model=TranscriptionResult, description="Convert uploaded audio to text using configured Bhashini ASR. Returns 503 when no server ASR provider is configured; browser speech recognition is client-side.")
async def transcribe_audio_endpoint(
    request: Request,
    audio: UploadFile = File(...),
    language_hint: str | None = Form(None),
    session_id: str | None = Form(None),
):
    voice_service = getattr(request.app.state, 'voice_service', None)
    if not voice_service:
        raise HTTPException(status_code=503, detail="Voice service is unavailable")

    try:
        content = await audio.read(MAX_AUDIO_SIZE + 1)
        mime_type = audio.content_type or 'audio/webm'
        return await voice_service.transcribe(content, mime_type, language_hint)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except SourceUnavailable:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(exc)}")


@router.post('/speak', response_model=SynthesisResult, description="Convert text to regional language speech using Bhashini TTS or browser fallback.")
async def speak_text_endpoint(payload: SpeakRequest, request: Request):
    voice_service = getattr(request.app.state, 'voice_service', None)
    if not voice_service:
        raise HTTPException(status_code=503, detail="Voice service is unavailable")

    try:
        return await voice_service.synthesize(payload.text, payload.language)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(exc)}")


@router.post('/chat', response_model=VoiceChatResponse, description="End-to-end voice chat: audio in -> transcript -> multi-agent reasoning -> multilingual answer + TTS audio.")
async def voice_chat_endpoint(
    request: Request,
    audio: UploadFile = File(...),
    language_hint: str | None = Form(None),
    session_id: str | None = Form(None),
    lat: float | None = Form(None),
    lon: float | None = Form(None),
):
    voice_service = getattr(request.app.state, 'voice_service', None)
    orchestrator = getattr(request.app.state, 'orchestrator', None)
    if not voice_service or not orchestrator:
        raise HTTPException(status_code=503, detail="Voice or Orchestrator service unavailable")

    # 1. Transcribe
    content = await audio.read(MAX_AUDIO_SIZE + 1)
    mime = audio.content_type or 'audio/webm'
    transcription = await voice_service.transcribe(content, mime, language_hint)

    # 2. Chat pipeline
    explicit_loc = {'lat': lat, 'lon': lon} if lat is not None and lon is not None else None
    chat_resp = await orchestrator.chat(
        query=transcription.text,
        session_id=session_id,
        explicit_location=explicit_loc,
        language_hint=transcription.language,
    )

    # 3. Text to Speech
    audio_info = {'available': False, 'url': None, 'audio_base64': None, 'provider': None}
    try:
        synthesis = await voice_service.synthesize(chat_resp.answer, chat_resp.language)
        audio_info = {
            'available': bool(synthesis.audio_base64 or synthesis.audio_url),
            'audio_base64': synthesis.audio_base64,
            'audio_format': synthesis.audio_format,
            'provider': synthesis.provider,
        }
    except Exception:
        # Voice failure must never break chat
        pass

    return VoiceChatResponse(
        transcript=transcription.text,
        language=chat_resp.language,
        answer=chat_resp.answer,
        confidence=chat_resp.confidence,
        warnings=chat_resp.warnings,
        evidence=[e.model_dump() for e in chat_resp.evidence],
        map_actions=[m.model_dump() for m in chat_resp.map_actions],
        audio=audio_info,
        session_id=chat_resp.session_id,
        run_id=chat_resp.run_id,
    )

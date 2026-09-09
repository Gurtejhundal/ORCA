from typing import Any
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from backend.agents.schemas import ChatResponsePayload
from backend.schemas.marine import Location

router = APIRouter(prefix='/api/v1', tags=['Chat & AI Agent Orchestration'])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question or statement")
    session_id: str | None = Field(None, description="Client session ID for multi-turn conversation memory")
    location: Location | None = Field(None, description="Optional GPS coordinates {lat, lon}")
    language: str | None = Field(None, description="Optional language hint (e.g. 'en', 'hi', 'ta')")
    developer_mode: bool = Field(False, description="Include developer diagnostics")


@router.post(
    '/chat',
    response_model=ChatResponsePayload,
    description="Main natural language interface powered by multi-agent autonomous planning and verified evidence."
)
async def chat_endpoint(payload: ChatRequest, request: Request):
    orchestrator = getattr(request.app.state, 'orchestrator', None)
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI Orchestrator is not initialized")

    return await orchestrator.chat(
        query=payload.message,
        session_id=payload.session_id,
        explicit_location=payload.location.model_dump() if payload.location else None,
        language_hint=payload.language,
        developer_mode=payload.developer_mode,
    )

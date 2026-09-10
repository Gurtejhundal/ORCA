from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field


class CandidatePFZ(BaseModel):
    id: str
    name: str
    distance_km: float | None = None
    geometry: dict[str, Any] | None = None
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = 'INCOIS'


class LocationState(BaseModel):
    lat: float
    lon: float
    name: str | None = None
    source: str = 'user'  # 'coordinates', 'named', 'gps', 'memory'


class ConversationContext(BaseModel):
    """Compact structured conversational memory across turns."""
    session_id: str
    language: str = 'en'
    last_intent: str | None = None
    current_location: LocationState | None = None
    selected_pfz: CandidatePFZ | None = None
    pfz_candidates: list[CandidatePFZ] = Field(default_factory=list)
    requested_time: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    turn_count: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

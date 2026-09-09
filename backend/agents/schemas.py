from typing import Any, Literal
from pydantic import BaseModel, Field


class LocationRef(BaseModel):
    lat: float
    lon: float
    name: str | None = None


class AgentTask(BaseModel):
    id: str
    agent: str
    action: str
    depends_on: list[str] = Field(default_factory=list)
    params: dict[str, Any] = Field(default_factory=dict)


class ExecutionPlan(BaseModel):
    goal: str
    tasks: list[AgentTask] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    id: str
    parameter: str
    value: Any = None
    unit: str | None = None
    location: dict[str, float]
    source: str
    forecast_time: str | None = None
    fetched_at: str
    freshness_minutes: float = 0.0
    quality: str = 'official'
    is_stale: bool = False


class AgentInput(BaseModel):
    session_id: str
    query: str
    intent: str
    location: LocationRef | None = None
    requested_time: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    task: AgentTask = Field(default_factory=lambda: AgentTask(id='t0', agent='base', action='none'))


class AgentOutput(BaseModel):
    agent: str
    status: Literal['success', 'partial', 'failed', 'skipped'] = 'success'
    data: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float = 1.0
    errors: list[str] = Field(default_factory=list)


class MapAction(BaseModel):
    action: Literal[
        'ADD_LAYER',
        'REMOVE_LAYER',
        'CLEAR_LAYER',
        'FOCUS_LOCATION',
        'SHOW_MARKERS',
        'SHOW_HAZARD_ZONE',
        'HIGHLIGHT_REGION',
        'FIT_BOUNDS',
        'DRAW_ROUTE',
        'UPDATE_VESSEL',
        'SHOW_GEOFENCE_WARNING',
    ]
    id: str | None = None
    layer: str | None = None
    lat: float | None = None
    lon: float | None = None
    zoom: int | None = None
    markers: list[dict[str, Any]] | None = None
    data: dict[str, Any] | None = None
    geojson: dict[str, Any] | None = None
    position: dict[str, float] | None = None
    heading: float | None = None
    speed: float | None = None
    title: str | None = None


class IntentOutput(BaseModel):
    intent: str
    language: str = 'en'
    location: dict[str, Any] = Field(default_factory=lambda: {'name': None, 'lat': None, 'lon': None})
    time_expression: str | None = None
    entities: dict[str, Any] = Field(default_factory=dict)
    required_capabilities: list[str] = Field(default_factory=list)
    confidence: float = Field(0.9, ge=0.0, le=1.0)


class ReasoningItem(BaseModel):
    factor: str
    finding: str
    evidence_ids: list[str] = Field(default_factory=list)


class ExplanationOutput(BaseModel):
    answer: str
    reasoning_summary: list[ReasoningItem] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    limitations: str = ''


class ChatResponsePayload(BaseModel):
    session_id: str
    answer: str
    language: str
    intent: str
    location: dict[str, Any] | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    recommended_pfz: dict[str, Any] | None = None
    risk: dict[str, Any] | None = None
    route: dict[str, Any] | None = None
    route_comparison: dict[str, Any] | None = None
    geofence: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    confidence: float
    map_actions: list[MapAction] = Field(default_factory=list)
    status: Literal['success', 'partial', 'failed'] = 'success'
    run_id: str

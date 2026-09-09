from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field, AwareDatetime, field_validator
from shapely.geometry import shape


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)


class Observation(BaseModel):
    parameter: str
    value: float | None = Field(default=None, allow_inf_nan=False)
    unit: str | None = None
    location: Location
    observation_time: AwareDatetime | None = None
    forecast_time: AwareDatetime | None = None
    source: str
    source_reference: str | None = None
    fetched_at: AwareDatetime
    expires_at: AwareDatetime
    quality: str
    is_stale: bool = False
    freshness_minutes: float = 0
    primary_source_available: bool | None = None
    mode: Literal['live', 'demo'] = 'live'
    metadata: dict[str, Any] = Field(default_factory=dict)

    def refreshed(self) -> 'Observation':
        now = utcnow()
        return self.model_copy(update={
            'freshness_minutes': max(0, (now - self.fetched_at).total_seconds() / 60),
            'is_stale': now >= self.expires_at,
        })


class Feature(BaseModel):
    type: Literal['Feature'] = 'Feature'
    id: str | int | None = None
    geometry: dict[str, Any]
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator('geometry')
    @classmethod
    def valid_geometry(cls, value: dict) -> dict:
        kind, coords = value.get('type'), value.get('coordinates')
        polygons = [coords] if kind == 'Polygon' else coords if kind == 'MultiPolygon' else []
        for polygon in polygons:
            for ring in polygon:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise ValueError('GeoJSON polygon rings must be closed')
        geom = shape(value)
        if geom.is_empty or not geom.is_valid:
            raise ValueError('Geometry must be nonempty and valid')
        from shapely import get_coordinates
        for lon, lat in get_coordinates(geom):
            Location(lat=lat, lon=lon)
        return value


class FeatureCollection(BaseModel):
    type: Literal['FeatureCollection'] = 'FeatureCollection'
    features: list[Feature] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class Conditions(BaseModel):
    location: Location
    forecast_time: AwareDatetime
    mode: Literal['live', 'demo']
    status: Literal['ok', 'partial', 'unavailable']
    conditions: dict[str, Observation]
    sources: list[str]
    missing_sources: list[str]
    data_quality: dict[str, Any] = Field(default_factory=dict)


class Zone(BaseModel):
    id: str
    name: str
    geometry: dict[str, Any]
    valid_from: AwareDatetime
    valid_until: AwareDatetime
    source: str
    source_reference: str
    fetched_at: AwareDatetime
    expires_at: AwareDatetime
    mode: Literal['live', 'demo'] = 'live'
    is_stale: bool = False
    freshness_minutes: float = 0
    distance_km: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator('geometry')
    @classmethod
    def valid_geometry(cls, value: dict) -> dict:
        return Feature.valid_geometry(value)


class ZonesResponse(BaseModel):
    mode: str
    status: str
    results: list[Zone]
    user_location: Location | None = None
    missing_sources: list[str] = Field(default_factory=list)
    replay_time: AwareDatetime | None = None


class AlertsResponse(BaseModel):
    mode: str
    status: str
    alerts: list[dict[str, Any]]
    missing_sources: list[str]


class SystemStatus(BaseModel):
    backend: str = 'online'
    database: str
    postgis: str
    cache: str
    mode: str
    sources: dict[str, Any]
    voice: str = 'online'
    llm: str = 'online'
    freshness: dict[str, Any] | None = None


class LayerInfo(BaseModel):
    name: str
    available: bool
    status: str


class ErrorResponse(BaseModel):
    detail: str

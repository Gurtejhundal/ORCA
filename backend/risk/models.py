from typing import Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from backend.schemas.marine import Location

RiskLevel = Literal['LOW', 'MODERATE', 'HIGH', 'EXTREME', 'UNKNOWN']


class RiskFactor(BaseModel):
    factor: str
    contribution: int = Field(..., ge=0, le=100, description="Points contribution to risk score")
    finding: str
    evidence_ids: list[str] = Field(default_factory=list)


class OfficialOverride(BaseModel):
    override: bool = True
    type: str  # e.g., CYCLONE_WARNING, HIGH_WAVE_ADVISORY, RESTRICTED_ZONE
    source: str
    description: str


class VesselProfile(BaseModel):
    id: str
    name: str
    max_recommended_wave_height: float | None = None
    max_recommended_wind_speed: float | None = None
    risk_sensitivity: float = 1.0  # multiplier on operational risk
    description: str = "Configurable vessel parameters"


class RiskAssessment(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Deterministic risk score from 0 (safest) to 100 (extreme hazard)")
    level: RiskLevel
    factors: list[RiskFactor] = Field(default_factory=list)
    official_overrides: list[OfficialOverride] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    missing_critical_data: list[str] = Field(default_factory=list)
    timestamp: str | None = None


class SafetyAnalysisRequest(BaseModel):
    location: Location
    requested_time: datetime | None = None
    vessel_profile: str = 'small_fishing_boat'


class SafetyAnalysisResponse(BaseModel):
    risk: RiskAssessment
    confidence: float
    factors: list[RiskFactor] = Field(default_factory=list)
    official_overrides: list[OfficialOverride] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)


class RankedPFZCandidate(BaseModel):
    pfz_id: str
    name: str
    distance_km: float
    risk_score: int
    risk_level: RiskLevel
    ranking_score: int = Field(..., ge=0, le=100, description="Overall suitability score (100 = optimal safe candidate)")
    rank: int
    factors: list[RiskFactor] = Field(default_factory=list)
    excluded: bool = False
    exclusion_reasons: list[str] = Field(default_factory=list)
    geometry: dict[str, Any] | None = None
    source: str = 'INCOIS'


class PFZRankRequest(BaseModel):
    origin: Location
    requested_time: datetime | None = None
    limit: int = Field(5, ge=1, le=20)
    vessel_profile: str = 'small_fishing_boat'


class PFZRankResponse(BaseModel):
    recommended: RankedPFZCandidate | None = None
    ranked_candidates: list[RankedPFZCandidate] = Field(default_factory=list)
    excluded_candidates: list[RankedPFZCandidate] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float

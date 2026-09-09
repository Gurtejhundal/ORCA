from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LatLon(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)


class RouteRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    vessel_type: str = "small_fishing_boat"
    optimization_preference: str = "safety_first"  # "safety_first", "balanced", "shortest"
    vessel_speed_knots: Optional[float] = None
    avoid_restricted: bool = True
    avoid_hazards: bool = True


class RouteSegment(BaseModel):
    start: List[float]  # [lat, lon]
    end: List[float]    # [lat, lon]
    distance_km: float
    wave_height_m: float
    wind_speed_kts: float
    risk_score: float
    risk_level: str


class RouteResult(BaseModel):
    route_id: str
    origin: List[float]       # [lat, lon]
    destination: List[float]  # [lat, lon]
    total_distance_km: float
    estimated_duration_hours: float
    average_speed_kts: float
    safety_score: float       # 0 - 100, 100 = completely safe
    overall_risk_score: float # 0 - 100, 0 = no risk
    overall_risk_level: str   # LOW, MODERATE, HIGH, EXTREME
    geojson: Dict[str, Any]   # Standard GeoJSON Feature with LineString coordinates [lon, lat]
    coordinates: List[List[float]] # [lat, lon] order
    segments: List[RouteSegment] = []
    warnings: List[str] = []
    avoided_hazards: List[str] = []
    calculation_time_ms: float = 0.0


class RouteComparison(BaseModel):
    shortest_route: RouteResult
    safe_route: RouteResult
    detour_distance_km: float
    detour_percentage: float
    extra_duration_hours: float
    risk_reduction_score: float
    risk_reduction_percentage: float
    trade_off_explanation: str


class RerouteRequest(BaseModel):
    vessel_id: str
    current_position: LatLon
    destination: LatLon
    vessel_type: str = "small_fishing_boat"
    vessel_speed_knots: Optional[float] = None
    reason: str = "hazard_detected"

"""Pydantic schemas and models for Geofencing, Proximity and Trajectory Prediction."""
from __future__ import annotations
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from backend.routing.models import LatLon


class GeofenceCheckRequest(BaseModel):
    position: LatLon
    heading_degrees: Optional[float] = Field(None, ge=0.0, le=360.0)
    speed_knots: Optional[float] = Field(None, ge=0.0)
    vessel_id: Optional[str] = "vessel-1"
    lookahead_minutes: List[int] = [15, 30, 60]


class ProjectedPosition(BaseModel):
    minutes: int
    lat: float
    lon: float
    distance_km: float


class BoundaryDistance(BaseModel):
    zone_id: str
    zone_name: str
    zone_type: str  # restricted, hazard, protected
    severity: str   # forbidden, elevated, caution
    distance_km: float
    is_inside: bool
    bearing_degrees: float
    projected_breach_minutes: Optional[int] = None


class GeofenceWarning(BaseModel):
    level: Literal["INFO", "CAUTION", "WARNING", "CRITICAL"]
    zone_id: str
    zone_name: str
    zone_type: str
    message: str
    recommended_heading_degrees: Optional[float] = None
    time_to_breach_minutes: Optional[int] = None


class GeofenceStatus(BaseModel):
    status: Literal["SAFE", "CAUTION", "WARNING", "BREACH"]
    current_position: LatLon
    current_heading: Optional[float] = None
    current_speed_knots: Optional[float] = None
    boundaries: List[BoundaryDistance] = []
    warnings: List[GeofenceWarning] = []
    projected_trajectory: List[ProjectedPosition] = []
    recommended_action: Optional[str] = None
    timestamp: str

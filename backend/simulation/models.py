"""Pydantic schemas and models for Vessel Simulation and Dynamic Rerouting."""
from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.routing.models import LatLon, RouteResult
from backend.geofence.models import GeofenceStatus


class SimulationConfig(BaseModel):
    route_id: str
    vessel_id: str = "vessel-1"
    vessel_type: str = "small_fishing_boat"
    speed_knots: float = 12.0
    step_interval_minutes: float = 5.0
    simulate_hazard_emergence: bool = False


class SimulationState(BaseModel):
    simulation_id: str
    vessel_id: str
    route_id: str
    current_position: LatLon
    current_heading: float
    speed_knots: float
    step_count: int
    elapsed_time_minutes: float
    distance_traveled_km: float
    remaining_distance_km: float
    progress_percentage: float
    is_completed: bool
    geofence_status: Optional[GeofenceStatus] = None
    active_warnings: List[str] = []
    route_needs_recalculation: bool = False
    recalculated_route: Optional[RouteResult] = None


class SimulationStepResult(BaseModel):
    state: SimulationState
    map_actions: List[Dict[str, Any]] = []
    alerts: List[Dict[str, Any]] = []

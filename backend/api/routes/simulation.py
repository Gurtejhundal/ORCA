"""Vessel Simulation and Dynamic Movement API Endpoints."""
from __future__ import annotations
from typing import Literal, Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field, model_validator
from backend.routing.models import LatLon, RouteRequest, RouteResult
from backend.routing.route_service import MarineRouteService
from backend.simulation.models import SimulationConfig, SimulationState, SimulationStepResult
from backend.simulation.manager import SimulationManager

router = APIRouter(prefix="/api/v1/simulation", tags=["Vessel Simulation & Dynamic Tracking"])


class StartSimulationRequest(BaseModel):
    route_id: Optional[str] = Field(None, max_length=128)
    vessel_id: str = Field("vessel-1", min_length=1, max_length=128)
    vessel_type: Literal["small_fishing_boat", "medium_fishing_vessel", "generic_vessel"] = "small_fishing_boat"
    speed_knots: float = Field(12.0, gt=0, le=100)
    step_interval_minutes: float = Field(5.0, gt=0, le=60)
    simulate_hazard_emergence: bool = False
    origin: Optional[LatLon] = None
    destination: Optional[LatLon] = None

    @model_validator(mode='after')
    def complete_route_coordinates(self):
        if (self.origin is None) != (self.destination is None):
            raise ValueError('origin and destination must be provided together')
        if self.route_id and self.origin is None:
            raise ValueError('route_id lookup is unavailable; provide origin and destination')
        return self


def get_simulation_manager(request: Request) -> SimulationManager:
    manager = getattr(request.app.state, "simulation_manager", None)
    if not manager:
        route_svc = getattr(request.app.state, "route_service", None)
        if not route_svc:
            risk_svc = getattr(request.app.state, "risk_service", None)
            route_svc = MarineRouteService(risk_svc)
            request.app.state.route_service = route_svc
        geofence_svc = getattr(request.app.state, "geofence_service", None)
        manager = SimulationManager(route_svc, geofence_svc)
        request.app.state.simulation_manager = manager
    return manager


@router.post("/start", response_model=SimulationState, summary="Start a new vessel route simulation session")
async def start_simulation(payload: StartSimulationRequest, request: Request):
    manager = get_simulation_manager(request)

    # Resolve or compute route
    route: Optional[RouteResult] = None
    if payload.origin and payload.destination:
        route_req = RouteRequest(
            origin=payload.origin,
            destination=payload.destination,
            vessel_type=payload.vessel_type,
            vessel_speed_knots=payload.speed_knots,
            optimization_preference="safety_first",
        )
        route = await manager.route_service.calculate_route(route_req)
    else:
        # Default demo route if none specified
        route_req = RouteRequest(
            origin=LatLon(lat=10.767, lon=79.872),
            destination=LatLon(lat=10.87, lon=80.1),
            vessel_type=payload.vessel_type,
            vessel_speed_knots=payload.speed_knots,
            optimization_preference="safety_first",
        )
        route = await manager.route_service.calculate_route(route_req)

    cfg = SimulationConfig(
        route_id=route.route_id,
        vessel_id=payload.vessel_id,
        vessel_type=payload.vessel_type,
        speed_knots=payload.speed_knots,
        step_interval_minutes=payload.step_interval_minutes,
        simulate_hazard_emergence=payload.simulate_hazard_emergence,
    )
    return manager.create_simulation(cfg, route)


@router.post("/{simulation_id}/step", response_model=SimulationStepResult, summary="Advance vessel simulation by one step interval")
async def step_simulation(simulation_id: str, request: Request):
    manager = get_simulation_manager(request)
    try:
        return await manager.step_simulation(simulation_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{simulation_id}", response_model=SimulationState, summary="Get current status of vessel simulation session")
async def get_simulation_state(simulation_id: str, request: Request):
    manager = get_simulation_manager(request)
    state = manager.get_simulation(simulation_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Simulation {simulation_id} not found")
    return state


@router.post("/{simulation_id}/stop", summary="Stop and terminate a vessel simulation session")
async def stop_simulation(simulation_id: str, request: Request):
    manager = get_simulation_manager(request)
    stopped = manager.stop_simulation(simulation_id)
    if not stopped:
        raise HTTPException(status_code=404, detail=f"Simulation {simulation_id} not found")
    return {"status": "stopped", "simulation_id": simulation_id}

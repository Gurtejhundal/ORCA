"""Risk-Aware Marine Routing and Route Comparison API Endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from backend.routing.models import RouteRequest, RouteResult, RouteComparison, RerouteRequest
from backend.routing.route_service import MarineRouteService

router = APIRouter(prefix="/api/v1/routes", tags=["Marine Routing & Optimization"])


def get_route_service(request: Request) -> MarineRouteService:
    service = getattr(request.app.state, "route_service", None)
    if not service:
        risk_svc = getattr(request.app.state, "risk_service", None)
        service = MarineRouteService(risk_svc)
        request.app.state.route_service = service
    return service


@router.post(
    "/safe",
    response_model=RouteResult,
    summary="Compute risk-aware A* safe marine route with obstacle avoidance",
)
async def get_safe_route(payload: RouteRequest, request: Request):
    svc = get_route_service(request)
    return await svc.calculate_route(payload)


@router.post(
    "/compare",
    response_model=RouteComparison,
    summary="Compare shortest navigable route vs. recommended safe detour route",
)
async def compare_routes_endpoint(payload: RouteRequest, request: Request):
    svc = get_route_service(request)
    return await svc.compare_routes(payload)


@router.post(
    "/reroute",
    response_model=RouteResult,
    summary="Recalculate safe route from current vessel position due to hazard detection",
)
async def reroute_vessel(payload: RerouteRequest, request: Request):
    svc = get_route_service(request)
    req = RouteRequest(
        origin=payload.current_position,
        destination=payload.destination,
        vessel_type=payload.vessel_type,
        vessel_speed_knots=payload.vessel_speed_knots,
        optimization_preference="safety_first",
        avoid_hazards=True,
    )
    return await svc.calculate_route(req)

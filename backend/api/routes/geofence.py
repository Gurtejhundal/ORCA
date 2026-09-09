"""Geofence Verification and Dead Reckoning Trajectory Breach Endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request
from backend.geofence.models import GeofenceCheckRequest, GeofenceStatus
from backend.geofence.service import GeofenceService

router = APIRouter(prefix="/api/v1/geofence", tags=["Geofencing & Boundary Warnings"])


def get_geofence_service(request: Request) -> GeofenceService:
    service = getattr(request.app.state, "geofence_service", None)
    if not service:
        marine_svc = getattr(request.app.state, "service", None)
        service = GeofenceService(marine_svc)
        request.app.state.geofence_service = service
    return service


@router.post(
    "/check",
    response_model=GeofenceStatus,
    summary="Check vessel proximity to boundaries and project dead reckoning trajectory breaches",
)
async def check_geofence_endpoint(payload: GeofenceCheckRequest, request: Request):
    svc = get_geofence_service(request)
    return await svc.check_geofence(payload)

"""Safety Analysis and Safe PFZ Ranking API Endpoints."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from backend.risk.models import (
    SafetyAnalysisRequest,
    SafetyAnalysisResponse,
    PFZRankRequest,
    PFZRankResponse,
)
from backend.risk.service import MarineRiskService

router = APIRouter(prefix="/api/v1", tags=["Marine Safety & Risk Engine"])


def get_risk_service(request: Request) -> MarineRiskService:
    service = getattr(request.app.state, "risk_service", None)
    if not service:
        # Fallback or initialize with marine service
        marine_svc = getattr(request.app.state, "service", None)
        service = MarineRiskService(marine_svc)
        request.app.state.risk_service = service
    return service


@router.post(
    "/safety/analyze",
    response_model=SafetyAnalysisResponse,
    summary="Deterministic multi-factor marine safety risk assessment",
)
async def analyze_marine_safety(payload: SafetyAnalysisRequest, request: Request):
    risk_service = get_risk_service(request)
    return await risk_service.analyze_safety(
        location=payload.location,
        requested_time=payload.requested_time,
        vessel_profile=payload.vessel_profile,
    )


@router.post(
    "/pfz/rank-safe",
    response_model=PFZRankResponse,
    summary="Rank Potential Fishing Zones with hard safety gates and multi-factor scoring",
)
async def rank_safe_pfz(payload: PFZRankRequest, request: Request):
    risk_service = get_risk_service(request)
    return await risk_service.rank_safe_pfz(
        origin=payload.origin,
        requested_time=payload.requested_time,
        limit=payload.limit,
        vessel_profile=payload.vessel_profile,
    )

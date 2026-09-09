import asyncio
from datetime import date as CalendarDate, datetime, time as ClockTime, timezone
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import AwareDatetime
from backend.schemas.marine import (Location, Conditions, ZonesResponse, AlertsResponse,
                                    FeatureCollection, SystemStatus, LayerInfo, ErrorResponse)
from backend.services.marine import MarineService, LAYERS
from backend.geospatial.utils import parse_bbox
from backend.services.freshness import DataFreshnessSummary

router = APIRouter(prefix='/api/v1', responses={422: {'description': 'Invalid coordinates, time, or filters'},
    503: {'model': ErrorResponse, 'description': 'Dependency unavailable'},
    504: {'model': ErrorResponse, 'description': 'Request deadline exceeded'}})
Lat = Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False, description='WGS84 latitude')]
Lon = Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False, description='WGS84 longitude')]
At = Annotated[AwareDatetime | None, Query(description='ISO 8601 timestamp with timezone; defaults to now or labelled replay clock')]


def service(request: Request) -> MarineService:
    return request.app.state.service


def filters(lat: float | None, lon: float | None, radius: float | None, bbox: str | None):
    if (lat is None) != (lon is None) or radius is not None and lat is None:
        raise HTTPException(422, 'lat and lon must be supplied together; radius requires coordinates')
    try:
        return Location(lat=lat, lon=lon) if lat is not None else None, parse_bbox(bbox) if bbox else None
    except ValueError as exc:
        raise HTTPException(422, 'Invalid coordinates or bbox (west,south,east,north)') from exc


@router.get('/system/status', response_model=SystemStatus, tags=['System'], description='Checks database/PostGIS, voice, LLM, cached source probes, and data freshness.')
async def status(request: Request, svc: MarineService = Depends(service)):
    db = await svc.repo.db.health()
    sources = {'demo': {'status': 'offline_replay'}} if svc.settings.demo_mode else await svc.registry.health()
    if not svc.settings.demo_mode:
        sources['INCOIS PFZ'] = await svc.registry.cache.load('health:pfz', 300, svc.pfz_source.health_check)
        sources['marine_alerts'] = await svc.alerts_source.health_check()

    voice_svc = getattr(request.app.state, 'voice_service', None)
    voice_status = 'configured_unverified' if (voice_svc and voice_svc.bhashini.is_configured) else 'browser_fallback'
    llm_prov = getattr(request.app.state, 'llm', None)
    from backend.llm.provider import MockLLMProvider
    llm_status = 'mock' if isinstance(llm_prov, MockLLMProvider) else 'configured_unverified' if llm_prov else 'unavailable'

    sources['voice'] = {'status': voice_status, 'provider': 'bhashini_or_browser'}
    sources['llm'] = {'status': llm_status}

    freshness_svc = svc.freshness
    freshness_summary = freshness_svc.get_summary()

    return SystemStatus(
        **db,
        cache='online (bounded process memory)',
        mode=svc.mode,
        sources=sources,
        voice=voice_status,
        llm=llm_status,
        freshness=freshness_summary.model_dump(),
    )


@router.get('/system/freshness', response_model=DataFreshnessSummary, tags=['System'], description='Centralized data freshness summary with dataset-specific policies.')
async def freshness_endpoint(request: Request, svc: MarineService = Depends(service)):
    freshness_svc = svc.freshness
    return freshness_svc.get_summary()


@router.get('/pfz/nearest', response_model=ZonesResponse, tags=['PFZ'], description='Nearest valid PFZ geometries using PostGIS geography meters, with geodesic local-export fallback. Distance is not a safe route.')
async def nearest(lat: Lat, lon: Lon, limit: Annotated[int, Query(ge=1, le=100)] = 3,
                  date: CalendarDate | None = None, svc: MarineService = Depends(service)):
    instant = datetime.combine(date, ClockTime(12), timezone.utc) if date else None
    return await svc.pfz(instant, Location(lat=lat, lon=lon), limit=limit)


@router.get('/pfz', response_model=ZonesResponse, tags=['PFZ'], description='Valid PFZs at UTC noon on the chosen date; without date uses current/replay instant. Radius is kilometers; bbox west,south,east,north.')
async def pfz(date: CalendarDate | None = None, bbox: str | None = None,
              lat: Annotated[float | None, Query(ge=-90, le=90, allow_inf_nan=False)] = None,
              lon: Annotated[float | None, Query(ge=-180, le=180, allow_inf_nan=False)] = None,
              radius: Annotated[float | None, Query(gt=0, le=2000)] = None,
              limit: Annotated[int, Query(ge=1, le=1000)] = 100, svc: MarineService = Depends(service)):
    point, bounds = filters(lat, lon, radius, bbox)
    return await svc.pfz(datetime.combine(date, ClockTime(12), timezone.utc) if date else None, point, radius, bounds, limit)


@router.get('/ocean/conditions', response_model=Conditions, tags=['Conditions'], description='Marine values with individual units, source, validity, retrieval time and freshness. Missing values are null; failures return partial data.')
async def ocean(lat: Lat, lon: Lon, time: At = None, svc: MarineService = Depends(service)):
    return await svc.conditions('ocean', Location(lat=lat, lon=lon), time)


@router.get('/weather', response_model=Conditions, tags=['Conditions'], description='Weather forecast at coordinates. WMO weather_code describes general weather; thunderstorm flag is explicitly derived from it.')
async def weather(lat: Lat, lon: Lon, time: At = None, svc: MarineService = Depends(service)):
    return await svc.conditions('weather', Location(lat=lat, lon=lon), time)


@router.get('/alerts', response_model=AlertsResponse, tags=['Alerts'], description='Spatially relevant valid hazard records. Unavailable warning feeds are explicit; an empty result never certifies safe conditions.')
async def alerts(lat: Lat, lon: Lon, radius: Annotated[float, Query(gt=0, le=2000)] = 100,
                 svc: MarineService = Depends(service)):
    return await svc.alerts(Location(lat=lat, lon=lon), radius)


@router.get('/map/layers', response_model=list[LayerInfo], tags=['Map'], description='Actual layer availability at optional coordinates. Scalar marine layers represent sampled points, not interpolated raster coverage.')
async def layers(lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
                 lon: Annotated[float | None, Query(ge=-180, le=180)] = None, svc: MarineService = Depends(service)):
    point, _ = filters(lat, lon, None, None)
    collections = await asyncio.gather(*(svc.layer(name, point, None, None) for name in LAYERS))
    return [LayerInfo(name=name, available=bool(collection.features), status=collection.metadata.get('status', 'unavailable'))
            for name, collection in zip(LAYERS, collections)]


@router.get('/map/layer/{layer_name}', response_model=FeatureCollection, tags=['Map'], description='Validated WGS84 GeoJSON with provenance on each feature. Point sampling requires coordinates.')
async def layer(layer_name: Literal['pfz','sst','chlorophyll','waves','currents','hazards','restricted','protected'],
                lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
                lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
                bbox: str | None = None, time: At = None, svc: MarineService = Depends(service)):
    point, bounds = filters(lat, lon, None, bbox)
    return await svc.layer(layer_name, point, time, bounds)

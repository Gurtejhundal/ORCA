import asyncio
import logging
from typing import Any
from datetime import datetime
from backend.agents.schemas import EvidenceItem
from backend.risk.config import RISK_CONFIG
from backend.risk.models import (
    PFZRankResponse,
    RankedPFZCandidate,
    SafetyAnalysisResponse,
)
from backend.risk.scoring import calculate_risk_assessment
from backend.geospatial.utils import point_in_polygon
from backend.schemas.marine import Location, utcnow
from backend.services.marine import MarineService

logger = logging.getLogger(__name__)


class MarineRiskService:
    """Service providing deterministic marine risk analysis and safe PFZ ranking."""

    def __init__(self, marine_service: MarineService | None = None):
        if marine_service is None:
            from backend.core.config import Settings
            from backend.cache.memory import MemoryCache
            from backend.data_sources.registry import SourceRegistry
            from backend.database.session import Database
            from backend.database.repository import Repository
            cfg = Settings(demo_mode=True)
            db = Database(None)
            cache = MemoryCache(50)
            registry = SourceRegistry(cache)
            repo = Repository(db)
            marine_service = MarineService(cfg, registry, repo)
        self.service = marine_service

    async def analyze_safety(
        self,
        location: Location | dict | Any,
        requested_time: datetime | None = None,
        vessel_profile: str = 'small_fishing_boat',
    ) -> SafetyAnalysisResponse:
        if hasattr(location, "location"):
            req = location
            loc = req.location if isinstance(req.location, Location) else Location(**req.location)
            vessel_profile = req.vessel_profile
            requested_time = req.requested_time
        elif isinstance(location, Location):
            loc = location
        else:
            loc = Location(**location)

        # 1. Fetch conditions and alerts concurrently
        weather_task = self.service.conditions('weather', loc, requested_time)
        ocean_task = self.service.conditions('ocean', loc, requested_time)
        alerts_task = self.service.alerts(loc, radius=100.0)
        zones_task = self.service.zones(loc, radius=50.0)

        w_resp, o_resp, a_resp, z_resp = await asyncio.gather(
            weather_task, ocean_task, alerts_task, zones_task, return_exceptions=True
        )

        evidence: list[EvidenceItem] = []
        warnings: list[str] = []

        if not isinstance(w_resp, Exception):
            warnings.extend(w_resp.missing_sources)
            for p, obs in w_resp.conditions.items():
                if obs.value is not None:
                    evidence.append(
                        EvidenceItem(
                            id=f'ev_wx_{p}',
                            parameter=p,
                            value=round(obs.value, 1) if isinstance(obs.value, float) else obs.value,
                            unit=obs.unit,
                            location={'lat': loc.lat, 'lon': loc.lon},
                            source=obs.source,
                            forecast_time=obs.forecast_time.isoformat() if obs.forecast_time else None,
                            fetched_at=obs.fetched_at.isoformat() if obs.fetched_at else utcnow().isoformat(),
                            quality=obs.quality,
                            is_stale=obs.is_stale,
                        )
                    )

        if not isinstance(o_resp, Exception):
            warnings.extend(o_resp.missing_sources)
            for p, obs in o_resp.conditions.items():
                if obs.value is not None:
                    evidence.append(
                        EvidenceItem(
                            id=f'ev_oc_{p}',
                            parameter=p,
                            value=round(obs.value, 2) if isinstance(obs.value, float) else obs.value,
                            unit=obs.unit,
                            location={'lat': loc.lat, 'lon': loc.lon},
                            source=obs.source,
                            forecast_time=obs.forecast_time.isoformat() if obs.forecast_time else None,
                            fetched_at=obs.fetched_at.isoformat() if obs.fetched_at else utcnow().isoformat(),
                            quality=obs.quality,
                            is_stale=obs.is_stale,
                        )
                    )

        alerts_list = a_resp.alerts if not isinstance(a_resp, Exception) else []
        applicable_alerts = [
            alert for alert in alerts_list
            if not alert.get('geometry') or point_in_polygon(loc, alert['geometry'])
        ]
        zones_list = z_resp if not isinstance(z_resp, Exception) else []
        zone_intersections = [z for z in zones_list if point_in_polygon(loc, z['geometry'])]
        for name, response in [('weather', w_resp), ('ocean', o_resp), ('alerts', a_resp), ('boundaries', z_resp)]:
            if isinstance(response, Exception):
                warnings.append(f'{name} unavailable')
        alerts_unavailable = isinstance(a_resp, Exception) or a_resp.status == 'unavailable'
        if alerts_unavailable:
            warnings.append('Official alert coverage unavailable; no all-clear can be issued')

        # 2. Compute risk assessment
        risk_assessment = calculate_risk_assessment(
            evidence_list=evidence,
            alerts=applicable_alerts,
            zone_intersections=zone_intersections,
            vessel_profile_id=vessel_profile,
            requested_time=requested_time,
            demo_mode=self.service.settings.demo_mode,
        )
        if not self.service.settings.demo_mode and (alerts_unavailable or not zones_list):
            risk_assessment.missing_critical_data.append('verified_alert_and_boundary_coverage')
            risk_assessment.confidence = min(risk_assessment.confidence, 0.45)
            if risk_assessment.level in ('LOW', 'MODERATE'):
                risk_assessment.level = 'UNKNOWN'

        return SafetyAnalysisResponse(
            risk=risk_assessment,
            confidence=risk_assessment.confidence,
            factors=risk_assessment.factors,
            official_overrides=risk_assessment.official_overrides,
            warnings=list(set(warnings)),
            evidence=[e.model_dump() for e in evidence],
        )

    async def rank_safe_pfz(
        self,
        origin: Location | dict,
        requested_time: datetime | None = None,
        limit: int = 5,
        vessel_profile: str = 'small_fishing_boat',
    ) -> PFZRankResponse:
        orig = origin if isinstance(origin, Location) else Location(**origin)

        # 1. Fetch PFZ candidates near origin
        pfz_resp = await self.service.pfz(time=requested_time, location=orig, radius=150.0, limit=limit * 2)
        candidates = pfz_resp.results

        # Fallback to demo candidate zones if empty in demo mode
        if not candidates and self.service.settings.demo_mode:
            from backend.data_sources.demo import synthetic_pfz
            candidates = synthetic_pfz()

        # 2. Fetch active hazard zones for intersection checks
        zones = await self.service.zones(orig, radius=200.0)

        ranked: list[RankedPFZCandidate] = []
        excluded: list[RankedPFZCandidate] = []
        all_evidence: list[dict] = []
        confidences: list[float] = []

        for cand in candidates:
            cand_geom = cand.geometry
            if not cand_geom:
                continue
            from shapely.geometry import shape
            from pyproj import Geod
            point = shape(cand_geom).representative_point()
            lon, lat = point.x, point.y
            dist = cand.distance_km
            if dist is None:
                dist = abs(Geod(ellps='WGS84').inv(orig.lon, orig.lat, lon, lat)[2]) / 1000

            cand_loc = Location(lat=lat, lon=lon)

            # Check exclusions (intersection with forbidden/restricted zone or extreme hazard)
            cand_exclusions = []
            cand_zone_intersections = []
            if cand_geom:
                from shapely.geometry import shape
                cand_shape = shape(cand_geom)
                for z in zones:
                    if cand_shape.intersects(shape(z['geometry'])):
                        cand_zone_intersections.append(z)
                        ztype = z.get('type') or z.get('category')
                        if ztype in ('restricted', 'prohibited') or z.get('severity') == 'forbidden':
                            cand_exclusions.append(f"Intersects restricted zone '{z.get('name')}'")

            # Assess conditions & risk at candidate zone
            safety_analysis = await self.analyze_safety(cand_loc, requested_time, vessel_profile)
            cand_risk = safety_analysis.risk
            all_evidence.extend(safety_analysis.evidence)
            if cand_risk.level in ('UNKNOWN', 'HIGH', 'EXTREME'):
                cand_exclusions.append(f'Risk level {cand_risk.level}; safe navigation cannot be recommended')
            if cand.is_stale and not self.service.settings.demo_mode:
                cand_exclusions.append('PFZ advisory is stale')

            # Exclude if severe cyclone override
            if any(o.type == 'CYCLONE_OR_SEVERE_WEATHER_WARNING' for o in cand_risk.official_overrides):
                cand_exclusions.append("Zone intersects active severe cyclone advisory")

            # Calculate composite suitability score (0-100)
            # Weights: Safety 40%, Distance 25%, Forecast 15%, SST/Env 10%, Confidence 10%
            safety_score = 100 - cand_risk.score
            distance_score = max(0, min(100, int(100 - (dist * 1.2))))
            forecast_score = 80 if cand_risk.level in ('LOW', 'MODERATE') else 30
            env_score = 0  # No validated thermal/plankton suitability model is configured.
            confidence_score = int(cand_risk.confidence * 100)

            composite_score = int(round(
                (0.40 * safety_score) +
                (0.25 * distance_score) +
                (0.15 * forecast_score) +
                (0.10 * env_score) +
                (0.10 * confidence_score)
            ))

            candidate_obj = RankedPFZCandidate(
                pfz_id=cand.id,
                name=cand.name,
                distance_km=round(dist, 1),
                risk_score=cand_risk.score,
                risk_level=cand_risk.level,
                ranking_score=max(0, min(100, composite_score)),
                rank=0,
                factors=cand_risk.factors,
                excluded=bool(cand_exclusions),
                exclusion_reasons=cand_exclusions,
                geometry=cand_geom,
                source=cand.source,
            )

            if cand_exclusions:
                excluded.append(candidate_obj)
            else:
                ranked.append(candidate_obj)
                confidences.append(cand_risk.confidence)

        # 3. Sort ranked candidates by ranking_score descending
        ranked.sort(key=lambda c: (-c.ranking_score, c.risk_score, c.distance_km))
        for idx, r in enumerate(ranked):
            r.rank = idx + 1

        recommended = ranked[0] if ranked else None
        avg_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.0

        return PFZRankResponse(
            recommended=recommended,
            ranked_candidates=ranked[:limit],
            excluded_candidates=excluded,
            evidence=all_evidence,
            confidence=avg_confidence,
        )

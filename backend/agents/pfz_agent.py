from datetime import datetime
from typing import Any
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.schemas.marine import Location, utcnow
from backend.services.marine import MarineService


class PFZAgent(BaseAgent):
    name = 'pfz_agent'
    allowed_actions = ['find_candidates', 'get_zone_details']

    def __init__(self, marine_service: MarineService):
        self.service = marine_service

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        action = input_data.task.action
        loc = input_data.location
        req_time = (
            datetime.fromisoformat(input_data.requested_time)
            if input_data.requested_time
            else None
        )

        marine_loc = Location(lat=loc.lat, lon=loc.lon) if loc else None
        limit = input_data.task.params.get('limit', 5)
        radius = input_data.task.params.get('radius', 150.0)

        if action == 'find_candidates':
            reference_only = False
            resp = await self.service.pfz(
                time=req_time, location=marine_loc, radius=radius, limit=limit
            )
            warnings = list(resp.missing_sources)
            if not resp.results and marine_loc and radius is not None:
                resp = await self.service.pfz(
                    time=req_time, location=marine_loc, radius=None, limit=limit
                )
                warnings.extend(resp.missing_sources)
                if resp.results:
                    warnings.append(
                        f'No current PFZ found within {radius:g} km; showing nearest valid official PFZ advisories.'
                    )
            if not resp.results and req_time and req_time > utcnow() and marine_loc:
                current_resp = await self.service.pfz(
                    time=None, location=marine_loc, radius=None, limit=limit
                )
                warnings.extend(current_resp.missing_sources)
                if current_resp.results:
                    resp = current_resp
                    reference_only = True
                    latest_valid_until = max(z.valid_until for z in current_resp.results)
                    warnings.append(
                        'No INCOIS PFZ advisory is published for the requested future time. '
                        f'Showing the latest currently valid advisory for reference only; it expires {latest_valid_until.isoformat()}.'
                    )
            zones = resp.results
            candidates = []
            evidence = []

            for idx, z in enumerate(zones):
                cand = {
                    'id': z.id,
                    'name': z.name,
                    'distance_km': z.distance_km,
                    'valid_from': z.valid_from.isoformat() if z.valid_from else None,
                    'valid_until': z.valid_until.isoformat() if z.valid_until else None,
                    'source': z.source,
                    'source_reference': z.source_reference,
                    'geometry': z.geometry,
                    'reference_only': reference_only,
                    'valid_for_requested_time': not reference_only,
                }
                candidates.append(cand)

                # Evidence for candidate distance
                if z.distance_km is not None and loc:
                    evidence.append(
                        EvidenceItem(
                            id=f'ev_pfz_dist_{z.id}',
                            parameter='pfz_distance',
                            value=round(z.distance_km, 1),
                            unit='km',
                            location={'lat': loc.lat, 'lon': loc.lon},
                            source=z.source,
                            forecast_time=z.valid_from.isoformat() if z.valid_from else None,
                            fetched_at=z.fetched_at.isoformat() if hasattr(z, 'fetched_at') and z.fetched_at else utcnow().isoformat(),
                            freshness_minutes=getattr(z, 'freshness_minutes', 0.0) or 0.0,
                            quality='official_reference_only' if reference_only else 'official',
                            is_stale=getattr(z, 'is_stale', False) or False,
                        )
                    )

            status = 'partial' if reference_only else 'success' if candidates else 'partial' if not resp.missing_sources else 'failed'
            return AgentOutput(
                agent=self.name,
                status=status,
                data={'candidates': candidates, 'count': len(candidates)},
                evidence=evidence,
                warnings=list(dict.fromkeys(warnings)),
                confidence=0.95 if candidates else 0.5,
                errors=list(dict.fromkeys(warnings)) if not candidates else [],
            )

        elif action == 'get_zone_details':
            zone_id = input_data.task.params.get('zone_id')
            resp = await self.service.pfz(time=req_time, location=marine_loc, limit=50)
            target = next((z for z in resp.results if z.id == zone_id), None)
            if not target:
                return AgentOutput(
                    agent=self.name,
                    status='failed',
                    errors=[f"PFZ zone '{zone_id}' not found"],
                    confidence=0.0,
                )

            return AgentOutput(
                agent=self.name,
                status='success',
                data={'zone': target.model_dump(mode='json')},
                confidence=0.95,
            )

        return AgentOutput(agent=self.name, status='skipped')

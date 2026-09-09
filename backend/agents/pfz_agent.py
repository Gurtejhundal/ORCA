from datetime import datetime
from typing import Any
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.schemas.marine import Location
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
            resp = await self.service.pfz(
                time=req_time, location=marine_loc, radius=radius, limit=limit
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
                            fetched_at=z.fetched_at.isoformat() if hasattr(z, 'fetched_at') and z.fetched_at else datetime.utcnow().isoformat(),
                            freshness_minutes=getattr(z, 'freshness_minutes', 0.0) or 0.0,
                            quality='official',
                            is_stale=getattr(z, 'is_stale', False) or False,
                        )
                    )

            status = 'success' if candidates else 'partial' if not resp.missing_sources else 'failed'
            return AgentOutput(
                agent=self.name,
                status=status,
                data={'candidates': candidates, 'count': len(candidates)},
                evidence=evidence,
                warnings=resp.missing_sources,
                confidence=0.95 if candidates else 0.5,
                errors=resp.missing_sources if not candidates else [],
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

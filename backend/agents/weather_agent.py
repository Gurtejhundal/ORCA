import asyncio
from datetime import datetime
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.schemas.marine import Location
from backend.services.marine import MarineService


class WeatherAgent(BaseAgent):
    name = 'weather_agent'
    allowed_actions = ['conditions_for_location', 'conditions_for_candidates']

    def __init__(self, marine_service: MarineService):
        self.service = marine_service

    async def _fetch_at_location(self, loc: Location, req_time: datetime | None, tag: str = 'origin') -> tuple[dict, list[EvidenceItem], list[str]]:
        conditions = await self.service.conditions('weather', loc, req_time)
        evidence = []
        warnings = list(conditions.missing_sources)

        for param_name, obs in conditions.conditions.items():
            if obs.value is not None:
                evidence.append(
                    EvidenceItem(
                        id=f'ev_wx_{tag}_{param_name}',
                        parameter=param_name,
                        value=round(obs.value, 1) if isinstance(obs.value, float) else obs.value,
                        unit=obs.unit,
                        location={'lat': loc.lat, 'lon': loc.lon},
                        source=obs.source,
                        forecast_time=obs.forecast_time.isoformat() if obs.forecast_time else None,
                        fetched_at=obs.fetched_at.isoformat() if obs.fetched_at else datetime.utcnow().isoformat(),
                        freshness_minutes=getattr(obs, 'freshness_minutes', 0.0) or 0.0,
                        quality=obs.quality,
                        is_stale=getattr(obs, 'is_stale', False) or False,
                    )
                )

        return conditions.model_dump(mode='json'), evidence, warnings

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        action = input_data.task.action
        req_time = (
            datetime.fromisoformat(input_data.requested_time)
            if input_data.requested_time
            else None
        )

        if action == 'conditions_for_location':
            if not input_data.location:
                return AgentOutput(
                    agent=self.name,
                    status='failed',
                    errors=['Location is required for weather conditions'],
                    confidence=0.0,
                )
            loc = Location(lat=input_data.location.lat, lon=input_data.location.lon)
            data, evidence, warnings = await self._fetch_at_location(loc, req_time, 'origin')
            status = 'success' if evidence else 'partial' if warnings else 'failed'
            return AgentOutput(
                agent=self.name,
                status=status,
                data=data,
                evidence=evidence,
                warnings=warnings,
                confidence=0.92 if evidence else 0.4,
            )

        elif action == 'conditions_for_candidates':
            candidates = input_data.context.get('candidates', [])
            if not candidates:
                # Fallback to origin if no candidates
                if input_data.location:
                    loc = Location(lat=input_data.location.lat, lon=input_data.location.lon)
                    data, evidence, warnings = await self._fetch_at_location(loc, req_time, 'origin')
                    return AgentOutput(agent=self.name, status='success', data={'origin': data}, evidence=evidence, warnings=warnings)
                return AgentOutput(agent=self.name, status='skipped', data={'notice': 'No candidates to evaluate'})

            # Concurrently fetch for all candidates
            tasks = []
            cand_meta = []
            for cand in candidates:
                geom = cand.get('geometry')
                # Derive representative coordinate
                coords = None
                if geom:
                    if geom.get('type') == 'Point':
                        coords = geom['coordinates']
                    elif geom.get('type') in ('LineString', 'MultiPoint') and geom.get('coordinates'):
                        coords = geom['coordinates'][0]
                    elif geom.get('type') == 'MultiLineString' and geom.get('coordinates') and geom['coordinates'][0]:
                        coords = geom['coordinates'][0][0]
                if coords:
                    lon, lat = coords[0], coords[1]
                    tasks.append(self._fetch_at_location(Location(lat=lat, lon=lon), req_time, cand.get('id', 'cand')))
                    cand_meta.append(cand.get('id', 'cand'))

            if not tasks:
                return AgentOutput(agent=self.name, status='skipped', data={'notice': 'No candidate coordinates'})

            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_evidence = []
            all_warnings = []
            cand_data = {}

            for meta_id, res in zip(cand_meta, results):
                if isinstance(res, tuple):
                    data, ev, warn = res
                    cand_data[meta_id] = data
                    all_evidence.extend(ev)
                    all_warnings.extend(warn)

            return AgentOutput(
                agent=self.name,
                status='success' if all_evidence else 'partial',
                data={'candidate_weather': cand_data},
                evidence=all_evidence,
                warnings=list(set(all_warnings)),
                confidence=0.92,
            )

        return AgentOutput(agent=self.name, status='skipped')

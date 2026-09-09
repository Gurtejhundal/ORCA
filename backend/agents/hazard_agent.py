from datetime import datetime
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.schemas.marine import Location
from backend.services.marine import MarineService


class HazardAgent(BaseAgent):
    name = 'hazard_agent'
    allowed_actions = ['check_hazards', 'check_candidate_hazards']

    def __init__(self, marine_service: MarineService):
        self.service = marine_service

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        action = input_data.task.action
        loc = input_data.location

        marine_loc = Location(lat=loc.lat, lon=loc.lon) if loc else Location(lat=10.767, lon=79.843)
        radius = input_data.task.params.get('radius', 100.0)

        alerts_resp = await self.service.alerts(marine_loc, radius)
        alerts_list = alerts_resp.alerts
        evidence = []

        for idx, alert in enumerate(alerts_list):
            evidence.append(
                EvidenceItem(
                    id=f'ev_hazard_{alert.get("id", idx)}',
                    parameter='marine_hazard_alert',
                    value=alert.get('title') or alert.get('name'),
                    unit='advisory',
                    location={'lat': marine_loc.lat, 'lon': marine_loc.lon},
                    source=alert.get('source', 'INCOIS/IMD'),
                    forecast_time=alert.get('valid_until'),
                    fetched_at=datetime.utcnow().isoformat(),
                    freshness_minutes=alert.get('freshness_minutes', 0.0) or 0.0,
                    quality='official_warning',
                    is_stale=alert.get('is_stale', False) or False,
                )
            )

        status = 'success'
        warnings = list(alerts_resp.missing_sources)
        if not alerts_list and alerts_resp.missing_sources:
            # Do NOT interpret empty as all-clear if feeds are unavailable
            warnings.append("Warning feeds partially unavailable; zero alerts does not guarantee all-clear.")

        return AgentOutput(
            agent=self.name,
            status=status,
            data={
                'alerts': alerts_list,
                'count': len(alerts_list),
                'official_source': 'INCOIS / IMD',
            },
            evidence=evidence,
            warnings=warnings,
            confidence=0.90 if not alerts_resp.missing_sources else 0.70,
        )

from typing import Any
from shapely.geometry import shape, Point
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.schemas.marine import Location
from backend.services.marine import MarineService


class GeospatialAgent(BaseAgent):
    name = 'geospatial_agent'
    allowed_actions = ['check_candidate_zones', 'get_intersections', 'prepare_geojson']

    def __init__(self, marine_service: MarineService):
        self.service = marine_service

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        action = input_data.task.action
        loc = input_data.location

        marine_loc = Location(lat=loc.lat, lon=loc.lon) if loc else None

        if action in ('check_candidate_zones', 'get_intersections'):
            candidates = input_data.context.get('candidates', [])
            zones = await self.service.zones(marine_loc, radius=150.0)

            intersections = []
            safe_candidates = []
            evidence = []

            for cand in candidates:
                cand_geom = cand.get('geometry')
                if not cand_geom:
                    continue
                cand_shape = shape(cand_geom)
                has_conflict = False

                for zone in zones:
                    zone_shape = shape(zone['geometry'])
                    if cand_shape.intersects(zone_shape):
                        has_conflict = True
                        intersections.append({
                            'candidate_id': cand.get('id'),
                            'zone_id': zone.get('id'),
                            'zone_name': zone.get('name'),
                            'zone_type': zone.get('type'),
                            'severity': zone.get('severity'),
                        })
                        evidence.append(
                            EvidenceItem(
                                id=f"ev_geo_conflict_{cand.get('id')}_{zone.get('id')}",
                                parameter='spatial_zone_intersection',
                                value=f"Intersects with {zone.get('type')}: {zone.get('name')}",
                                unit='zone_overlap',
                                location={'lat': loc.lat, 'lon': loc.lon} if loc else {'lat': 0.0, 'lon': 0.0},
                                source='PostGIS/Shapely Spatial Analysis',
                                fetched_at=__import__('datetime').datetime.utcnow().isoformat(),
                                quality='derived_geospatial',
                            )
                        )

                if not has_conflict:
                    safe_candidates.append(cand)

            return AgentOutput(
                agent=self.name,
                status='success',
                data={
                    'intersections': intersections,
                    'safe_candidates': safe_candidates,
                    'zones_evaluated': len(zones),
                },
                evidence=evidence,
                confidence=0.98,
            )

        elif action == 'prepare_geojson':
            features = []
            candidates = input_data.context.get('candidates', [])
            for cand in candidates:
                if cand.get('geometry'):
                    features.append({
                        'type': 'Feature',
                        'id': cand.get('id'),
                        'geometry': cand.get('geometry'),
                        'properties': {
                            'id': cand.get('id'),
                            'name': cand.get('name'),
                            'distance_km': cand.get('distance_km'),
                            'source': cand.get('source'),
                        },
                    })
            collection = {'type': 'FeatureCollection', 'features': features}
            return AgentOutput(
                agent=self.name,
                status='success',
                data={'geojson': collection},
                confidence=1.0,
            )

        return AgentOutput(agent=self.name, status='skipped')

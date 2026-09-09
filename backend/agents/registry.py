from typing import Type
from backend.agents.base import BaseAgent
from backend.agents.pfz_agent import PFZAgent
from backend.agents.weather_agent import WeatherAgent
from backend.agents.ocean_agent import OceanAgent
from backend.agents.hazard_agent import HazardAgent
from backend.agents.geospatial_agent import GeospatialAgent
from backend.agents.satellite_agent import SatelliteAgent
from backend.services.marine import MarineService


class AgentRegistry:
    """Safe allowlist registry of specialized marine agents."""

    def __init__(self, marine_service: MarineService):
        self.service = marine_service
        self._agents: dict[str, BaseAgent] = {
            'pfz_agent': PFZAgent(marine_service),
            'weather_agent': WeatherAgent(marine_service),
            'ocean_agent': OceanAgent(marine_service),
            'hazard_agent': HazardAgent(marine_service),
            'geospatial_agent': GeospatialAgent(marine_service),
            'satellite_agent': SatelliteAgent(marine_service),
        }

    def get(self, name: str) -> BaseAgent | None:
        return self._agents.get(name)

    @property
    def allowed_agent_names(self) -> list[str]:
        return list(self._agents.keys())

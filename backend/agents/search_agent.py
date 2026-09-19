import logging
from typing import Any
from backend.agents.base import BaseAgent
from backend.agents.schemas import AgentInput, AgentOutput, EvidenceItem
from backend.data_sources.duckduckgo_search import DuckDuckGoSearch
from backend.schemas.marine import utcnow

logger = logging.getLogger(__name__)


class WebSearchAgent(BaseAgent):
    """Retrieves live online context and marine advisories when primary sensors have missing data."""

    name = 'web_search_agent'
    allowed_actions = ['duckduckgo_search', 'search_marine_advisories', 'search_location_context']

    def __init__(self, search_client: DuckDuckGoSearch | None = None):
        self.search_client = search_client or DuckDuckGoSearch()

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        query = input_data.query.strip()
        location_name = input_data.location.name if input_data.location and input_data.location.name else ''
        search_query = query

        # Target search query based on context
        if input_data.task.action == 'search_marine_advisories' and location_name:
            search_query = f"{location_name} marine weather warning INCOIS IMD advisory today"
        elif input_data.task.action == 'search_location_context' and location_name:
            search_query = f"{location_name} fishing port sea conditions forecast"
        elif 'search_term' in input_data.task.params:
            search_query = input_data.task.params['search_term']

        results = await self.search_client.search(search_query, max_results=5)

        if not results:
            return AgentOutput(
                agent=self.name,
                status='partial',
                data={'query': search_query, 'results': []},
                warnings=['Web search returned no relevant public snippets.'],
                confidence=0.5,
            )

        evidence_items = []
        sources = []
        for idx, item in enumerate(results):
            sources.append(item['domain'])
            evidence_items.append(
                EvidenceItem(
                    id=f'ev_web_{idx+1}',
                    parameter='web_search_snippet',
                    value=item['snippet'],
                    unit=None,
                    location={
                        'lat': input_data.location.lat if input_data.location else 0.0,
                        'lon': input_data.location.lon if input_data.location else 0.0,
                    },
                    source=item['domain'],
                    fetched_at=utcnow().isoformat(),
                    freshness_minutes=1.0,
                    quality='web_search',
                    is_stale=False,
                )
            )

        return AgentOutput(
            agent=self.name,
            status='success',
            data={
                'query': search_query,
                'results': results,
                'summary': f"Retrieved {len(results)} live web sources via DuckDuckGo.",
            },
            evidence=evidence_items,
            warnings=[],
            confidence=0.88,
        )

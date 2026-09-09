import asyncio
from datetime import datetime
from backend.data_sources.base import SourceAdapter
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import Location, Observation
from backend.cache.memory import MemoryCache


class SourceRegistry:
    def __init__(self, cache: MemoryCache):
        self.cache = cache
        self.groups: dict[str, list[SourceAdapter]] = {}

    def register(self, group: str, *adapters: SourceAdapter) -> None:
        self.groups[group] = list(adapters)

    async def fetch(self, group: str, location: Location, time: datetime, ttl: int) -> tuple[list[Observation], list[str]]:
        async def one(adapter):
            key = f'{adapter.name}:{group}:{location.lat:.6f}:{location.lon:.6f}:{time.isoformat()}'
            failed = self.cache.get('failure:' + key)
            if failed:
                return [], failed['value']
            try:
                return await self.cache.load(key, ttl, lambda: adapter.fetch(location, time)), None
            except SourceUnavailable as exc:
                error = f'{adapter.name}: {exc.reason}'
                self.cache.put('failure:' + key, error, 30)
                return [], error
        results = await asyncio.gather(*(one(a) for a in self.groups.get(group, [])))
        merged: dict[str, Observation] = {}
        errors = []
        for observations, error in results:
            if error:
                errors.append(error)
            for observation in observations:
                existing = merged.get(observation.parameter)
                if existing is None or existing.value is None:
                    merged[observation.parameter] = observation.refreshed()
        return list(merged.values()), errors

    async def health(self) -> dict:
        adapters = {a.name: a for group in self.groups.values() for a in group}
        async def one(adapter):
            return await self.cache.load('health:' + adapter.name, 300, adapter.health_check)
        results = await asyncio.gather(*(one(a) for a in adapters.values()), return_exceptions=True)
        return {name: value if isinstance(value, dict) else {'status': 'unavailable'}
                for name, value in zip(adapters, results)}

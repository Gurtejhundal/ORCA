import asyncio
import copy
from collections import OrderedDict
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable
from backend.schemas.marine import utcnow


class MemoryCache:
    """Bounded per-process TTL cache. Expired data is never a safety fallback."""
    def __init__(self, capacity: int = 512):
        self.capacity = capacity
        self.entries: OrderedDict[str, tuple[datetime, datetime, Any]] = OrderedDict()
        self.lock = asyncio.Lock()
        self.inflight: dict[str, asyncio.Task] = {}

    def get(self, key: str, *, allow_stale: bool = False) -> dict | None:
        entry = self.entries.get(key)
        if entry is None:
            return None
        fetched, expires, value = entry
        stale = utcnow() >= expires
        if stale and not allow_stale:
            return None
        self.entries.move_to_end(key)
        return {'value': copy.deepcopy(value), 'fetched_at': fetched,
                'expires_at': expires, 'is_stale': stale}

    def put(self, key: str, value: Any, ttl: int) -> None:
        now = utcnow()
        self.entries[key] = (now, now + timedelta(seconds=ttl), copy.deepcopy(value))
        self.entries.move_to_end(key)
        while len(self.entries) > self.capacity:
            self.entries.popitem(last=False)

    async def load(self, key: str, ttl: int, loader: Callable[[], Awaitable[Any]]) -> Any:
        cached = self.get(key)
        if cached:
            return cached['value']
        async with self.lock:
            if key not in self.inflight:
                async def fill():
                    try:
                        value = await loader()
                        self.put(key, value, ttl)
                        return value
                    finally:
                        self.inflight.pop(key, None)
                self.inflight[key] = asyncio.create_task(fill())
            task = self.inflight[key]
        return copy.deepcopy(await asyncio.shield(task))

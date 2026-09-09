import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit
import httpx
from backend.core.config import Settings
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import Location, Observation

ALLOWED_HOSTS = {'incois.gov.in', 'erddap.incois.gov.in', 'api.open-meteo.com', 'marine-api.open-meteo.com'}
logger = logging.getLogger(__name__)


class SafeHTTP:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings, self.client = settings, client

    async def get(self, url: str, params: dict | None = None) -> httpx.Response:
        target = urlsplit(url)
        if target.scheme != 'https' or target.hostname not in ALLOWED_HOSTS or target.port not in (None, 443) or target.username:
            raise SourceUnavailable('http', 'Outbound target is not allowlisted')
        for attempt in range(self.settings.http_retries + 1):
            try:
                async with self.client.stream('GET', url, params=params, timeout=self.settings.http_timeout,
                                              follow_redirects=False) as response:
                    response.raise_for_status()
                    parts, total = [], 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > 3_000_000:
                            raise SourceUnavailable(target.hostname, 'Response exceeds 3 MB limit')
                        parts.append(chunk)
                    headers = {k: v for k, v in response.headers.items() if k.lower() not in ('content-encoding', 'content-length')}
                    return httpx.Response(response.status_code, headers=headers,
                                          content=b''.join(parts), request=response.request)
            except httpx.HTTPError as exc:
                retryable = not isinstance(exc, httpx.HTTPStatusError) or exc.response.status_code in (429, 500, 502, 503, 504)
                if not retryable or attempt == self.settings.http_retries:
                    logger.warning('source_request_failed host=%s error=%s', target.hostname, type(exc).__name__)
                    raise SourceUnavailable(target.hostname, type(exc).__name__) from exc
                await asyncio.sleep(0.25 * 2**attempt)
        raise SourceUnavailable(target.hostname, 'Retry budget exhausted')


class SourceAdapter(ABC):
    name: str

    @abstractmethod
    async def fetch(self, location: Location, time: datetime) -> list[Observation]: ...

    @abstractmethod
    def normalize(self, raw: Any, location: Location, time: datetime) -> list[Observation]: ...

    def validate(self, values: list[Observation]) -> list[Observation]:
        return [Observation.model_validate(item.model_dump()) for item in values]

    @abstractmethod
    async def health_check(self) -> dict: ...

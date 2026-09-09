"""Isolated public-page discovery and ncWMS CSV adapter. No JS execution."""
import asyncio
import csv
import io
import re
from datetime import datetime, timedelta
from backend.data_sources.base import SourceAdapter, SafeHTTP
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import Location, Observation, utcnow
from backend.cache.memory import MemoryCache

PAGE = 'https://incois.gov.in/oceanservices/osfforecast.jsp'
VARIABLES = {'HS': ('significant_wave_height', 'm'), 'PHS01': ('swell_height', 'm'),
             'T02': ('wave_period', 's'), 'PTP01': ('swell_period', 's')}


class IncoisOSF(SourceAdapter):
    name = 'INCOIS OSF'

    def __init__(self, http: SafeHTTP, cache: MemoryCache):
        self.http, self.cache = http, cache

    async def dataset(self) -> str:
        async def discover():
            page = (await self.http.get(PAGE)).text
            match = re.search(r'var\s+rsmc_combined_ww3\s*=\s*"(rsmc_combined_ww3_\d{8}\.nc)"', page)
            if not match:
                raise SourceUnavailable(self.name, 'Public page dataset declaration changed')
            return 'https://incois.gov.in/thredds/wms/osf/ww3/' + match[1]
        return await self.cache.load('incois:osf:dataset', 1800, discover)

    async def fetch(self, location: Location, time: datetime) -> list[Observation]:
        url = await self.dataset()
        async def one(layer: str):
            response = await self.http.get(url, {'REQUEST': 'GetTimeseries', 'LAYERS': layer,
                'QUERY_LAYERS': layer, 'BBOX': f'{location.lon},{location.lat},{location.lon},{location.lat}',
                'SRS': 'CRS:84', 'HEIGHT': 1, 'WIDTH': 1, 'X': 0, 'Y': 0, 'ELEVATION': 0,
                'VERSION': '1.1.1', 'INFO_FORMAT': 'text/csv',
                'TIME': f'{(time-timedelta(hours=3)).isoformat()}/{(time+timedelta(hours=3)).isoformat()}'})
            return self.normalize({'csv': response.text, 'layer': layer, 'url': url}, location, time)
        results = await asyncio.gather(*(one(layer) for layer in VARIABLES), return_exceptions=True)
        observations = [o for result in results if isinstance(result, list) for o in result]
        if not observations:
            raise SourceUnavailable(self.name, 'No valid wave CSV values at requested location/time')
        return self.validate(observations)

    def normalize(self, raw, location: Location, time: datetime) -> list[Observation]:
        parameter, unit = VARIABLES[raw['layer']]
        rows = list(csv.reader(line for line in raw['csv'].splitlines() if line and not line.startswith('#')))
        if not rows or len(rows[0]) < 2 or 'Time (UTC)' not in rows[0][0] or f'({unit})' not in rows[0][1]:
            return []
        candidates = []
        for row in rows:
            try:
                timestamp = datetime.fromisoformat(row[0].replace('Z', '+00:00'))
                value = float(row[1])
                if not __import__('math').isfinite(value) or value < 0:
                    continue
                if timestamp.tzinfo and abs((timestamp-time).total_seconds()) <= 5400:
                    candidates.append((timestamp, value))
            except (ValueError, IndexError):
                continue
        if not candidates:
            return []
        timestamp, value = min(candidates, key=lambda pair: abs((pair[0]-time).total_seconds()))
        fetched = utcnow()
        return [Observation(parameter=parameter, value=value, unit=unit, location=location,
            forecast_time=timestamp, source=self.name, source_reference=raw['url'],
            fetched_at=fetched, expires_at=fetched+timedelta(seconds=self.http.settings.ocean_ttl),
            quality='official_forecast', primary_source_available=True,
            metadata={'sampling': 'ncWMS point query; native grid cell', 'product': raw['layer']})]

    async def health_check(self) -> dict:
        try:
            await self.fetch(Location(lat=10.77, lon=80.1), utcnow())
            return {'status': 'online'}
        except SourceUnavailable as exc:
            return {'status': 'unavailable', 'reason': exc.reason}

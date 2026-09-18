from datetime import datetime, timedelta, timezone
from typing import Any

from backend.core.exceptions import SourceUnavailable
from backend.data_sources.base import SafeHTTP, SourceAdapter
from backend.schemas.marine import Location, Observation, utcnow


class MetNorwayWeather(SourceAdapter):
    name = 'MET Norway Locationforecast'
    url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

    def __init__(self, http: SafeHTTP):
        self.http = http
        self.ttl = http.settings.weather_ttl

    async def fetch(self, location: Location, time: datetime) -> list[Observation]:
        if not self.http.settings.met_no_enabled:
            raise SourceUnavailable(self.name, 'Disabled in configuration')
        response = await self.http.get(self.url, {'lat': location.lat, 'lon': location.lon})
        try:
            return self.validate(self.normalize(response.json(), location, time))
        except (ValueError, KeyError, TypeError, IndexError) as exc:
            raise SourceUnavailable(self.name, 'Malformed location forecast') from exc

    def normalize(self, raw: Any, location: Location, time: datetime) -> list[Observation]:
        series = raw['properties']['timeseries']
        times = [datetime.fromisoformat(row['time'].replace('Z', '+00:00')) for row in series]
        if not times:
            raise ValueError('No forecast times returned')
        requested = time.astimezone(timezone.utc)
        index = min(range(len(times)), key=lambda i: abs((times[i] - requested).total_seconds()))
        if abs((times[index] - requested).total_seconds()) > 3 * 3600:
            raise ValueError('No forecast within three hours of requested time')

        item = series[index]
        details = item['data']['instant']['details']
        next_hour = item['data'].get('next_1_hours', {}).get('details', {})
        symbol = item['data'].get('next_1_hours', {}).get('summary', {}).get('symbol_code')
        fetched = utcnow()
        grid_coords = raw.get('geometry', {}).get('coordinates') or [location.lon, location.lat]
        grid = Location(lat=float(grid_coords[1]), lon=float(grid_coords[0]))
        expires_at = fetched + timedelta(seconds=self.ttl)
        metadata = {
            'requested_location': location.model_dump(),
            'attribution': 'MET Norway Locationforecast, CC BY 4.0',
            'provider_updated_at': raw.get('properties', {}).get('meta', {}).get('updated_at'),
            'weather_symbol': symbol,
        }

        def obs(parameter: str, value: Any, unit: str | None) -> Observation:
            numeric = None if value is None else float(value)
            return Observation(
                parameter=parameter,
                value=numeric,
                unit=unit,
                location=grid,
                forecast_time=times[index],
                source=self.name,
                source_reference=self.url,
                fetched_at=fetched,
                expires_at=expires_at,
                quality='model_forecast',
                primary_source_available=False,
                metadata=metadata,
            )

        thunder_symbol = str(symbol or '').lower()
        thunderstorm = 1.0 if 'thunder' in thunder_symbol else 0.0
        return [
            obs('wind_speed', details.get('wind_speed'), 'm/s'),
            obs('wind_direction', details.get('wind_from_direction'), '°'),
            obs('precipitation', next_hour.get('precipitation_amount'), 'mm'),
            obs('weather_code', None, None),
            obs('thunderstorms', thunderstorm, 'boolean'),
        ]

    async def health_check(self) -> dict:
        try:
            values = await self.fetch(Location(lat=10.77, lon=80.1), utcnow())
            return {'status': 'online' if any(o.value is not None for o in values) else 'unavailable'}
        except SourceUnavailable as exc:
            return {'status': 'unavailable', 'reason': exc.reason}

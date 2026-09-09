from datetime import datetime, timedelta, timezone
from typing import Any
from backend.data_sources.base import SourceAdapter, SafeHTTP
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import Location, Observation, utcnow

MARINE = {
    'wave_height': ('significant_wave_height', 'm'), 'wave_direction': ('wave_direction', '°'),
    'wave_period': ('wave_period', 's'), 'swell_wave_height': ('swell_height', 'm'),
    'swell_wave_direction': ('swell_direction', '°'), 'swell_wave_period': ('swell_period', 's'),
    'sea_surface_temperature': ('sst', '°C'), 'ocean_current_velocity': ('current_speed', 'km/h'),
    'ocean_current_direction': ('current_direction', '°'), 'sea_level_height_msl': ('sea_level', 'm'),
}
WEATHER = {
    'wind_speed_10m': ('wind_speed', 'm/s'), 'wind_direction_10m': ('wind_direction', '°'),
    'wind_gusts_10m': ('wind_gust', 'm/s'), 'precipitation': ('precipitation', 'mm'),
    'visibility': ('visibility', 'm'), 'weather_code': ('weather_code', 'wmo code'),
}


class OpenMeteo(SourceAdapter):
    def __init__(self, http: SafeHTTP, marine: bool = False):
        self.http, self.marine = http, marine
        self.name = 'Open-Meteo Marine' if marine else 'Open-Meteo Weather'
        self.url = 'https://marine-api.open-meteo.com/v1/marine' if marine else 'https://api.open-meteo.com/v1/forecast'
        self.variables = MARINE if marine else WEATHER
        self.ttl = http.settings.ocean_ttl if marine else http.settings.weather_ttl

    async def fetch(self, location: Location, time: datetime) -> list[Observation]:
        if not self.http.settings.open_meteo_enabled:
            raise SourceUnavailable(self.name, 'Disabled in configuration')
        params = {'latitude': location.lat, 'longitude': location.lon,
                  'hourly': ','.join(self.variables), 'timezone': 'UTC',
                  'start_date': time.date().isoformat(), 'end_date': time.date().isoformat()}
        if not self.marine:
            params['wind_speed_unit'] = 'ms'
        response = await self.http.get(self.url, params)
        try:
            return self.validate(self.normalize(response.json(), location, time))
        except (ValueError, KeyError, TypeError, IndexError) as exc:
            raise SourceUnavailable(self.name, 'Malformed hourly forecast') from exc

    def normalize(self, raw: Any, location: Location, time: datetime) -> list[Observation]:
        hourly, units = raw['hourly'], raw['hourly_units']
        times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in hourly['time']]
        index = min(range(len(times)), key=lambda i: abs((times[i] - time).total_seconds()))
        if abs((times[index] - time).total_seconds()) > 3600:
            raise ValueError('No forecast within one hour of requested time')
        fetched = utcnow()
        grid = Location(lat=raw['latitude'], lon=raw['longitude'])
        result = []
        for key, (parameter, expected_unit) in self.variables.items():
            values = hourly.get(key)
            if values is None:
                continue
            if len(values) != len(times) or units.get(key) != expected_unit:
                raise ValueError(f'Invalid array or unit: {key}')
            value, unit = values[index], expected_unit
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                raise ValueError('Non-numeric forecast value')
            if parameter == 'current_speed':
                value, unit = (value / 3.6 if value is not None else None), 'm/s'
            result.append(Observation(parameter=parameter, value=value, unit=unit, location=grid,
                forecast_time=times[index], source=self.name, source_reference=self.url,
                fetched_at=fetched, expires_at=fetched + timedelta(seconds=self.ttl), quality='model_forecast',
                primary_source_available=False if self.marine else None,
                metadata={'requested_location': location.model_dump(), 'attribution': 'Open-Meteo, CC BY 4.0',
                          'datum': 'global mean sea level' if parameter == 'sea_level' else None}))
        code = next((o for o in result if o.parameter == 'weather_code'), None)
        if code:
            result.append(code.model_copy(update={'parameter': 'thunderstorms',
                'value': None if code.value is None else float(code.value in (95, 96, 99)),
                'unit': 'boolean', 'metadata': {**code.metadata, 'derived_from': 'WMO weather_code'}}))
        return result

    async def health_check(self) -> dict:
        try:
            values = await self.fetch(Location(lat=10.77, lon=80.1), utcnow())
            return {'status': 'online' if any(o.value is not None for o in values) else 'unavailable'}
        except SourceUnavailable as exc:
            return {'status': 'unavailable', 'reason': exc.reason}

import asyncio
import logging
from datetime import datetime, timezone
from backend.core.config import Settings
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import *
from backend.data_sources import demo
from backend.data_sources.registry import SourceRegistry
from backend.data_sources.incois.pfz import IncoisPFZ
from backend.data_sources.incois.pfz_wfs import IncoisPFZWFS
from backend.data_sources.incois.alerts import IncoisAlerts
from backend.database.repository import Repository
from backend.geospatial.utils import distance_to_geometry, in_bbox

OCEAN = ['significant_wave_height', 'wave_direction', 'wave_period', 'swell_height', 'swell_direction',
         'swell_period', 'sst', 'current_speed', 'current_direction', 'sea_level', 'chlorophyll']
WEATHER = ['wind_speed', 'wind_direction', 'wind_gust', 'precipitation', 'visibility', 'thunderstorms', 'weather_code']
LAYERS = {'pfz': None, 'sst': 'sst', 'chlorophyll': 'chlorophyll', 'waves': 'significant_wave_height',
          'currents': 'current_speed', 'hazards': 'hazard', 'restricted': 'restricted', 'protected': 'protected'}
logger = logging.getLogger(__name__)


class MarineService:
    def __init__(self, settings: Settings, registry: SourceRegistry, repository: Repository, pfz_source=None):
        self.settings, self.registry, self.repo = settings, registry, repository
        self.pfz_source = pfz_source or IncoisPFZ(settings.pfz_import_file)
        self.pfz_fallback = IncoisPFZ(settings.pfz_import_file)
        self.alerts_source = IncoisAlerts()
        self.mode = 'demo' if settings.demo_mode else 'live'
        from backend.services.freshness import DataFreshnessService
        self.freshness = DataFreshnessService(settings.demo_mode)

    def time(self, time: datetime | None) -> datetime:
        return (time or (demo.REPLAY_TIME if self.settings.demo_mode else utcnow())).astimezone(timezone.utc)

    async def fetch_pfz(self) -> list[Zone]:
        failed = self.registry.cache.get('failure:pfz')
        if failed:
            raise SourceUnavailable(self.pfz_source.name, failed['value'])
        try:
            return await self.registry.cache.load('incois:pfz:primary', self.settings.pfz_ttl, self.pfz_source.fetch)
        except SourceUnavailable as exc:
            self.registry.cache.put('failure:pfz', exc.reason, 30)
            raise

    async def conditions(self, group: str, location: Location, time: datetime | None) -> Conditions:
        time = self.time(time).replace(minute=0, second=0, microsecond=0)
        expected = OCEAN if group == 'ocean' else WEATHER
        persistence = 'not_used_in_demo'
        if self.settings.demo_mode:
            values, errors = demo.observations(location, time), []
        else:
            values, errors = await self.registry.fetch(group, location, time,
                self.settings.ocean_ttl if group == 'ocean' else self.settings.weather_ttl)
            try:
                await self.repo.save_observations(values)
                persistence = 'online' if self.repo.db.session else 'unconfigured'
            except Exception:
                logger.warning('observation_persistence_unavailable')
                persistence = 'unavailable'
        result = {o.parameter: o for o in values if o.parameter in expected}
        self.freshness.record(group, [o for o in result.values() if o.value is not None])
        if group == 'ocean':
            for parameter in ('sst', 'chlorophyll'):
                self.freshness.record(parameter, [o for o in result.values() if o.parameter == parameter and o.value is not None])
        missing = [name for name in expected if name not in result or result[name].value is None]
        for name in missing:
            if name not in result:
                result[name] = Observation(parameter=name, location=location, source='unavailable',
                    forecast_time=None, fetched_at=utcnow(), expires_at=utcnow(), quality='unavailable', mode=self.mode)
        return Conditions(location=location, forecast_time=time, mode=self.mode,
            status='unavailable' if len(missing) == len(expected) else 'partial' if missing else 'ok',
            conditions=result, sources=sorted({v.source for v in result.values() if v.value is not None}),
            missing_sources=missing, data_quality={'source_errors': errors, 'persistence': persistence,
                'replay_time': time.isoformat() if self.settings.demo_mode else None})

    async def pfz(self, time: datetime | None = None, location: Location | None = None,
                  radius: float | None = None, bounds: tuple | None = None, limit: int = 100) -> ZonesResponse:
        time = self.time(time)
        errors = []
        zones = []
        if self.settings.demo_mode:
            zones = demo.pfz()
        else:
            try:
                zones = await self.fetch_pfz()
                await self.repo.save_pfz(zones)
                if zones and not any(z.valid_from <= time < z.valid_until and utcnow() < z.expires_at for z in zones):
                    errors.append('INCOIS PFZ: latest published product is outside conservative validity; not served as current')
            except SourceUnavailable as exc:
                errors.append(str(exc))
                if self.settings.pfz_import_file:
                    try:
                        zones = await self.registry.cache.load('incois:pfz:export', self.settings.pfz_ttl, self.pfz_fallback.fetch)
                        await self.repo.save_pfz(zones)
                    except Exception:
                        errors.append('Reviewed PFZ export unavailable')
            except Exception:
                errors.append('database: PFZ persistence unavailable')
            if self.repo.db.session:
                try:
                    zones = await self.repo.pfz(time, location, radius, bounds, limit)
                except Exception:
                    errors.append('database: spatial query unavailable; using geodesic export filtering')
        filtered = []
        for zone in zones:
            if not zone.valid_from <= time < zone.valid_until:
                continue
            if not self.settings.demo_mode and utcnow() >= zone.expires_at:
                continue
            if bounds and not in_bbox(zone.geometry, bounds):
                continue
            distance = zone.distance_km
            if location and distance is None:
                distance = distance_to_geometry(location, zone.geometry)
            if radius is not None and distance is not None and distance > radius:
                continue
            filtered.append(zone.model_copy(update={'distance_km': distance,
                'is_stale': utcnow() >= zone.expires_at,
                'freshness_minutes': max(0, (utcnow()-zone.fetched_at).total_seconds()/60)}))
        filtered.sort(key=lambda z: (z.distance_km or 0, z.id))
        self.freshness.record('pfz', filtered[:limit])
        return ZonesResponse(mode=self.mode, status='partial' if errors and filtered else 'unavailable' if errors else 'ok',
            results=filtered[:limit], user_location=location, missing_sources=errors,
            replay_time=time if self.settings.demo_mode else None)

    async def zones(self, location: Location | None = None, radius: float = 100) -> list[dict]:
        if self.settings.demo_mode:
            result = []
            for feature in demo.read('geofences.geojson')['features']:
                p = feature['properties']
                if location and distance_to_geometry(location, feature['geometry']) > radius:
                    continue
                result.append({'id': p['id'], 'name': p['name'], 'type': p['category'], 'severity': p['severity'],
                    'source': 'ORCA synthetic replay', 'valid_from': p['validFrom'], 'valid_until': p['validTo'],
                    'geometry': feature['geometry'], 'mode': 'demo', 'is_stale': True,
                    'metadata': {'quality': 'synthetic', 'replay_time': demo.REPLAY_TIME.isoformat()}})
            return result
        rows = await self.repo.zones(utcnow(), location, radius)
        for row in rows:
            provenance = row['metadata']
            fetched = datetime.fromisoformat(provenance['fetched_at']) if provenance.get('fetched_at') else None
            row.update(mode='live', fetched_at=fetched, expires_at=provenance.get('expires_at'),
                source_reference=provenance.get('source_reference'), is_stale=False,
                freshness_minutes=max(0,(utcnow()-fetched).total_seconds()/60) if fetched else None)
        return rows

    async def alerts(self, location: Location, radius: float) -> AlertsResponse:
        errors = []
        try:
            zones = await self.zones(location, radius)
        except Exception:
            zones, errors = [], ['database unavailable']
        if not self.settings.demo_mode:
            errors.append(f'{self.alerts_source.name}: {self.alerts_source.reason}')
        alerts = [{**z, 'title': z['name'], 'description': z.get('metadata', {}).get('description', z['name'])}
                  for z in zones if z['type'] in ('hazard', 'cyclone', 'high_wave', 'storm_surge', 'lightning', 'severe_weather')]
        self.freshness.record('alerts', alerts)
        return AlertsResponse(mode=self.mode, status='partial' if alerts and errors else 'unavailable' if errors else 'ok',
                              alerts=alerts, missing_sources=errors)

    async def layer(self, name: str, location: Location | None, time: datetime | None, bounds: tuple | None) -> FeatureCollection:
        metadata = {'mode': self.mode, 'layer': name}
        features = []
        if name == 'pfz':
            response = await self.pfz(time=time, bounds=bounds)
            metadata.update(status=response.status, missing_sources=response.missing_sources)
            features = [Feature(id=z.id, geometry=z.geometry, properties=z.model_dump(mode='json', exclude={'geometry'})) for z in response.results]
        elif name in ('hazards', 'restricted', 'protected'):
            try:
                zones = await self.zones()
                features = [Feature(id=z['id'], geometry=z['geometry'], properties={k:v for k,v in z.items() if k != 'geometry'})
                    for z in zones if z['type'] == LAYERS[name] and (not bounds or in_bbox(z['geometry'], bounds))]
                metadata['status'] = 'ok' if self.settings.demo_mode or features else 'unavailable'
            except Exception:
                metadata['status'] = 'unavailable'
        else:
            if location is None:
                metadata.update(status='unavailable', reason='lat and lon required for sampled point layers')
            else:
                response = await self.conditions('ocean', location, time)
                observation = response.conditions[LAYERS[name]]
                metadata.update(status='ok' if observation.value is not None else 'unavailable', representation='sampled point; not a raster coverage')
                if observation.value is not None:
                    features = [Feature(geometry={'type': 'Point', 'coordinates': [observation.location.lon, observation.location.lat]},
                                        properties=observation.model_dump(mode='json'))]
        return FeatureCollection(features=features, metadata=metadata)

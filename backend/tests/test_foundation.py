import asyncio
from datetime import timedelta
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from backend.core.config import Settings, settings
from backend.core.exceptions import SourceUnavailable
from backend.main import create_app
from backend.schemas.marine import Location, Observation, FeatureCollection, utcnow
from backend.geospatial.utils import haversine, point_in_polygon, distance_to_geometry, parse_bbox, to_wgs84
from backend.cache.memory import MemoryCache
from backend.data_sources.base import SafeHTTP
from backend.data_sources.weather.open_meteo import OpenMeteo, WEATHER
from backend.data_sources.incois.osf import IncoisOSF
from backend.data_sources.registry import SourceRegistry
from backend.database.session import Database
from backend.database.repository import Repository


@pytest.fixture
def client():
    with TestClient(create_app(Settings(_env_file=None, demo_mode=True, database_url=''))) as client:
        yield client


def test_health_and_config(client, monkeypatch):
    assert client.get('/health').json() == {'status': 'ok'}
    assert client.get('/api/v1/system/status').json()['database'] == 'unconfigured'
    monkeypatch.setenv('DEMO_MODE', 'false')
    assert Settings(_env_file=None).demo_mode is False


@pytest.mark.parametrize('lat,lon', [(91,0),(-91,0),(0,181),(0,-181),(float('nan'),0),(0,float('inf'))])
def test_invalid_coordinates(lat, lon):
    with pytest.raises(ValidationError):
        Location(lat=lat, lon=lon)


def test_geospatial():
    a, b = Location(lat=0,lon=0), Location(lat=0,lon=1)
    assert haversine(a,b) == pytest.approx(111.195, abs=0.01)
    polygon = {'type':'Polygon','coordinates':[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]}
    assert point_in_polygon(a, polygon)
    assert distance_to_geometry(a, polygon) == 0
    assert distance_to_geometry(a, {'type':'Point','coordinates':[1,0]}) == pytest.approx(111.319, abs=0.01)
    assert parse_bbox('-1,-1,1,1') == (-1,-1,1,1)
    with pytest.raises(ValueError): parse_bbox('1,1,-1,-1')
    assert to_wgs84({'type':'Point','coordinates':[0,0]}, 'EPSG:3857')['coordinates'] == (0,0)


@pytest.mark.parametrize('path', ['pfz','pfz/nearest?lat=10.767&lon=79.872','ocean/conditions?lat=10.767&lon=79.872',
    'weather?lat=10.767&lon=79.872','alerts?lat=10.767&lon=79.872','map/layers?lat=10.767&lon=79.872'])
def test_endpoints(client, path):
    response = client.get('/api/v1/' + path)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize('name', ['pfz','sst','chlorophyll','waves','currents','hazards','restricted','protected'])
def test_geojson_layers(client, name):
    response = client.get(f'/api/v1/map/layer/{name}?lat=10.767&lon=79.872')
    assert response.status_code == 200
    FeatureCollection.model_validate(response.json())


def test_pfz_nearest_filters(client):
    body = client.get('/api/v1/pfz/nearest?lat=10.767&lon=79.872').json()
    assert body['mode'] == 'demo'
    assert body['results'][0]['id'] == 'incois-2026-250-047'
    assert body['results'][0]['source'] == 'cached INCOIS PFZ sample'
    assert body['results'][0]['distance_km'] == pytest.approx(2.49, abs=0.02)
    distances = [z['distance_km'] for z in body['results']]
    assert distances == sorted(distances)
    assert client.get('/api/v1/pfz?date=2030-01-01').json()['results'] == []
    assert client.get('/api/v1/pfz?bbox=0,0,1,1').json()['results'] == []
    assert client.get('/api/v1/pfz?lat=10.767&lon=79.872&radius=1').json()['results'] == []


@pytest.mark.parametrize('path', ['pfz?radius=10', 'pfz?lat=1', 'pfz?bbox=garbage', 'weather?lat=91&lon=0',
    'ocean/conditions?lat=0&lon=0&time=2026-01-01T00:00:00', 'map/layer/invalid'])
def test_request_validation(client, path):
    assert client.get('/api/v1/' + path).status_code == 422


def test_demo_provenance_and_nulls(client):
    body = client.get('/api/v1/weather?lat=10.767&lon=79.872').json()
    assert body['status'] == 'partial'
    assert body['conditions']['visibility']['value'] is None
    wind = body['conditions']['wind_speed']
    assert wind['mode'] == 'demo' and wind['is_stale']
    assert wind['fetched_at'] and wind['observation_time'] and wind['forecast_time']
    assert client.get('/api/v1/weather?lat=0&lon=0').json()['status'] == 'unavailable'


async def test_cache_hit_miss_expiry_stale_and_singleflight():
    cache = MemoryCache(2)
    assert cache.get('x') is None
    cache.put('x', {'v':1}, -1)
    assert cache.get('x') is None
    assert cache.get('x', allow_stale=True)['is_stale']
    calls = 0
    async def loader():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return [1]
    assert await asyncio.gather(*(cache.load('key', 100, loader) for _ in range(5))) == [[1]]*5
    assert calls == 1
    value = cache.get('key'); value['value'].append(2)
    assert cache.get('key')['value'] == [1]


def payload(time):
    return {'latitude':10.8,'longitude':80.1,
        'hourly': {'time':[time.strftime('%Y-%m-%dT%H:00')], **{k:[1.0] for k in WEATHER}},
        'hourly_units': {k: unit for k, (_,unit) in WEATHER.items()}}


async def test_provider_success_malformed_and_unavailable():
    time = utcnow().replace(minute=0,second=0,microsecond=0)
    config = Settings(_env_file=None, http_retries=0)
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200,json=payload(time)))) as client:
        adapter = OpenMeteo(SafeHTTP(config,client))
        values = await adapter.fetch(Location(lat=10.77,lon=80.1),time)
        assert values[0].source == 'Open-Meteo Weather'
        assert values[0].location.lat == 10.8
    for status, body in [(503,{}),(200,{'hourly':{}}),(200,{'hourly':{'time':[]},'hourly_units':{}})]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(status,json=body))) as client:
            with pytest.raises(SourceUnavailable):
                await OpenMeteo(SafeHTTP(config,client)).fetch(Location(lat=0,lon=0),time)


async def test_safe_http():
    async with httpx.AsyncClient() as client:
        http = SafeHTTP(Settings(_env_file=None), client)
        for url in ['http://incois.gov.in','https://127.0.0.1','https://api.open-meteo.com:444','https://evil.example']:
            with pytest.raises(SourceUnavailable): await http.get(url)


async def test_fallback_preserves_provider():
    time = utcnow().replace(minute=0,second=0,microsecond=0)
    class Failed:
        name = 'failed primary'
        async def fetch(self, *args): raise SourceUnavailable(self.name,'offline')
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200,json=payload(time)))) as client:
        registry = SourceRegistry(MemoryCache())
        registry.register('weather', Failed(), OpenMeteo(SafeHTTP(Settings(_env_file=None),client)))
        values, errors = await registry.fetch('weather', Location(lat=10,lon=80),time,10)
        assert values and errors and all(v.source == 'Open-Meteo Weather' for v in values)


def test_osf_normalization():
    adapter = IncoisOSF(None, MemoryCache())
    # Supply only config needed for normalization; no external traffic.
    class HTTP:
        settings = Settings(_env_file=None)
    adapter.http = HTTP()
    instant = utcnow().replace(minute=0,second=0,microsecond=0)
    values = adapter.normalize({'csv':f'# header\nTime (UTC),Wave height (m) ()\n{instant.isoformat()},1.25', 'layer':'HS','url':'https://incois.gov.in'}, Location(lat=10,lon=80),instant)
    assert values[0].value == 1.25 and values[0].source == 'INCOIS OSF'
    assert adapter.normalize({'csv':'<html>failure</html>','layer':'HS','url':''},Location(lat=0,lon=0),instant) == []


@pytest.mark.integration
async def test_database_postgis_distance_and_tables():
    if not settings.database_url: pytest.skip('DATABASE_URL not configured')
    db = Database(settings.database_url)
    try:
        assert await db.health() == {'database':'online','postgis':'online'}
        async with db.engine.connect() as conn:
            distance = (await conn.execute(text("SELECT ST_Distance('SRID=4326;POINT(0 0)'::geography,'SRID=4326;POINT(1 0)'::geography)"))).scalar_one()
            assert distance/1000 == pytest.approx(111.319,abs=0.01)
            for table in ['marine_observations','pfz_zones','marine_zones','conversation_sessions','agent_runs']:
                assert (await conn.execute(text('SELECT to_regclass(:name)'), {'name':table})).scalar_one()
        await Repository(db).pfz(utcnow(), Location(lat=10,lon=80))
    finally:
        await db.close()


async def test_gzip_response_is_decoded_once():
    import gzip
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200,
        content=gzip.compress(b'{"ok":true}'), headers={'Content-Encoding':'gzip'}))) as client:
        response = await SafeHTTP(Settings(_env_file=None),client).get('https://incois.gov.in')
        assert response.json() == {'ok':True}


def test_geojson_rejects_unclosed_ring():
    with pytest.raises(ValidationError):
        FeatureCollection.model_validate({'type':'FeatureCollection','features':[{'type':'Feature',
            'geometry':{'type':'Polygon','coordinates':[[[0,0],[1,0],[1,1],[0,1]]]},'properties':{}}]})


def test_request_size_and_cors(client):
    assert client.get('/health',headers={'Content-Length':'65537'}).status_code == 413
    assert client.get('/health?'+'x'*8200).status_code == 413
    response = client.get('/health',headers={'Origin':'http://127.0.0.1:3000'})
    assert response.headers['access-control-allow-origin'] == 'http://127.0.0.1:3000'
    assert 'access-control-allow-origin' not in client.get('/health',headers={'Origin':'https://untrusted.example'}).headers


async def test_scientific_grid_missing_and_reprojection():
    import xarray as xr
    import numpy as np
    from backend.geospatial.scientific import sample_grid, reproject_features
    grid = xr.DataArray([[1,np.nan],[3,4]],dims=['latitude','longitude'],coords={'latitude':[0,1],'longitude':[0,1]})
    assert sample_grid(grid,Location(lat=0,lon=0)) == 1
    assert sample_grid(grid,Location(lat=0,lon=1)) is None
    assert sample_grid(grid,Location(lat=10,lon=10)) is None
    collection = FeatureCollection.model_validate({'type':'FeatureCollection','features':[{'type':'Feature',
        'geometry':{'type':'Point','coordinates':[0,0]},'properties':{}}]})
    assert reproject_features(collection,'EPSG:3857').crs.to_epsg() == 3857


async def test_live_failure_never_uses_demo():
    from backend.services.marine import MarineService
    class Failed:
        name = 'test unavailable'
        async def fetch(self): raise SourceUnavailable(self.name,'offline')
    service = MarineService(Settings(_env_file=None,demo_mode=False,database_url=''),
        SourceRegistry(MemoryCache()),Repository(Database('')),Failed())
    result = await service.pfz(location=Location(lat=10.767,lon=79.872))
    assert result.results == [] and result.mode == 'live' and result.status == 'unavailable'
    conditions = await service.conditions('ocean',Location(lat=10.767,lon=79.872),None)
    assert all(o.value is None and o.source == 'unavailable' for o in conditions.conditions.values())


async def test_negative_cache_stops_failed_source_burst():
    class Failed:
        name = 'test failed'
        calls = 0
        async def fetch(self,*args):
            self.calls += 1
            raise SourceUnavailable(self.name,'offline')
    source = Failed()
    registry = SourceRegistry(MemoryCache()); registry.register('test',source)
    instant = utcnow()
    for _ in range(3):
        assert (await registry.fetch('test',Location(lat=0,lon=0),instant,100))[1]
    assert source.calls == 1


def test_wfs_dates_and_malformed_schema():
    from backend.data_sources.incois.pfz_wfs import IncoisPFZWFS
    class HTTP:
        settings = Settings(_env_file=None)
    adapter = IncoisPFZWFS(HTTP())
    raw = {'type':'FeatureCollection', 'numberReturned':1,'totalFeatures':1,
        'features':[{'type':'Feature','geometry':{'type':'LineString','coordinates':[[80,10],[80.1,10.1]]},
        'properties':{'Year':2026,'Julian_day':'250','Sno':'001'}}]}
    html = '<td>Forecast Date</td><td>Valid upto</td><td>7 SEP 2026</td><td>8 SEP 2026</td>'
    zone = adapter.normalize(raw,html,utcnow())[0]
    assert zone.source == 'INCOIS PFZ WFS'
    assert zone.valid_until.isoformat() == '2026-09-08T00:00:00+05:30'
    assert zone.metadata['validity_precision'] == 'date'
    with pytest.raises(ValueError): adapter.normalize(raw,html.replace('7 SEP','6 SEP'),utcnow())
    raw['numberReturned'] = 0
    with pytest.raises(ValueError): adapter.normalize(raw,html,utcnow())


@pytest.mark.integration
async def test_persistence_and_nearest_postgis_transaction():
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from backend.schemas.marine import Zone
    if not settings.database_url: pytest.skip('DATABASE_URL not configured')
    db = Database(settings.database_url)
    try:
        async with db.engine.connect() as conn:
            transaction = await conn.begin()
            db.session = async_sessionmaker(bind=conn,expire_on_commit=False,join_transaction_mode='create_savepoint')
            repo = Repository(db)
            now = utcnow()
            common = dict(valid_from=now-timedelta(hours=1), valid_until=now+timedelta(hours=1),
                source='deterministic integration test', source_reference='backend/tests',fetched_at=now,expires_at=now+timedelta(minutes=10))
            await repo.save_pfz([Zone(id='test-pfz-near',name='test near',geometry={'type':'Point','coordinates':[1,0]},**common),
                Zone(id='test-pfz-far',name='test far',geometry={'type':'Point','coordinates':[2,0]},**common)])
            zones = await repo.pfz(now,Location(lat=0,lon=0),radius=300, bounds=(-1,-1,3,1))
            assert [z.id for z in zones] == ['test-pfz-near','test-pfz-far']
            assert zones[0].distance_km == pytest.approx(111.319,abs=0.01)
            observation = Observation(parameter='test',value=1,unit='m',location=Location(lat=0,lon=0),
                forecast_time=now,source='deterministic integration test',fetched_at=now,expires_at=now+timedelta(minutes=1),quality='test')
            await repo.save_observations([observation,observation])
            count = (await conn.execute(text('SELECT count(*) FROM marine_observations WHERE source=:source'),
                                       {'source':'deterministic integration test'})).scalar_one()
            assert count == 1
            await transaction.rollback()
    finally:
        await db.close()

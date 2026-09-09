"""Deterministic replay of existing repository fixtures; never relabelled as INCOIS."""
import json
from datetime import datetime, timedelta
from backend.core.config import ROOT
from backend.schemas.marine import Observation, Zone
from backend.geospatial.utils import haversine
from backend.schemas.marine import Location

REPLAY_TIME = datetime.fromisoformat('2026-09-07T06:00:00+00:00')
BASE = ROOT / 'data/demo'
PARAMETERS = {'waveHeightM': 'significant_wave_height', 'wavePeriodS': 'wave_period',
    'waveDirectionDeg': 'wave_direction', 'sstC': 'sst', 'chlorophyllMgM3': 'chlorophyll',
    'windSpeedMs': 'wind_speed', 'currentSpeedMs': 'current_speed'}


import functools

@functools.lru_cache(maxsize=32)
def read(name: str):
    return json.loads((BASE / name).read_text(encoding='utf-8'))


def observations(location: Location, time: datetime) -> list[Observation]:
    records = read('marine-snapshots.json')
    candidates = [r for r in records if datetime.fromisoformat(r['validFrom']) <= time < datetime.fromisoformat(r['validTo'])
                  and haversine(location, Location(**r['location'])) <= 50]
    candidates.sort(key=lambda r: haversine(location, Location(**r['location'])))
    result = {}
    for record in candidates:
        parameter = PARAMETERS.get(record['variable'])
        if not parameter or parameter in result:
            continue
        result[parameter] = Observation(parameter=parameter, value=record['value'], unit=record['unit'],
            location=record['location'], observation_time=record['observedAt'], forecast_time=record['validFrom'],
            source='ORCA synthetic replay', source_reference='data/demo/marine-snapshots.json',
            fetched_at=record['fetchedAt'], expires_at=record['validTo'], quality='synthetic', mode='demo',
            metadata={'replay_time': time.isoformat(), 'valid_until': record['validTo'],
                      'requested_location': location.model_dump(), 'fixture_id': record['id']}).refreshed()
    return list(result.values())


def pfz() -> list[Zone]:
    recorded = read('incois-pfz-recorded.geojson')
    return [Zone.model_validate({**f['properties'], 'geometry':f['geometry']}) for f in recorded['features']]


def synthetic_pfz() -> list[Zone]:
    return [Zone(id=f['properties']['id'], name=f['properties']['name'], geometry=f['geometry'],
        valid_from='2026-09-07T00:00:00+05:30', valid_until='2026-09-08T00:00:00+05:30',
        source='ORCA synthetic replay', source_reference='data/demo/candidate-zones.geojson',
        fetched_at='2026-09-06T12:00:00+05:30', expires_at='2026-09-08T00:00:00+05:30',
        mode='demo', metadata={'quality': 'synthetic'}) for f in read('candidate-zones.geojson')['features']]

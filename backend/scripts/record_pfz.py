"""Create a small deterministic replay from already downloaded official WFS data."""
import json
from datetime import datetime, timezone
from pathlib import Path
from backend.core.config import Settings
from backend.data_sources.incois.pfz_wfs import IncoisPFZWFS
from backend.schemas.marine import Location, FeatureCollection, Feature
from backend.geospatial.utils import distance_to_geometry


class HTTP:
    settings = Settings(_env_file=None)


raw_path = Path('output/source-probes/pfz_wfs.txt')
fetched = datetime.fromtimestamp(raw_path.stat().st_mtime, timezone.utc)
zones = IncoisPFZWFS(HTTP()).normalize(json.loads(raw_path.read_text()),
    Path('output/source-probes/pfz_advisories.txt').read_text(encoding='utf-8'), fetched)
origin = Location(lat=10.767,lon=79.872)
zones.sort(key=lambda z: distance_to_geometry(origin, z.geometry))
collection = FeatureCollection(features=[Feature(id=z.id, geometry=z.geometry,
    properties={**z.model_dump(mode='json',exclude={'geometry'}), 'mode':'demo',
        'source':'cached INCOIS PFZ sample', 'metadata':{**z.metadata,'original_source':z.source}}) for z in zones[:3]],
    metadata={'mode':'demo','recorded_at':fetched.isoformat(), 'replay_time':'2026-09-07T06:00:00Z',
              'description':'Three nearest official INCOIS PFZ line geometries; timestamps and coordinates preserved.'})
Path('data/demo/incois-pfz-recorded.geojson').write_text(collection.model_dump_json(indent=2),encoding='utf-8')
print([(z.id,round(distance_to_geometry(origin,z.geometry),2)) for z in zones[:3]])

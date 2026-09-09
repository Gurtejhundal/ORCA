"""Exercise live adapters or a running server; save a machine-readable report."""
import argparse
import json
from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.core.config import Settings
from backend.schemas.marine import FeatureCollection

paths = ['/health', '/api/v1/system/status', '/api/v1/pfz',
    '/api/v1/pfz/nearest?lat=10.767&lon=79.872', '/api/v1/ocean/conditions?lat=10.77&lon=80.1',
    '/api/v1/weather?lat=10.77&lon=80.1', '/api/v1/alerts?lat=10.77&lon=80.1',
    '/api/v1/map/layers?lat=10.77&lon=80.1']
paths += ['/api/v1/map/layer/' + name + '?lat=10.77&lon=80.1' for name in
          ['pfz','sst','chlorophyll','waves','currents','hazards','restricted','protected']]


def exercise(client):
    results = []
    for path in paths:
        response = client.get(path)
        body = response.json()
        assert response.status_code == 200, (path, body)
        if 'system/status' in path:
            assert body['database'] == 'online' and body['postgis'] == 'online', body
        if 'ocean/conditions' in path or '/weather?' in path:
            assert body['status'] != 'unavailable', (path, body)
            if body['mode'] == 'live':
                assert body['data_quality']['persistence'] == 'online', body['data_quality']
        if '/pfz/nearest' in path and body['mode'] == 'demo':
            assert body['results'] and body['results'][0]['source'] == 'cached INCOIS PFZ sample'
        if '/map/layer/' in path: FeatureCollection.model_validate(body)
        results.append({'path':path, 'http_status':response.status_code, 'body':body})
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    if args.live:
        with TestClient(create_app(Settings(demo_mode=False))) as client:
            results = exercise(client)
    else:
        with httpx.Client(base_url='http://127.0.0.1:8000', timeout=50) as client:
            results = exercise(client)
    output = Path('output'); output.mkdir(exist_ok=True)
    mode = next(r['body']['mode'] for r in results if 'system/status' in r['path'])
    (output / f'{mode}-smoke.json').write_text(json.dumps(results,indent=2))
    for r in results:
        body = r['body']
        print(r['path'], r['http_status'], body.get('status', body.get('mode','')) if isinstance(body,dict) else 'layers')
    if args.live:
        ocean = next(r['body'] for r in results if '/ocean/conditions' in r['path'])
        print('Ocean sources:', ocean['sources'], 'quality:', ocean['data_quality'])

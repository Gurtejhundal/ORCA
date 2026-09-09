"""Audit the running live backend without treating unavailable providers as success."""
import json
from pathlib import Path
import httpx


def main() -> None:
    location = {'lat': 10.77, 'lon': 80.1}
    trip = {'origin': location, 'destination': {'lat': 10.87, 'lon': 80.2}}
    cases = [
        ('/api/v1/safety/analyze', {'location': location}, 200),
        ('/api/v1/pfz/rank-safe', {'origin': location, 'limit': 2}, 200),
        ('/api/v1/routes/safe', trip, 503),
        ('/api/v1/routes/compare', trip, 503),
        ('/api/v1/geofence/check', {'position': location}, 503),
        ('/api/v1/simulation/start', trip, 503),
        ('/api/v1/voice/speak', {'text': 'Marine readiness test', 'language': 'en'}, 200),
        ('/api/v1/chat', {'message': 'What are the weather conditions?', 'location': location}, 200),
    ]
    results = []
    with httpx.Client(base_url='http://127.0.0.1:8000', timeout=50) as client:
        assert client.get('/api/v1/system/freshness').json()['mode'] == 'live'
        for path, payload, expected in cases:
            response = client.post(path, json=payload)
            body = response.json()
            results.append({'path': path, 'http_status': response.status_code, 'expected': expected, 'body': body})
            print(path, response.status_code, 'expected', expected)
            assert response.status_code == expected, body
            if path.endswith('safety/analyze'):
                assert body['risk']['level'] in ('UNKNOWN', 'HIGH', 'EXTREME')
            if path.endswith('rank-safe'):
                assert body['recommended'] is None, 'No live all-clear coverage is configured'
            if path.endswith('/chat'):
                assert body['status'] == 'partial' and body['warnings']
                trace = client.get('/api/v1/agents/runs/' + body['run_id'])
                results.append({'path': 'agent_trace', 'http_status': trace.status_code, 'body': trace.json()})
                assert trace.status_code == 200
        response = client.post('/api/v1/voice/transcribe', files={'audio': ('fixture.webm', b'audit', 'audio/webm')})
        assert response.status_code == 503
        results.append({'path': 'voice/transcribe', 'http_status': response.status_code, 'body': response.json()})
        results.append({'path': 'freshness', 'body': client.get('/api/v1/system/freshness').json()})
    Path('output').mkdir(exist_ok=True)
    Path('output/part4-live-readiness.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Readiness audit passed; expected 503 responses identify unavailable live capabilities.')


if __name__ == '__main__':
    main()

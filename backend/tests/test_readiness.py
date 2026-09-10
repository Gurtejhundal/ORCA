"""Regressions for truthful readiness, missing safety data and live/demo isolation."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from backend.core.config import Settings
from backend.main import create_app
from backend.risk.scoring import calculate_risk_assessment
from backend.conversation.location_resolution import resolve_location
from backend.services.freshness import DataFreshnessService, evaluate_item_freshness


def test_unqueried_data_is_not_live():
    summary = DataFreshnessService().get_summary()
    assert summary.overall_status == 'unavailable'
    assert all(v.fetched_at is None for v in summary.datasets.values())
    assert summary.datasets['gps'].freshness_status == 'unavailable'


def test_expiry_and_demo_preserve_real_times():
    now = datetime.now(timezone.utc)
    item = evaluate_item_freshness('weather', 'fixture', now, expires_at=now-timedelta(seconds=1))
    assert item.is_stale and item.freshness_status == 'stale'
    item = evaluate_item_freshness('weather', 'fixture', now-timedelta(days=7), is_demo=True)
    assert item.freshness_status == 'demo' and item.age_minutes >= 10079


def test_missing_measurements_do_not_become_normal_conditions():
    risk = calculate_risk_assessment([], [])
    assert risk.level == 'UNKNOWN'
    assert 'significant_wave_height' in risk.missing_critical_data
    assert all('Normal sea state' not in f.finding for f in risk.factors)
    assert 'all-clear' in next(f.finding for f in risk.factors if f.factor == 'marine_hazards')


def test_visibility_meters_are_converted_to_kilometers():
    risk = calculate_risk_assessment([{'parameter': 'visibility', 'value': 500, 'unit': 'm'}], [])
    visibility = next(f for f in risk.factors if f.factor == 'visibility')
    assert '0.5 km' in visibility.finding
    assert visibility.contribution > 0


@pytest.fixture
def client():
    config = Settings(_env_file=None, database_url='', demo_mode=False,
                      llm_provider='mock', bhashini_api_key='')
    with TestClient(create_app(config)) as client:
        yield client


@pytest.mark.parametrize('path,key', [('chat','location'), ('safety/analyze','location'), ('pfz/rank-safe','origin')])
def test_invalid_post_coordinates_are_validation_errors(client, path, key):
    response = client.post('/api/v1/' + path, json={'message': 'weather', key: {'lat': 91, 'lon': 0}})
    assert response.status_code == 422


@pytest.mark.parametrize('path', ['routes/safe', 'routes/compare', 'simulation/start'])
def test_live_routing_never_uses_demo_grid(client, path):
    response = client.post('/api/v1/' + path, json={
        'origin': {'lat': 10.767, 'lon': 79.872}, 'destination': {'lat': 10.87, 'lon': 80.1}})
    assert response.status_code == 503, response.text
    assert 'Live navigable-water coverage' in response.json()['detail']


def test_empty_boundary_coverage_is_not_safe(client):
    client.app.state.service.zones = AsyncMock(return_value=[])
    response = client.post('/api/v1/geofence/check', json={'position': {'lat': 10.767, 'lon': 79.872}})
    assert response.status_code == 503


def test_uploaded_audio_is_never_given_a_fake_transcript(client):
    response = client.post('/api/v1/voice/transcribe', files={'audio': ('sample.webm', b'fixture', 'audio/webm')})
    assert response.status_code == 503
    assert 'No working server speech provider' in response.json()['detail']


def test_browser_tts_is_explicit(client):
    response = client.post('/api/v1/voice/speak', json={'text': 'Test', 'language': 'en'})
    assert response.status_code == 200
    assert response.json()['provider'] == 'browser_fallback'
    assert response.json()['audio_base64'] is None


def test_mock_intent_uses_query_not_context_instructions():
    import asyncio
    from backend.agents.intent_agent import IntentAgent
    from backend.llm.provider import MockLLMProvider
    result = asyncio.run(IntentAgent(MockLLMProvider()).detect_intent(
        'Are we near a restricted zone?', {'current_location': {'lat': 10, 'lon': 80}}))
    assert result.intent == 'geofence_question'


def test_mock_intent_recognizes_natural_fishing_question():
    import asyncio
    from backend.agents.intent_agent import IntentAgent
    from backend.llm.provider import MockLLMProvider
    result = asyncio.run(IntentAgent(MockLLMProvider()).detect_intent(
        'Where should I fish tomorrow morning near Nagapattinam?', {}))
    assert result.intent == 'nearest_safe_pfz'


def test_zero_longitude_gps_is_preserved():
    location = resolve_location('conditions', explicit_location={'lat': 10, 'lon': 0})
    assert location and location.lon == 0


def test_nearby_restricted_zone_is_not_an_intersection():
    config = Settings(_env_file=None, database_url='', demo_mode=True)
    with TestClient(create_app(config)) as demo_client:
        response = demo_client.post('/api/v1/safety/analyze', json={
            'location': {'lat': 10.767, 'lon': 79.872},
        })
        assert response.status_code == 200
        assert response.json()['risk']['level'] != 'HIGH'
        assert not any(o['type'] in ('RESTRICTED_MARITIME_ZONE', 'HIGH_WAVE_ADVISORY')
                       for o in response.json()['risk']['official_overrides'])

        inside = demo_client.post('/api/v1/safety/analyze', json={
            'location': {'lat': 10.78, 'lon': 79.99},
        })
        assert any(o['type'] == 'HIGH_WAVE_ADVISORY'
                   for o in inside.json()['risk']['official_overrides'])


def test_demo_replay_is_scored_at_its_recorded_clock():
    config = Settings(_env_file=None, database_url='', demo_mode=True)
    with TestClient(create_app(config)) as demo_client:
        response = demo_client.post('/api/v1/pfz/rank-safe', json={
            'origin': {'lat': 10.767, 'lon': 79.872},
        })
        assert response.status_code == 200
        assert response.json()['ranked_candidates']
        assert response.json()['confidence'] > 0


def test_flagship_chat_returns_a_safety_gated_pfz():
    config = Settings(_env_file=None, database_url='', demo_mode=True)
    with TestClient(create_app(config)) as demo_client:
        response = demo_client.post('/api/v1/chat', json={
            'message': 'Where should I fish tomorrow morning near Nagapattinam?',
        })
        assert response.status_code == 200
        result = response.json()
        assert result['intent'] == 'nearest_safe_pfz'
        assert result['recommended_pfz']
        assert result['risk']['risk']['level'] != 'UNKNOWN'
        assert result['recommended_pfz']['name'] in result['answer']


def test_demo_geofence_fails_outside_recorded_coverage():
    config = Settings(_env_file=None, database_url='', demo_mode=True)
    with TestClient(create_app(config)) as demo_client:
        response = demo_client.post('/api/v1/geofence/check', json={
            'position': {'lat': 18.922, 'lon': 72.834},
        })
        assert response.status_code == 503
        assert 'outside the recorded demo boundary coverage' in response.json()['detail']


def test_route_request_rejects_invalid_controls(client):
    response = client.post('/api/v1/routes/safe', json={
        'origin': {'lat': 10.767, 'lon': 79.872},
        'destination': {'lat': 10.87, 'lon': 80.1},
        'optimization_preference': 'teleport',
        'vessel_speed_knots': -4,
    })
    assert response.status_code == 422


def test_demo_route_enforces_coverage_and_hazard_avoidance():
    config = Settings(_env_file=None, database_url='', demo_mode=True)
    with TestClient(create_app(config)) as demo_client:
        outside = demo_client.post('/api/v1/routes/safe', json={
            'origin': {'lat': 18.922, 'lon': 72.834},
            'destination': {'lat': 10.87, 'lon': 80.1},
        })
        assert outside.status_code == 503

        hazard = demo_client.post('/api/v1/routes/safe', json={
            'origin': {'lat': 10.767, 'lon': 79.872},
            'destination': {'lat': 10.78, 'lon': 79.99},
            'avoid_hazards': True,
        })
        assert hazard.status_code == 503


def test_simulation_rejects_partial_or_invalid_trip(client):
    assert client.post('/api/v1/simulation/start', json={
        'origin': {'lat': 10.767, 'lon': 79.872},
    }).status_code == 422
    assert client.post('/api/v1/simulation/start', json={
        'speed_knots': -1,
    }).status_code == 422

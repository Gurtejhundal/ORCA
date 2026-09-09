"""Regressions for truthful readiness, missing safety data and live/demo isolation."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from backend.core.config import Settings
from backend.main import create_app
from backend.risk.scoring import calculate_risk_assessment
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

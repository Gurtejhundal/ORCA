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
    agent = IntentAgent(MockLLMProvider())
    result = asyncio.run(agent.detect_intent(
        'Where should I fish tomorrow morning near Nagapattinam?', {}))
    assert result.intent == 'nearest_safe_pfz'
    result = asyncio.run(agent.detect_intent(
        'Which PFZ should I go to near Nagapattinam today?', {}))
    assert result.intent == 'nearest_safe_pfz'


def test_chat_separates_conversation_from_marine_analysis(client):
    import asyncio
    import json
    from backend.agents.schemas import IntentOutput
    from backend.conversation.context import LocationState
    from backend.llm.base import LLMProvider

    orchestrator = client.app.state.orchestrator
    orchestrator.execute_task_graph = AsyncMock(side_effect=AssertionError('Conversation must not fetch marine data'))
    session_id = None
    for message, language, expected in [
        ('hello', 'en', 'Hello!'),
        ('hey ORCA!', 'en', 'Hello!'),
        ('How are you?', 'en', 'ready to help'),
        ('Who are you?', 'en', 'marine intelligence assistant'),
        ('What is PFZ?', 'en', 'Potential Fishing Zone'),
        ('thanks', 'en', "You're welcome"),
        ('नमस्ते', 'hi', 'नमस्ते'),
        ('PFZ क्या है?', 'hi', 'संभावित मछली क्षेत्र'),
        ('What is the capital of France?', 'en', "General AI answers aren't connected"),
    ]:
        response = client.post('/api/v1/chat', json={'message': message, 'language': language, 'session_id': session_id})
        assert response.status_code == 200, response.text
        result = response.json()
        session_id = session_id or result['session_id']
        assert result['session_id'] == session_id
        assert result['intent'] == 'general_conversation' and result['status'] == 'success'
        assert expected in result['answer']
        assert result['language'] == language
        assert not result['evidence'] and not result['sources'] and not result['map_actions']
        assert not result['risk'] and not result['route'] and not result['recommended_pfz']
    orchestrator.execute_task_graph.assert_not_called()

    # An existing marine location/selection must survive small talk.
    context = asyncio.run(orchestrator.memory.get_context(session_id))
    context.current_location = LocationState(lat=10.767, lon=79.872, name='Nagapattinam')
    current_time = context.requested_time
    client.post('/api/v1/chat', json={'message': 'hi', 'session_id': session_id})
    assert context.current_location.name == 'Nagapattinam' and context.requested_time == current_time
    assert len(context.metadata['recent_conversation']) == 6
    for question, expected in [
        ('Hello, is it safe to fish near Kochi tomorrow?', 'marine_safety'),
        ('What is the wave height near Nagapattinam?', 'ocean_conditions'),
        ('What are the hazards right now?', 'hazard_check'),
        ('Show the current wave height', 'ocean_conditions'),
        ('Why not the second one?', 'follow_up'),
    ]:
        intent = asyncio.run(orchestrator.intent_agent.detect_intent(question, context.model_dump(), 'en'))
        assert intent.intent == expected and intent.required_capabilities

    # The same endpoint uses an existing real provider for open-ended answers.
    llm = AsyncMock(spec=LLMProvider)
    llm.generate_structured.return_value = IntentOutput(intent='general_conversation')
    llm.generate_text.return_value = 'Paris is the capital of France.'
    orchestrator.intent_agent.llm = orchestrator.explanation_agent.llm = llm
    response = client.post('/api/v1/chat', json={'message': 'What is the capital of France?', 'session_id': session_id})
    assert response.json()['answer'] == 'Paris is the capital of France.'
    prompt = json.loads(llm.generate_text.call_args.kwargs['prompt'])
    assert len(prompt['recent_conversation']) == 6 and prompt['message'] == 'What is the capital of France?'
    assert 'Never invent current weather' in llm.generate_text.call_args.kwargs['system_prompt']

    llm.generate_structured.side_effect = RuntimeError('provider unavailable')
    llm.generate_text.side_effect = RuntimeError('provider unavailable')
    response = client.post('/api/v1/chat', json={'message': 'How are you?', 'session_id': session_id})
    assert response.status_code == 200 and 'ready to help' in response.json()['answer']
    assert response.json()['intent'] == 'general_conversation'


def test_gemini_uses_private_header_and_reads_complete_answers(monkeypatch):
    import asyncio
    import json
    import httpx
    from backend.agents.schemas import IntentOutput
    from backend.llm.provider import get_llm_provider

    provider = get_llm_provider(Settings(_env_file=None, llm_provider='gemini', llm_api_key='test-only-key'))
    real_client = httpx.AsyncClient

    def respond(request):
        assert not request.url.query and 'test-only-key' not in str(request.url)
        assert request.headers['x-goog-api-key'] == 'test-only-key'
        payload = json.loads(request.content)
        assert payload['systemInstruction'] == {'parts': [{'text': 'Be helpful.'}]}
        assert len(payload['contents']) == 1 and payload['contents'][0]['role'] == 'user'
        assert request.url.path.endswith('/gemini-3.1-flash-lite:generateContent')
        if payload['contents'][0]['parts'][0]['text'] == 'blocked':
            return httpx.Response(200, json={'promptFeedback': {'blockReason': 'SAFETY'}})
        return httpx.Response(200, json={'candidates': [{'content': {'parts': [
            {'thought': True, 'text': 'Internal reasoning'},
            {'text': '{"intent":'}, {'text': '"general_conversation"}'},
        ]}}]})

    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(respond), **kwargs))
    output = asyncio.run(provider.generate_structured('Any general question', IntentOutput, system_prompt='Be helpful.'))
    assert output.intent == 'general_conversation'
    with pytest.raises(RuntimeError, match='Gemini returned no answer'):
        asyncio.run(provider.generate_text('blocked', system_prompt='Be helpful.'))


def test_gemini_prefers_provider_specific_key_and_model():
    from backend.llm.provider import GeminiLLMProvider, get_llm_provider

    provider = get_llm_provider(Settings(
        _env_file=None,
        llm_provider='gemini',
        llm_api_key='generic-key',
        llm_model='generic-model',
        gemini_api_key='gemini-key',
        gemini_model='gemini-3.1-flash-lite',
    ))

    assert isinstance(provider, GeminiLLMProvider)
    assert provider.api_key == 'gemini-key'
    assert provider.model == 'gemini-3.1-flash-lite'


def test_zero_longitude_gps_is_preserved():
    location = resolve_location('conditions', explicit_location={'lat': 10, 'lon': 0})
    assert location and location.lon == 0


@pytest.mark.parametrize('query,expected_name,expected_lat,expected_lon', [
    ('Where should I fish near Diu today?', 'Diu', 20.714, 70.987),
    ('Show PFZ near Pondicherry', 'Puducherry', 11.934, 79.830),
    ('What is the wave height near Kolkata?', 'Kolkata', 22.572, 88.363),
    ('Where should I fish near Pune?', 'Pune', 18.520, 73.857),
])
def test_named_city_overrides_default_or_gps_location(query, expected_name, expected_lat, expected_lon):
    location = resolve_location(query, explicit_location={'lat': 10.767, 'lon': 79.872})
    assert location is not None
    assert expected_name in location.name
    assert location.source == 'named'
    assert location.lat == pytest.approx(expected_lat, abs=0.001)
    assert location.lon == pytest.approx(expected_lon, abs=0.001)


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

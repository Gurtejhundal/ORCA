import json
import logging
import re
from typing import TypeVar, Type, Any
import httpx
from pydantic import BaseModel
from backend.core.config import Settings
from backend.llm.base import LLMProvider
from backend.llm.structured_output import parse_structured_output

T = TypeVar('T', bound=BaseModel)
logger = logging.getLogger(__name__)


class MockLLMProvider(LLMProvider):
    """High-fidelity offline/demo LLM provider that parses Indian coastal marine queries

    without requiring an external API key.
    """

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        # Check if Hindi
        is_hindi = any('\u0900' <= char <= '\u097F' for char in prompt)
        if is_hindi:
            return (
                "समुद्र की स्थिति और मौसम की जानकारी प्राप्त कर ली गई है। "
                "कृपया मौसम और तरंगों की ऊंचाई की सावधानीपूर्वक समीक्षा करें।"
            )
        return "Marine intelligence conditions evaluated against verified observation sources."

    async def generate_structured(
        self,
        prompt: str,
        schema: Type[T],
        system_prompt: str | None = None,
        temperature: float = 0.0,
    ) -> T:
        schema_name = schema.__name__.lower()
        lower_prompt = prompt.lower()
        is_hindi = any('\u0900' <= char <= '\u097F' for char in prompt)

        # 1. Intent schema
        if 'intent' in schema_name:
            # Classify only the query, not the instruction list or previous intent.
            match = re.search(r'Analyze this user query:\s*"(.*?)"(?:\n|$)', prompt, re.S)
            prompt = match.group(1) if match else prompt
            lower_prompt = prompt.lower()
            intent = 'general_marine_question'
            required_caps = ['ocean', 'weather']
            location_name = None
            time_expr = None
            activity = None

            # Detect Indian coastal locations
            loc_matches = [
                ('veraval', 'Veraval'), ('वेरावल', 'Veraval'),
                ('nagapattinam', 'Nagapattinam'), ('नागापट्टिनम', 'Nagapattinam'),
                ('kochi', 'Kochi'), ('cochin', 'Kochi'), ('कोच्चि', 'Kochi'),
                ('mumbai', 'Mumbai'), ('मुंबई', 'Mumbai'),
                ('chennai', 'Chennai'), ('चेन्नई', 'Chennai'),
                ('visakhapatnam', 'Visakhapatnam'), ('vizag', 'Visakhapatnam'),
                ('porbandar', 'Porbandar'), ('पोरबंदर', 'Porbandar'),
                ('mangalore', 'Mangalore'), ('mangaluru', 'Mangalore'),
                ('goa', 'Goa'), ('गोवा', 'Goa'),
                ('paradip', 'Paradip'), ('paradeep', 'Paradip'),
                ('kakinada', 'Kakinada'), ('tuticorin', 'Tuticorin'),
                ('thoothukudi', 'Tuticorin'), ('digha', 'Digha'),
                ('okha', 'Okha'), ('ratnagiri', 'Ratnagiri')
            ]
            for kw, name in loc_matches:
                if kw in lower_prompt or kw in prompt:
                    location_name = name
                    break

            # Detect temporal expressions
            if 'kal subah' in lower_prompt or 'कल सुबह' in prompt:
                time_expr = 'कल सुबह'
            elif 'tomorrow morning' in lower_prompt:
                time_expr = 'tomorrow morning'
            elif 'tomorrow' in lower_prompt or 'कल' in prompt:
                time_expr = 'tomorrow'
            elif 'tonight' in lower_prompt or 'आज रात' in prompt:
                time_expr = 'tonight'
            elif 'today' in lower_prompt or 'आज' in prompt:
                time_expr = 'today'

            # Detect activity
            if 'fish' in lower_prompt or 'मछली' in prompt or 'fishing' in lower_prompt:
                activity = 'fishing'

            # Detect intents
            if any(k in lower_prompt for k in ['boundary', 'geofence', 'restricted', 'सीमा']):
                intent = 'geofence_question'
                required_caps = ['geospatial', 'hazards']
            elif any(k in lower_prompt for k in ['route', 'रास्ता', 'मार्ग']):
                intent = 'route_request'
                required_caps = ['pfz', 'hazards', 'geospatial']
            elif any(k in lower_prompt for k in [
                'where should i fish', 'where can i fish', 'where to fish',
                'कहाँ मछली', 'मछली कहाँ',
            ]):
                intent = 'nearest_safe_pfz'
                required_caps = ['pfz', 'weather', 'ocean', 'hazards', 'geospatial']
            elif any(k in lower_prompt for k in ['safe', 'सुरक्षित', 'safety', 'जाना safe', 'risk']):
                if any(k in lower_prompt for k in ['pfz', 'fishing zone', 'मछली']):
                    intent = 'nearest_safe_pfz'
                    required_caps = ['pfz', 'weather', 'ocean', 'hazards', 'geospatial']
                else:
                    intent = 'marine_safety'
                    required_caps = ['weather', 'ocean', 'hazards', 'geospatial']
            elif any(k in lower_prompt for k in ['nearest pfz', 'find pfz', 'fishing zone', 'मछली पकड़ने का क्षेत्र']):
                intent = 'nearest_pfz'
                required_caps = ['pfz', 'geospatial']
            elif any(k in lower_prompt for k in ['wave', 'swell', 'current', 'लहर', 'तरंग']):
                intent = 'ocean_conditions'
                required_caps = ['ocean']
            elif any(k in lower_prompt for k in ['weather', 'wind', 'rain', 'तूफान', 'मौसम', 'हवा']):
                intent = 'weather_conditions'
                required_caps = ['weather']
            elif any(k in lower_prompt for k in ['hazard', 'cyclone', 'warning', 'अलर्ट', 'चेतावनी']):
                intent = 'hazard_check'
                required_caps = ['hazards']
            elif any(k in lower_prompt for k in ['sst', 'temperature', 'तापमान']):
                intent = 'sst_analysis'
                required_caps = ['satellite', 'ocean']
            elif any(k in lower_prompt for k in ['chlorophyll', 'क्लोरोफिल']):
                intent = 'chlorophyll_analysis'
                required_caps = ['satellite']
            elif any(k in lower_prompt for k in ['productivity', 'fish decline', 'catch', 'उत्पादकता']):
                intent = 'productivity_analysis'
                required_caps = ['satellite', 'ocean', 'weather']
            elif any(k in lower_prompt for k in ['route', 'रास्ता', 'मार्ग']):
                intent = 'route_request'
                required_caps = ['pfz', 'hazards', 'geospatial']
            elif any(k in lower_prompt for k in ['boundary', 'geofence', 'restricted', 'सीमा']):
                intent = 'geofence_question'
                required_caps = ['geospatial', 'hazards']
            elif any(k in lower_prompt for k in ['why not', 'second one', 'पहला', 'दूसरा']):
                intent = 'follow_up'
                required_caps = ['pfz', 'ocean', 'weather']

            mock_data = {
                "intent": intent,
                "language": "hi" if is_hindi else "en",
                "location": {"name": location_name, "lat": None, "lon": None},
                "time_expression": time_expr,
                "entities": {"activity": activity} if activity else {},
                "required_capabilities": required_caps,
                "confidence": 0.95
            }
            return schema.model_validate(mock_data)

        # 2. Planner schema
        if 'plan' in schema_name and 'explanation' not in schema_name:
            tasks = []
            # Parse requested capabilities or goals from prompt
            has_pfz = 'pfz' in lower_prompt
            has_weather = 'weather' in lower_prompt
            has_ocean = 'ocean' in lower_prompt
            has_hazards = 'hazard' in lower_prompt or 'hazard' in lower_prompt
            has_geo = 'geospatial' in lower_prompt
            has_sat = 'satellite' in lower_prompt

            if has_pfz:
                tasks.append({
                    "id": "task_1",
                    "agent": "pfz_agent",
                    "action": "find_candidates",
                    "depends_on": [],
                    "params": {"limit": 3}
                })
                deps = ["task_1"]
                t_idx = 2
                if has_weather:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "weather_agent",
                        "action": "conditions_for_candidates",
                        "depends_on": deps,
                        "params": {}
                    })
                    t_idx += 1
                if has_ocean:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "ocean_agent",
                        "action": "conditions_for_candidates",
                        "depends_on": deps,
                        "params": {}
                    })
                    t_idx += 1
                if has_hazards:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "hazard_agent",
                        "action": "check_candidate_hazards",
                        "depends_on": deps,
                        "params": {}
                    })
                    t_idx += 1
                if has_geo:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "geospatial_agent",
                        "action": "check_candidate_zones",
                        "depends_on": deps,
                        "params": {}
                    })
                    t_idx += 1
            else:
                # Direct origin evaluation
                t_idx = 1
                if has_weather:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "weather_agent",
                        "action": "conditions_for_location",
                        "depends_on": [],
                        "params": {}
                    })
                    t_idx += 1
                if has_ocean:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "ocean_agent",
                        "action": "conditions_for_location",
                        "depends_on": [],
                        "params": {}
                    })
                    t_idx += 1
                if has_hazards:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "hazard_agent",
                        "action": "check_hazards",
                        "depends_on": [],
                        "params": {}
                    })
                    t_idx += 1
                if has_sat:
                    tasks.append({
                        "id": f"task_{t_idx}",
                        "agent": "satellite_agent",
                        "action": "get_sst",
                        "depends_on": [],
                        "params": {}
                    })
                    t_idx += 1

            mock_data = {
                "goal": "Execute marine intelligence analysis for query requirements",
                "tasks": tasks
            }
            return schema.model_validate(mock_data)

        # 3. Explanation schema
        if 'explanation' in schema_name:
            mock_data = {
                "answer": "समुद्र और मौसम की स्थिति का विश्लेषण पूरा हो गया है।" if is_hindi else "Marine analysis completed based on verified observational data.",
                "reasoning_summary": [
                    {
                        "factor": "marine_conditions",
                        "finding": "Forecast observational data evaluated for specified time and coordinates.",
                        "evidence_ids": []
                    }
                ],
                "observations": ["Wind and wave parameters were evaluated."],
                "warnings": [],
                "sources": ["INCOIS", "Open-Meteo"],
                "confidence": 0.90,
                "limitations": "Forecast valid for indicated period only. Always observe real-time harbor signals."
            }
            return schema.model_validate(mock_data)

        # Generic fallback
        return schema.model_validate({})


class OpenAILLMProvider(LLMProvider):
    """OpenAI API Provider (GPT-4o, etc.)."""

    def __init__(self, api_key: str, model: str = 'gpt-4o-mini', base_url: str = 'https://api.openai.com/v1'):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def generate_text(self, prompt: str, system_prompt: str | None = None, temperature: float = 0.1, max_tokens: int = 2048) -> str:
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': prompt})

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f'{self.base_url}/chat/completions',
                headers=headers,
                json={'model': self.model, 'messages': messages, 'temperature': temperature, 'max_tokens': max_tokens}
            )
            resp.raise_for_status()
            data = resp.json()
            return data['choices'][0]['message']['content']

    async def generate_structured(self, prompt: str, schema: Type[T], system_prompt: str | None = None, temperature: float = 0.0) -> T:
        schema_json = json.dumps(schema.model_json_schema())
        augmented_prompt = f"{prompt}\n\nReturn strictly a JSON object matching this JSON Schema:\n{schema_json}"
        raw = await self.generate_text(augmented_prompt, system_prompt=system_prompt, temperature=temperature)
        return parse_structured_output(raw, schema)


class GeminiLLMProvider(LLMProvider):
    """Google Gemini LLM Provider."""

    def __init__(self, api_key: str, model: str = 'gemini-1.5-flash'):
        self.api_key = api_key
        self.model = model
        self.endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'

    async def generate_text(self, prompt: str, system_prompt: str | None = None, temperature: float = 0.1, max_tokens: int = 2048) -> str:
        contents = []
        if system_prompt:
            contents.append({'role': 'user', 'parts': [{'text': f'System Instructions:\n{system_prompt}'}]})
            contents.append({'role': 'model', 'parts': [{'text': 'Understood. I will strictly follow these instructions.'}]})
        contents.append({'role': 'user', 'parts': [{'text': prompt}]})

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.endpoint,
                headers={'Content-Type': 'application/json'},
                json={
                    'contents': contents,
                    'generationConfig': {'temperature': temperature, 'maxOutputTokens': max_tokens}
                }
            )
            resp.raise_for_status()
            data = resp.json()
            return data['candidates'][0]['content']['parts'][0]['text']

    async def generate_structured(self, prompt: str, schema: Type[T], system_prompt: str | None = None, temperature: float = 0.0) -> T:
        schema_json = json.dumps(schema.model_json_schema())
        augmented_prompt = f"{prompt}\n\nRespond ONLY with a valid JSON object matching this schema:\n{schema_json}\nNo markdown ticks or extra conversational text."
        raw = await self.generate_text(augmented_prompt, system_prompt=system_prompt, temperature=temperature)
        return parse_structured_output(raw, schema)


def get_llm_provider(settings: Settings) -> LLMProvider:
    """Factory creating the appropriate LLM provider based on settings."""
    provider = settings.llm_provider.lower()
    if provider in ('gemini', 'google') and settings.llm_api_key:
        return GeminiLLMProvider(api_key=settings.llm_api_key, model=settings.llm_model or 'gemini-1.5-flash')
    elif provider == 'openai' and settings.llm_api_key:
        return OpenAILLMProvider(api_key=settings.llm_api_key, model=settings.llm_model or 'gpt-4o-mini')
    elif provider == 'groq' and settings.llm_api_key:
        return OpenAILLMProvider(api_key=settings.llm_api_key, model=settings.llm_model or 'llama-3.3-70b-versatile', base_url='https://api.groq.com/openai/v1')
    return MockLLMProvider()

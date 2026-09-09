import logging
from backend.agents.schemas import IntentOutput
from backend.llm.base import LLMProvider
from backend.llm.prompts import INTENT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class IntentAgent:
    """Agent that classifies user queries into structured marine intents, entities, and capabilities."""

    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def detect_intent(
        self,
        query: str,
        context_dict: dict | None = None,
        language_hint: str | None = None,
    ) -> IntentOutput:
        # Prompt injection protection: sanitize input
        clean_query = query.replace("```", "").strip()
        if len(clean_query) > 1000:
            clean_query = clean_query[:1000]

        ctx_str = ""
        if context_dict:
            last_intent = context_dict.get('last_intent')
            curr_loc = context_dict.get('current_location')
            ctx_str = f"\nConversation Context: last_intent={last_intent}, current_location={curr_loc}"

        prompt = f"""Analyze this user query:
"{clean_query}"{ctx_str}
Language Hint: {language_hint or 'auto'}

Extract:
1. Marine intent (one of the 15 supported intents)
2. ISO 639-1 language code (e.g. 'hi', 'en', 'ta', 'te', etc.)
3. Named coastal location (name only, lat/lon should be null if not explicitly in text)
4. Time expression verbatim
5. Activity (e.g. fishing, sailing)
6. Required capabilities list from: ['pfz', 'weather', 'ocean', 'hazards', 'geospatial', 'satellite']
"""

        try:
            return await self.llm.generate_structured(
                prompt=prompt,
                schema=IntentOutput,
                system_prompt=INTENT_SYSTEM_PROMPT,
                temperature=0.0,
            )
        except Exception as exc:
            logger.warning("intent_extraction_llm_failed: %s; falling back", exc)
            # Fallback intent
            return IntentOutput(
                intent='marine_safety',
                language=language_hint or 'en',
                location={'name': None, 'lat': None, 'lon': None},
                time_expression=None,
                entities={},
                required_capabilities=['weather', 'ocean', 'hazards'],
                confidence=0.8,
            )

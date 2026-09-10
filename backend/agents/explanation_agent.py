import json
import logging
from backend.agents.schemas import EvidenceItem, ExplanationOutput, ReasoningItem
from backend.llm.base import LLMProvider
from backend.llm.prompts import EXPLANATION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class ExplanationAgent:
    """Synthesizes an evidence-grounded multilingual explanation in the user's language."""

    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def explain(
        self,
        query: str,
        intent: str,
        evidence: list[EvidenceItem],
        warnings: list[str],
        language: str = 'en',
        location_name: str | None = None,
        recommended_pfz: dict | None = None,
        analysis: dict | None = None,
    ) -> ExplanationOutput:
        from backend.llm.provider import MockLLMProvider
        if isinstance(self.llm, MockLLMProvider):
            return self._deterministic_fallback(query, intent, evidence,
                warnings + ['Rule-based language fallback; no live LLM is configured.'],
                language, location_name, sorted({ev.source for ev in evidence}),
                recommended_pfz, analysis)
        # Build strict evidence context summary for prompt
        ev_summary = []
        sources = set()
        for ev in evidence:
            ev_summary.append(
                f"- [{ev.id}] {ev.parameter}: {ev.value} {ev.unit or ''} (Source: {ev.source}, Quality: {ev.quality})"
            )
            sources.add(ev.source)

        ev_text = "\n".join(ev_summary) if ev_summary else "No verified evidence retrieved."
        warn_text = "\n".join(f"- Warning: {w}" for w in warnings) if warnings else "No active warnings."

        prompt = f"""User Query: "{query}"
Intent: {intent}
Language: {language}
Location: {location_name or 'Coastal waters'}
Recommended PFZ: {recommended_pfz.get('name') if recommended_pfz else 'None'}

VERIFIED EVIDENCE:
{ev_text}

DATA WARNINGS & GAPS:
{warn_text}

DETERMINISTIC SAFETY RESULT:
{json.dumps(analysis or {}, ensure_ascii=False, default=str)}

Instructions:
Generate a structured explanation in language '{language}'.
- State the direct answer clearly.
- If data is unavailable, acknowledge it directly.
- Tie findings to the exact evidence IDs listed above.
- NEVER invent values not present in the evidence list.
"""

        try:
            explanation = await self.llm.generate_structured(
                prompt=prompt,
                schema=ExplanationOutput,
                system_prompt=EXPLANATION_SYSTEM_PROMPT.format(language=language),
                temperature=0.0,
            )
            explanation.sources = sorted(list(sources))
            explanation.warnings = list(dict.fromkeys(warnings + explanation.warnings))
            return explanation
        except Exception as exc:
            logger.warning("llm_explanation_failed: %s; falling back to deterministic explanation", exc)
            return self._deterministic_fallback(
                query, intent, evidence, warnings, language, location_name,
                list(sources), recommended_pfz, analysis
            )

    def _deterministic_fallback(
        self,
        query: str,
        intent: str,
        evidence: list[EvidenceItem],
        warnings: list[str],
        language: str,
        location_name: str | None,
        sources: list[str],
        recommended_pfz: dict | None = None,
        analysis: dict | None = None,
    ) -> ExplanationOutput:
        loc_str = location_name or "इस क्षेत्र" if language == 'hi' else location_name or "this area"
        reasoning = []
        observations = []

        # Find key metrics
        wave_ev = next((e for e in evidence if e.parameter == 'significant_wave_height' and e.value is not None), None)
        wind_ev = next((e for e in evidence if e.parameter == 'wind_speed' and e.value is not None), None)
        pfz_ev = next((e for e in evidence if 'pfz' in e.parameter.lower()), None)

        direct = []
        analysis = analysis or {}
        risk = analysis.get('risk')
        ranked = analysis.get('recommended_pfz') or recommended_pfz
        route = analysis.get('route')
        geofence = analysis.get('geofence')

        if language == 'hi':
            if risk:
                direct.append(
                    f"प्रोटोटाइप सुरक्षा आकलन: {risk['level']} जोखिम, स्कोर {risk['score']}/100 और डेटा विश्वास {round(risk['confidence'] * 100)}%।"
                )
            if ranked:
                direct.append(
                    f"शीर्ष पात्र PFZ {ranked.get('name')} है, जो लगभग {ranked.get('distance_km')} किमी दूर है।"
                )
            elif intent in ('nearest_safe_pfz', 'nearest_pfz'):
                direct.append('कोई PFZ सुरक्षा जांच पास नहीं कर सका, इसलिए कोई गंतव्य सुझाया नहीं गया है।')
            if geofence:
                if geofence.get('status') == 'SAFE':
                    direct.append('रिकॉर्ड किए गए डेमो क्षेत्र में कोई समुद्री सीमा चेतावनी नहीं मिली।')
                else:
                    direct.append(f"समुद्री सीमा स्थिति: {geofence.get('status')}।")
            if wave_ev and wind_ev:
                observations.append(f"लहरों की ऊंचाई {wave_ev.value} {wave_ev.unit or 'm'} और हवा की गति {wind_ev.value} {wind_ev.unit or 'm/s'} है।")
            elif pfz_ev:
                observations.append(f"{loc_str} के पास PFZ लगभग {pfz_ev.value} {pfz_ev.unit or 'km'} दूर है।")
            else:
                observations.append(f"{loc_str} के लिए पर्याप्त समुद्री माप उपलब्ध नहीं हैं।")

            answer = ' '.join(direct + observations)

            if wave_ev:
                reasoning.append(ReasoningItem(factor="तरंग ऊंचाई", finding=f"लहरों की ऊंचाई {wave_ev.value} {wave_ev.unit or 'm'} है।", evidence_ids=[wave_ev.id]))
            if wind_ev:
                reasoning.append(ReasoningItem(factor="पवन गति", finding=f"हवा की गति {wind_ev.value} {wind_ev.unit or 'm/s'} है।", evidence_ids=[wind_ev.id]))
            limitations = "पूर्वानुमान केवल सीमित समय के लिए मान्य है। बंदरगाह के संकेतों का पालन करें।"
        else:
            if risk:
                direct.append(
                    f"Prototype safety assessment: {risk['level']} risk, score {risk['score']}/100, with {round(risk['confidence'] * 100)}% data confidence."
                )
            if ranked:
                direct.append(
                    f"The top eligible PFZ is {ranked.get('name')}, approximately {ranked.get('distance_km')} km away."
                )
            elif intent in ('nearest_safe_pfz', 'nearest_pfz'):
                direct.append('No PFZ passed the safety gates, so no destination is recommended.')
            if route:
                direct.append(
                    f"The demo route is {route.get('total_distance_km')} km with {route.get('overall_risk_level')} sampled risk."
                )
            if geofence:
                if geofence.get('status') == 'SAFE':
                    direct.append('No boundary warning was found within the recorded demo coverage.')
                else:
                    direct.append(f"Geofence status: {geofence.get('status')}.")

            if wave_ev and wind_ev:
                observations.append(f"Significant wave height is {wave_ev.value} {wave_ev.unit or 'm'} and wind speed is {wind_ev.value} {wind_ev.unit or 'm/s'} at {loc_str}.")
            elif pfz_ev:
                observations.append(f"A PFZ near {loc_str} is approximately {pfz_ev.value} {pfz_ev.unit or 'km'} away.")
            elif wind_ev:
                observations.append(f"Wind speed is {wind_ev.value} {wind_ev.unit or ''} at {loc_str}, from {wind_ev.source}.")
            elif wave_ev:
                observations.append(f"Significant wave height is {wave_ev.value} {wave_ev.unit or ''} at {loc_str}, from {wave_ev.source}.")
            elif not evidence:
                observations.append('No marine measurements were retrieved. Provide a coastal location or coordinates and review the reported source errors.')
            else:
                observations.append(f"Available marine evidence for {loc_str} is incomplete.")

            answer = ' '.join(direct + observations)

            if wave_ev:
                reasoning.append(ReasoningItem(factor="wave_height", finding=f"Wave height is {wave_ev.value} {wave_ev.unit or 'm'}.", evidence_ids=[wave_ev.id]))
            if wind_ev:
                reasoning.append(ReasoningItem(factor="wind_speed", finding=f"Wind speed is {wind_ev.value} {wind_ev.unit or 'm/s'}.", evidence_ids=[wind_ev.id]))
            limitations = "Forecast valid for indicated period only. Always observe local harbor signals."

        return ExplanationOutput(
            answer=answer,
            reasoning_summary=reasoning,
            observations=observations,
            warnings=warnings,
            sources=sources,
            confidence=0.90 if evidence else 0.50,
            limitations=limitations,
        )

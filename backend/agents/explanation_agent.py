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
    ) -> ExplanationOutput:
        from backend.llm.provider import MockLLMProvider
        if isinstance(self.llm, MockLLMProvider):
            return self._deterministic_fallback(query, intent, evidence,
                warnings + ['Rule-based language fallback; no live LLM is configured.'],
                language, location_name, sorted({ev.source for ev in evidence}))
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
                query, intent, evidence, warnings, language, location_name, list(sources)
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
    ) -> ExplanationOutput:
        loc_str = location_name or "इस क्षेत्र" if language == 'hi' else location_name or "this area"
        reasoning = []
        observations = []

        # Find key metrics
        wave_ev = next((e for e in evidence if e.parameter == 'significant_wave_height' and e.value is not None), None)
        wind_ev = next((e for e in evidence if e.parameter == 'wind_speed' and e.value is not None), None)
        pfz_ev = next((e for e in evidence if 'pfz' in e.parameter.lower()), None)

        if language == 'hi':
            if wave_ev and wind_ev:
                answer = f"{loc_str} में समुद्र की स्थिति का अवलोकन किया गया है। लहरों की ऊंचाई {wave_ev.value} {wave_ev.unit or 'm'} और हवा की गति {wind_ev.value} {wind_ev.unit or 'm/s'} दर्ज की गई है।"
            elif pfz_ev:
                answer = f"{loc_str} के पास संभावित मत्स्य पालन क्षेत्र (PFZ) लगभग {pfz_ev.value} {pfz_ev.unit or 'km'} की दूरी पर स्थित है।"
            else:
                answer = f"{loc_str} के लिए समुद्री डेटा का सत्यापन कर लिया गया है।"

            if wave_ev:
                reasoning.append(ReasoningItem(factor="तरंग ऊंचाई", finding=f"लहरों की ऊंचाई {wave_ev.value} {wave_ev.unit or 'm'} है।", evidence_ids=[wave_ev.id]))
            if wind_ev:
                reasoning.append(ReasoningItem(factor="पवन गति", finding=f"हवा की गति {wind_ev.value} {wind_ev.unit or 'm/s'} है।", evidence_ids=[wind_ev.id]))
            limitations = "पूर्वानुमान केवल सीमित समय के लिए मान्य है। बंदरगाह के संकेतों का पालन करें।"
        else:
            if wave_ev and wind_ev:
                answer = f"Conditions at {loc_str} have been evaluated. Significant wave height is {wave_ev.value} {wave_ev.unit or 'm'} and wind speed is {wind_ev.value} {wind_ev.unit or 'm/s'}."
            elif pfz_ev:
                answer = f"A Potential Fishing Zone near {loc_str} is located approximately {pfz_ev.value} {pfz_ev.unit or 'km'} away."
            elif wind_ev:
                answer = f"Wind speed at {loc_str} is {wind_ev.value} {wind_ev.unit or ''}, from {wind_ev.source}. Review forecast time and data gaps before departure."
            elif wave_ev:
                answer = f"Significant wave height at {loc_str} is {wave_ev.value} {wave_ev.unit or ''}, from {wave_ev.source}. Review forecast time and data gaps before departure."
            elif not evidence:
                answer = 'No marine measurements were retrieved. Provide a coastal location or coordinates and review the reported source errors.'
            else:
                answer = f"Available marine evidence for {loc_str} is shown below. A complete safety assessment is unavailable."

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

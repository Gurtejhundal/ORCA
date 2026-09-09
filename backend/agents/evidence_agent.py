from datetime import datetime
from typing import Any
from backend.agents.schemas import EvidenceItem


class EvidenceAggregator:
    """Aggregates and verifies evidence items across all agent outputs, checking completeness and conflicts."""

    def aggregate(
        self,
        raw_evidence: list[EvidenceItem],
        expected_categories: list[str] | None = None,
    ) -> dict[str, Any]:
        expected = expected_categories or ['weather', 'ocean']
        categorized: dict[str, list[EvidenceItem]] = {
            'pfz': [],
            'weather': [],
            'ocean': [],
            'hazards': [],
            'satellite': [],
            'geospatial': [],
        }

        seen_ids = set()
        unique_items: list[EvidenceItem] = []
        conflicts = []

        # Deduplicate and categorize
        parameter_values: dict[str, list[EvidenceItem]] = {}
        for item in raw_evidence:
            if item.id in seen_ids:
                continue
            seen_ids.add(item.id)
            unique_items.append(item)

            # Categorize
            p = item.parameter.lower()
            if 'pfz' in p:
                categorized['pfz'].append(item)
            elif any(w in p for w in ['wind', 'gust', 'rain', 'precip', 'visibility', 'thunderstorm']):
                categorized['weather'].append(item)
            elif any(o in p for o in ['wave', 'swell', 'current', 'sea_level']):
                categorized['ocean'].append(item)
            elif any(h in p for h in ['hazard', 'cyclone', 'warning', 'alert']):
                categorized['hazards'].append(item)
            elif any(s in p for s in ['sst', 'chlorophyll']):
                categorized['satellite'].append(item)
            else:
                categorized['geospatial'].append(item)

            # Check for conflicting parameter reports at same location
            key = f"{item.parameter}_{item.location.get('lat')}_{item.location.get('lon')}"
            parameter_values.setdefault(key, []).append(item)

        # Detect source conflicts (e.g. if two providers disagree significantly on wave height)
        for key, items in parameter_values.items():
            if len(items) > 1:
                vals = [i.value for i in items if isinstance(i.value, (int, float))]
                if len(vals) > 1 and (max(vals) - min(vals)) > (0.5 * min(vals)):
                    conflicts.append({
                        'parameter': items[0].parameter,
                        'sources': [i.source for i in items],
                        'values': vals,
                        'severity': 'medium',
                    })

        # Calculate completeness
        present_categories = [k for k, v in categorized.items() if len(v) > 0 and k in expected]
        completeness = len(present_categories) / max(1, len(expected))

        return {
            'pfz': [i.model_dump() for i in categorized['pfz']],
            'weather': [i.model_dump() for i in categorized['weather']],
            'ocean': [i.model_dump() for i in categorized['ocean']],
            'hazards': [i.model_dump() for i in categorized['hazards']],
            'satellite': [i.model_dump() for i in categorized['satellite']],
            'geospatial': [i.model_dump() for i in categorized['geospatial']],
            'all_evidence': unique_items,
            'completeness': round(completeness, 2),
            'conflicts': conflicts,
            'is_any_stale': any(i.is_stale for i in unique_items),
        }

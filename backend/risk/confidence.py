from datetime import datetime, timezone
from typing import Any
from backend.agents.schemas import EvidenceItem

CRITICAL_VARIABLES = {'significant_wave_height', 'wind_speed'}
DESIRABLE_VARIABLES = {'wave_period', 'wind_gust', 'current_speed', 'visibility', 'sst'}


def calculate_data_confidence(
    evidence_list: list[EvidenceItem] | list[dict[str, Any]],
    requested_time: datetime | None = None,
) -> tuple[float, list[str]]:
    """Calculate deterministic confidence (0.0 - 1.0) in available marine data."""
    if not evidence_list:
        return 0.10, list(CRITICAL_VARIABLES)

    # Normalize items to dict or model
    param_map: dict[str, Any] = {}
    stale_count = 0
    official_count = 0

    for item in evidence_list:
        p = item.parameter if isinstance(item, EvidenceItem) else item.get('parameter')
        q = item.quality if isinstance(item, EvidenceItem) else item.get('quality', 'unknown')
        s = item.is_stale if isinstance(item, EvidenceItem) else item.get('is_stale', False)
        value = item.value if isinstance(item, EvidenceItem) else item.get('value')
        if p and value is not None and not s:
            param_map[p] = item
        if s:
            stale_count += 1
        if q in ('official', 'official_warning'):
            official_count += 1

    # 1. Critical coverage check
    missing_critical = [v for v in CRITICAL_VARIABLES if v not in param_map]
    critical_coverage = (len(CRITICAL_VARIABLES) - len(missing_critical)) / len(CRITICAL_VARIABLES)

    # 2. Desirable coverage check
    present_desirable = [v for v in DESIRABLE_VARIABLES if v in param_map]
    desirable_coverage = len(present_desirable) / len(DESIRABLE_VARIABLES)

    # 3. Source quality & authority
    total_items = max(1, len(evidence_list))
    authority_score = official_count / total_items

    # 4. Freshness penalty
    freshness_score = 1.0 - (stale_count / total_items * 0.4)

    # Combined confidence formula
    # If critical variables are missing, cap confidence at 0.50
    raw_confidence = (
        (0.45 * critical_coverage) +
        (0.25 * desirable_coverage) +
        (0.15 * authority_score) +
        (0.15 * freshness_score)
    )

    if missing_critical:
        raw_confidence = min(raw_confidence, 0.45)

    final_confidence = max(0.10, min(0.98, round(raw_confidence, 2)))
    return final_confidence, missing_critical

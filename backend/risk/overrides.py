from typing import Any
from backend.risk.models import OfficialOverride, RiskLevel
from backend.risk.config import RISK_CONFIG


def evaluate_official_overrides(
    alerts: list[dict[str, Any]],
    zone_intersections: list[dict[str, Any]] | None = None,
) -> tuple[bool, RiskLevel | None, list[OfficialOverride]]:
    """Evaluate whether official authoritative warnings or regulatory boundaries override weighted scoring."""
    overrides: list[OfficialOverride] = []
    highest_level: RiskLevel | None = None

    # 1. Official cyclone or severe storm alerts
    for alert in alerts:
        title = (alert.get('title') or alert.get('name') or '').lower()
        atype = (alert.get('type') or alert.get('category') or '').lower()
        severity = (alert.get('severity') or '').lower()

        if 'cyclone' in title or 'cyclone' in atype or 'storm_surge' in atype or severity in ('severe', 'extreme'):
            highest_level = 'EXTREME'
            overrides.append(
                OfficialOverride(
                    override=True,
                    type='CYCLONE_OR_SEVERE_WEATHER_WARNING',
                    source=alert.get('source') or 'IMD / INCOIS Official Warning',
                    description=f"Active severe alert in area: {alert.get('title') or alert.get('name')}"
                )
            )
        elif 'high_wave' in atype or 'high wave' in title or severity in ('elevated', 'high', 'warning'):
            if highest_level != 'EXTREME':
                highest_level = 'HIGH'
            overrides.append(
                OfficialOverride(
                    override=True,
                    type='HIGH_WAVE_ADVISORY',
                    source=alert.get('source') or 'INCOIS High Wave Advisory',
                    description=f"Active high wave advisory: {alert.get('title') or alert.get('name')}"
                )
            )

    # 2. Regulatory restricted or prohibited marine zones
    if zone_intersections:
        for zone in zone_intersections:
            ztype = (zone.get('type') or zone.get('zone_type') or '').lower()
            severity = (zone.get('severity') or '').lower()
            if ztype in ('restricted', 'prohibited', 'military') or severity in ('forbidden', 'critical'):
                highest_level = 'EXTREME'
                overrides.append(
                    OfficialOverride(
                        override=True,
                        type='RESTRICTED_MARITIME_ZONE',
                        source=zone.get('source') or 'Official Maritime Administration / DG Shipping',
                        description=f"Location or route intersects restricted boundary: {zone.get('name') or zone.get('zone_name')}"
                    )
                )

    has_override = len(overrides) > 0
    return has_override, highest_level, overrides

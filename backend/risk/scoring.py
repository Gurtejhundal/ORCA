from datetime import datetime, timezone
from typing import Any
from backend.agents.schemas import EvidenceItem
from backend.risk.config import RISK_CONFIG
from backend.risk.confidence import calculate_data_confidence
from backend.risk.models import (
    OfficialOverride,
    RiskAssessment,
    RiskFactor,
    RiskLevel,
    VesselProfile,
)
from backend.risk.overrides import evaluate_official_overrides


def clamp(val: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, val))


def determine_level(score: int, missing_critical: list[str]) -> RiskLevel:
    if missing_critical and score <= 60:
        return 'UNKNOWN'
    if score <= 35:
        return 'LOW'
    elif score <= 60:
        return 'MODERATE'
    elif score <= 80:
        return 'HIGH'
    else:
        return 'EXTREME'


def calculate_risk_assessment(
    evidence_list: list[EvidenceItem] | list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    zone_intersections: list[dict[str, Any]] | None = None,
    vessel_profile_id: str = 'small_fishing_boat',
    requested_time: datetime | None = None,
) -> RiskAssessment:
    """Calculate deterministic marine risk score (0-100), level, and factor explainability."""
    # 1. Retrieve vessel profile configuration
    profiles = RISK_CONFIG["vessel_profiles"]
    vessel_cfg = profiles.get(vessel_profile_id, profiles["small_fishing_boat"])
    sensitivity = vessel_cfg.get("risk_sensitivity", 1.0)

    # 2. Extract observations
    obs_map: dict[str, Any] = {}
    ev_id_map: dict[str, str] = {}
    units: dict[str, str | None] = {}
    for item in evidence_list:
        p = item.parameter if isinstance(item, EvidenceItem) else item.get('parameter')
        val = item.value if isinstance(item, EvidenceItem) else item.get('value')
        eid = item.id if isinstance(item, EvidenceItem) else item.get('id', '')
        if p and val is not None:
            obs_map[p] = val
            ev_id_map[p] = eid
            units[p] = item.unit if isinstance(item, EvidenceItem) else item.get('unit')

    # 3. Calculate data confidence
    confidence, missing_critical = calculate_data_confidence(evidence_list, requested_time)

    # 4. Evaluate official overrides
    has_override, override_level, overrides = evaluate_official_overrides(alerts, zone_intersections)

    # 5. Calculate component factor risks (0.0 to 1.0)
    norm = RISK_CONFIG["normalization"]
    weights = RISK_CONFIG["weights"]

    # Wave Factor
    wave_h = float(obs_map.get('significant_wave_height', 0))
    wave_ratio = clamp(wave_h / norm["wave_height_m"])
    wave_contrib = int(round(wave_ratio * weights["wave"] * 100 * sensitivity))
    wave_ev_ids = [ev_id_map['significant_wave_height']] if 'significant_wave_height' in ev_id_map else []
    wave_finding = f"Significant wave height is {wave_h:.1f} m" + (" (Elevated wave conditions)" if wave_h >= 2.0 else " (Normal sea state)")

    # Wind Factor
    wind_spd = float(obs_map.get('wind_speed', 0))
    wind_ratio = clamp(wind_spd / norm["wind_speed_ms"])
    wind_contrib = int(round(wind_ratio * weights["wind"] * 100 * sensitivity))
    wind_ev_ids = [ev_id_map['wind_speed']] if 'wind_speed' in ev_id_map else []
    wind_finding = f"Forecast wind speed is {wind_spd:.1f} m/s" + (" (Strong breeze/gale risk)" if wind_spd >= 10.0 else " (Moderate wind)")

    # Hazards Factor
    hazard_ratio = 1.0 if any('cyclone' in str(a).lower() for a in alerts) else 0.5 if alerts else 0.0
    hazard_contrib = int(round(hazard_ratio * weights["hazards"] * 100))
    hazard_finding = f"{len(alerts)} advisories or warnings returned" if alerts else "No alerts returned; this does not establish warning coverage or an all-clear"

    # Current Factor
    curr_spd = float(obs_map.get('current_speed', 0))
    curr_ratio = clamp(curr_spd / norm["current_speed_ms"])
    curr_contrib = int(round(curr_ratio * weights["currents"] * 100))
    curr_finding = f"Current velocity is {curr_spd:.2f} m/s"

    # Weather (Rain / Thunderstorm / Gusts) Factor
    gust_spd = float(obs_map.get('wind_gust', 0))
    thunderstorm = bool(obs_map.get('thunderstorms', False))
    weather_ratio = clamp((0.5 if thunderstorm else 0.0) + (0.5 * (gust_spd / 25.0)))
    weather_contrib = int(round(weather_ratio * weights["weather"] * 100))
    weather_finding = "Thunderstorm activity forecast" if thunderstorm else f"Peak wind gusts up to {gust_spd:.1f} m/s"

    # Visibility Factor
    vis_km = float(obs_map.get('visibility', 0))
    if units.get('visibility') == 'm':
        vis_km /= 1000
    vis_ratio = clamp(1.0 - (vis_km / norm["visibility_km"]))
    vis_contrib = int(round(vis_ratio * weights["visibility"] * 100))
    vis_finding = f"Surface visibility is approximately {vis_km:.1f} km"

    # Missing measurements contribute no measured risk, but are never presented
    # as observations. Critical gaps force UNKNOWN unless measured hazards are high.
    if 'significant_wave_height' not in obs_map:
        wave_finding = 'Significant wave height unavailable'
    if 'wind_speed' not in obs_map:
        wind_finding = 'Wind speed unavailable'
    if 'current_speed' not in obs_map:
        curr_finding = 'Ocean current speed unavailable'
    if 'wind_gust' not in obs_map and not thunderstorm:
        weather_finding = 'Wind gust and thunderstorm assessment unavailable'
    if 'visibility' not in obs_map:
        vis_contrib = 0
        vis_finding = 'Visibility unavailable'

    factors = [
        RiskFactor(factor="wave_height", contribution=wave_contrib, finding=wave_finding, evidence_ids=wave_ev_ids),
        RiskFactor(factor="wind_speed", contribution=wind_contrib, finding=wind_finding, evidence_ids=wind_ev_ids),
        RiskFactor(factor="marine_hazards", contribution=hazard_contrib, finding=hazard_finding, evidence_ids=[]),
        RiskFactor(factor="ocean_currents", contribution=curr_contrib, finding=curr_finding, evidence_ids=[]),
        RiskFactor(factor="weather_gusts", contribution=weather_contrib, finding=weather_finding, evidence_ids=[]),
        RiskFactor(factor="visibility", contribution=vis_contrib, finding=vis_finding, evidence_ids=[]),
    ]

    # 6. Aggregate Score
    raw_score = sum(f.contribution for f in factors)

    # 7. Apply official overrides if triggered
    final_score = raw_score
    if has_override and override_level == 'EXTREME':
        final_score = max(final_score, 88)
        level: RiskLevel = 'EXTREME'
    elif has_override and override_level == 'HIGH':
        final_score = max(final_score, 68)
        level = 'HIGH'
    else:
        final_score = min(100, max(0, final_score))
        level = determine_level(final_score, missing_critical)

    return RiskAssessment(
        score=final_score,
        level=level,
        factors=factors,
        official_overrides=overrides,
        confidence=confidence,
        missing_critical_data=missing_critical,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

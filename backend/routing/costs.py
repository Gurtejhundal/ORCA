"""Cost calculations for A* marine routing."""
from __future__ import annotations
from typing import Dict, Any, Optional
from backend.risk.config import DEFAULT_VESSEL_PROFILES, VESSEL_SENSITIVITY


def calculate_segment_cost(
    distance_km: float,
    wave_height_m: float,
    wind_speed_kts: float,
    is_hazard: bool,
    is_restricted: bool,
    is_land: bool,
    optimization_preference: str = "safety_first",
    vessel_type: str = "small_fishing_boat",
) -> float:
    """Calculate the deterministic cost of traversing a grid segment.

    Cost is infinite for land and restricted zones.
    For navigable waters, cost balances distance, wave height, wind, and hazard zones.
    """
    if is_land or is_restricted:
        return float("inf")

    # Shortest navigable: purely distance-based (still avoids land and restricted)
    if optimization_preference == "shortest":
        return distance_km

    # Vessel sensitivity multipliers
    sens = VESSEL_SENSITIVITY.get(vessel_type, VESSEL_SENSITIVITY["small_fishing_boat"])
    wave_sens = sens.get("wave", 1.0)
    wind_sens = sens.get("wind", 1.0)

    # Wave penalty: exponential increase above safe thresholds
    # E.g. for small boat, 1.5m waves is caution, 2.0m is dangerous
    wave_penalty = 1.0 + (max(0.0, wave_height_m) * wave_sens * 1.5) ** 1.8

    # Wind penalty
    wind_penalty = 1.0 + (max(0.0, wind_speed_kts) * wind_sens / 10.0) ** 1.4

    # Hazard area penalty
    hazard_multiplier = 1.0
    hazard_flat_penalty = 0.0
    if is_hazard:
        if optimization_preference == "safety_first":
            hazard_multiplier = 15.0
            hazard_flat_penalty = 50.0  # Massive deterrent to route around hazard
        else:  # balanced
            hazard_multiplier = 3.0
            hazard_flat_penalty = 10.0

    cost = (distance_km * wave_penalty * wind_penalty * hazard_multiplier) + hazard_flat_penalty
    return cost

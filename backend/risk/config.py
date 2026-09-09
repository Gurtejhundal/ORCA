"""Centralized safety threshold and risk engine configuration with provenance metadata."""

RISK_CONFIG = {
    "version": "prototype-risk-engine-1.0",
    "notes": "Clearly distinguishes official advisory thresholds from prototype operational heuristics.",

    # Risk factor weights (Sum = 1.0)
    "weights": {
        "wave": 0.30,
        "wind": 0.20,
        "weather": 0.15,
        "hazards": 0.20,
        "currents": 0.10,
        "visibility": 0.05,
    },

    # Normalization ceilings for 0-100 scaling
    "normalization": {
        "wave_height_m": 4.0,       # 4m wave = 100% factor risk
        "wind_speed_ms": 20.0,      # 20 m/s (~39 knots) = 100% factor risk
        "current_speed_ms": 2.0,    # 2 m/s (~4 knots) = 100% factor risk
        "visibility_km": 10.0,      # Low visibility (<10km) increases risk
        "alert_severity": 3.0,      # Level 3 = highest alert severity
    },

    # Hard safety gates triggering elevated or extreme overrides
    "thresholds": {
        "wave_height_m": {
            "moderate": 1.5,
            "high": 2.5,
            "extreme": 3.5,
            "rule_type": "prototype_operational_heuristic",
            "source": "IMD/INCOIS sea state operational guidelines (rough sea >= 2.5m)",
            "status": "active"
        },
        "wind_speed_ms": {
            "moderate": 8.0,
            "high": 12.5,
            "extreme": 17.0,
            "rule_type": "prototype_operational_heuristic",
            "source": "Beaufort scale force 6+ (strong breeze/gale >= 11m/s)",
            "status": "active"
        },
        "cyclone_warning": {
            "override_level": "EXTREME",
            "rule_type": "official_advisory_rule",
            "source": "IMD / INCOIS National Cyclone Warning Centre",
            "status": "active"
        },
        "high_wave_alert": {
            "override_level": "HIGH",
            "rule_type": "official_advisory_rule",
            "source": "INCOIS Ocean State Forecast / High Wave Alert",
            "status": "active"
        },
        "restricted_zone": {
            "override_level": "EXTREME",
            "rule_type": "official_advisory_rule",
            "source": "Ministry of Ports, Shipping and Waterways / Maritime Administration",
            "status": "active"
        }
    },

    # Vessel profiles with sensitivity modifiers
    "vessel_profiles": {
        "small_fishing_boat": {
            "id": "small_fishing_boat",
            "name": "Small Motorized Fishing Craft (<10m)",
            "max_recommended_wave_height": 1.8,
            "max_recommended_wind_speed": 11.0,
            "risk_sensitivity": 1.25,
            "rule_type": "prototype_operational_heuristic",
            "description": "Traditional open wooden/FRP vallam/kattumaram or small motorized craft."
        },
        "medium_fishing_vessel": {
            "id": "medium_fishing_vessel",
            "name": "Medium Mechanized Trawler (10-20m)",
            "max_recommended_wave_height": 2.8,
            "max_recommended_wind_speed": 15.0,
            "risk_sensitivity": 1.0,
            "rule_type": "prototype_operational_heuristic",
            "description": "Standard multi-day mechanized trawler or gillnetter."
        },
        "generic_vessel": {
            "id": "generic_vessel",
            "name": "Generic Coastal Vessel",
            "max_recommended_wave_height": 3.2,
            "max_recommended_wind_speed": 18.0,
            "risk_sensitivity": 0.9,
            "rule_type": "prototype_operational_heuristic",
            "description": "Commercial coastal craft or steel-hull support vessel."
        }
    },

    # Safe PFZ ranking weights (Sum = 1.0)
    "pfz_ranking_weights": {
        "safety": 0.40,
        "distance": 0.25,
        "forecast_quality": 0.15,
        "environmental_fit": 0.10,
        "data_confidence": 0.10
    }
}

VESSEL_PROFILES = RISK_CONFIG["vessel_profiles"]
DEFAULT_VESSEL_PROFILES = VESSEL_PROFILES
VESSEL_SENSITIVITY = {
    k: {
        "wave": v.get("risk_sensitivity", 1.0),
        "wind": v.get("risk_sensitivity", 1.0),
    }
    for k, v in VESSEL_PROFILES.items()
}

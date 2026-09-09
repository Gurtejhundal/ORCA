"""Proactive alert generators for geofence approaches and route hazard intersections."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.geofence.models import GeofenceWarning


def create_geofence_alert(
    warning: GeofenceWarning,
    vessel_id: str = "vessel-1",
) -> Dict[str, Any]:
    """Generates a structured proactive geofence alert payload."""
    alert_id = f"alert-gf-{uuid.uuid4().hex[:8]}"
    return {
        "alert_id": alert_id,
        "type": "GEOFENCE_APPROACH",
        "level": warning.level,
        "vessel_id": vessel_id,
        "zone_id": warning.zone_id,
        "zone_name": warning.zone_name,
        "zone_type": warning.zone_type,
        "message": warning.message,
        "recommended_heading_degrees": warning.recommended_heading_degrees,
        "time_to_breach_minutes": warning.time_to_breach_minutes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def create_route_hazard_alert(
    route_id: str,
    hazard_id: str,
    hazard_name: str,
    intersection_distance_km: float,
    vessel_id: str = "vessel-1",
) -> Dict[str, Any]:
    """Generates an alert when a vessel's active route intersects a hazard."""
    alert_id = f"alert-rh-{uuid.uuid4().hex[:8]}"
    return {
        "alert_id": alert_id,
        "type": "ROUTE_HAZARD_INTERSECTION",
        "level": "WARNING",
        "vessel_id": vessel_id,
        "route_id": route_id,
        "hazard_id": hazard_id,
        "hazard_name": hazard_name,
        "intersection_distance_km": round(intersection_distance_km, 2),
        "message": f"Active route {route_id} intersects newly active hazard '{hazard_name}' at ~{round(intersection_distance_km, 1)} km. Rerouting recommended.",
        "route_needs_recalculation": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

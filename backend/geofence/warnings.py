"""Deterministic Geofence Warning Assessment and Safe Course Correction Heading Calculation."""
from __future__ import annotations
import math
from typing import List, Optional, Tuple, Dict, Any
from shapely.geometry import Point, LineString, shape
from backend.geofence.models import GeofenceWarning, BoundaryDistance, ProjectedPosition
from backend.geofence.predictor import project_trajectory


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates initial bearing from point 1 to point 2 in degrees (0-360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return round((bearing + 360.0) % 360.0, 1)


def find_safe_escape_heading(
    current_lat: float,
    current_lon: float,
    current_heading: Optional[float],
    speed_knots: Optional[float],
    zone_centroid: Tuple[float, float], # (lat, lon)
    all_zone_geometries: List[Dict[str, Any]],
    land_shapes: Optional[List[Any]] = None,
) -> float:
    """Computes a deterministic course correction heading to avoid/exit boundary."""
    speed = speed_knots if (speed_knots and speed_knots > 1.0) else 10.0
    shapes = [shape(g) for g in all_zone_geometries]
    lands = land_shapes or []

    # If current heading available, test incremental course deviations
    if current_heading is not None:
        candidate_offsets = [
            30, -30, 45, -45, 60, -60, 75, -75, 90, -90, 120, -120, 150, -150, 180
        ]
        for offset in candidate_offsets:
            cand_heading = (current_heading + offset) % 360.0
            traj = project_trajectory(current_lat, current_lon, cand_heading, speed, [15, 30, 60])
            coords = [(current_lon, current_lat)] + [(p.lon, p.lat) for p in traj]
            line = LineString(coords)

            # Check if candidate line is clear of all zones and land
            collision = False
            for s in shapes:
                if line.intersects(s):
                    collision = True
                    break
            if not collision:
                for lsh in lands:
                    if line.intersects(lsh):
                        collision = True
                        break

            if not collision:
                return round(cand_heading, 1)

    # Fallback: steer directly away from zone centroid
    away_bearing = calculate_bearing(zone_centroid[0], zone_centroid[1], current_lat, current_lon)
    return round(away_bearing, 1)


def evaluate_warnings(
    current_lat: float,
    current_lon: float,
    current_heading: Optional[float],
    speed_knots: Optional[float],
    boundaries: List[BoundaryDistance],
    zone_geometries: Dict[str, Dict[str, Any]],
    land_shapes: Optional[List[Any]] = None,
) -> Tuple[List[GeofenceWarning], Optional[str]]:
    """Evaluates geofence proximity and breaches to produce actionable warnings."""
    warnings: List[GeofenceWarning] = []
    recommended_action = None

    all_geoms = list(zone_geometries.values())

    for b in boundaries:
        geom = zone_geometries.get(b.zone_id)
        c_lat, c_lon = 0.0, 0.0
        if geom:
            sh = shape(geom)
            c_lon, c_lat = sh.centroid.x, sh.centroid.y

        escape_heading = find_safe_escape_heading(
            current_lat, current_lon, current_heading, speed_knots,
            (c_lat, c_lon), all_geoms, land_shapes
        )

        if b.is_inside:
            # Active breach
            level = "CRITICAL" if b.severity == "forbidden" else "WARNING"
            msg = (
                f"BREACH: Vessel is currently INSIDE {b.zone_name} ({b.zone_type.upper()}). "
                f"Immediately steer to safe heading {escape_heading}°!"
            )
            warnings.append(
                GeofenceWarning(
                    level=level,
                    zone_id=b.zone_id,
                    zone_name=b.zone_name,
                    zone_type=b.zone_type,
                    message=msg,
                    recommended_heading_degrees=escape_heading,
                    time_to_breach_minutes=0,
                )
            )
            recommended_action = msg

        elif b.projected_breach_minutes is not None:
            # Projected breach along trajectory
            mins = b.projected_breach_minutes
            if mins <= 15:
                level = "CRITICAL" if b.severity == "forbidden" else "WARNING"
            elif mins <= 30:
                level = "WARNING"
            else:
                level = "CAUTION"

            msg = (
                f"Trajectory warning: Vessel will enter {b.zone_name} in approximately {mins} minutes. "
                f"Recommended course adjustment: alter heading to {escape_heading}°."
            )
            warnings.append(
                GeofenceWarning(
                    level=level,
                    zone_id=b.zone_id,
                    zone_name=b.zone_name,
                    zone_type=b.zone_type,
                    message=msg,
                    recommended_heading_degrees=escape_heading,
                    time_to_breach_minutes=mins,
                )
            )
            if not recommended_action or level == "CRITICAL":
                recommended_action = msg

        elif b.distance_km <= 2.0:
            # Proximity warning
            level = "WARNING" if b.severity == "forbidden" else "CAUTION"
            msg = (
                f"Proximity alert: Vessel is {b.distance_km} km from {b.zone_name} (bearing {b.bearing_degrees}°). "
                f"Maintain safe clearance."
            )
            warnings.append(
                GeofenceWarning(
                    level=level,
                    zone_id=b.zone_id,
                    zone_name=b.zone_name,
                    zone_type=b.zone_type,
                    message=msg,
                    recommended_heading_degrees=escape_heading,
                )
            )
            if not recommended_action and level == "WARNING":
                recommended_action = msg

        elif b.distance_km <= 5.0:
            warnings.append(
                GeofenceWarning(
                    level="CAUTION",
                    zone_id=b.zone_id,
                    zone_name=b.zone_name,
                    zone_type=b.zone_type,
                    message=f"Advisory: Vessel is {b.distance_km} km from {b.zone_name}.",
                    recommended_heading_degrees=escape_heading,
                )
            )

    return warnings, recommended_action

"""Vessel Dead Reckoning Trajectory Projection and Polygon Intersection Detection."""
from __future__ import annotations
import math
from typing import List, Tuple, Optional, Dict, Any
from shapely.geometry import Point, LineString, shape
from backend.geofence.models import ProjectedPosition

EARTH_RADIUS_KM = 6371.0088


def project_position(
    lat: float,
    lon: float,
    heading_deg: float,
    speed_knots: float,
    minutes: float,
) -> ProjectedPosition:
    """Projects a vessel position forward using spherical dead reckoning."""
    dist_km = speed_knots * (minutes / 60.0) * 1.852
    delta = dist_km / EARTH_RADIUS_KM
    theta = math.radians(heading_deg)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)

    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta)
        + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )

    proj_lat = round(math.degrees(phi2), 5)
    proj_lon = round(math.degrees(lambda2), 5)

    return ProjectedPosition(
        minutes=int(minutes),
        lat=proj_lat,
        lon=proj_lon,
        distance_km=round(dist_km, 2),
    )


def project_trajectory(
    lat: float,
    lon: float,
    heading_deg: Optional[float],
    speed_knots: Optional[float],
    lookahead_minutes: List[int] = [15, 30, 60],
) -> List[ProjectedPosition]:
    """Projects vessel positions across multiple lookahead horizons."""
    if heading_deg is None or speed_knots is None or speed_knots <= 0.1:
        return []

    return [
        project_position(lat, lon, heading_deg, speed_knots, m)
        for m in sorted(lookahead_minutes)
    ]


def check_trajectory_breach(
    current_lat: float,
    current_lon: float,
    projected_positions: List[ProjectedPosition],
    zone_geometry: Dict[str, Any],
) -> Optional[int]:
    """Checks if the projected trajectory breaches the zone geometry.
    Returns estimated minutes to breach, or None if no breach predicted.
    """
    zone_shape = shape(zone_geometry)

    # 1. Check if current position is already inside
    if zone_shape.covers(Point(current_lon, current_lat)):
        return 0

    if not projected_positions:
        return None

    # 2. Check each segment of projected trajectory
    coords = [(current_lon, current_lat)] + [
        (p.lon, p.lat) for p in projected_positions
    ]
    trajectory_line = LineString(coords)

    if not trajectory_line.intersects(zone_shape):
        return None

    # Find earliest breaching point
    for p in projected_positions:
        pt = Point(p.lon, p.lat)
        if zone_shape.covers(pt):
            return p.minutes

    # If the LineString intersects between points, approximate time based on fractional distance
    intersection = trajectory_line.intersection(zone_shape)
    if not intersection.is_empty:
        # Distance from start along trajectory to first intersection point
        if hasattr(intersection, "geoms"):
            first_pt = intersection.geoms[0].centroid
        else:
            first_pt = intersection.centroid
        frac = trajectory_line.project(first_pt, normalized=True)
        max_minutes = projected_positions[-1].minutes
        est_min = max(1, int(round(frac * max_minutes)))
        return est_min

    return None

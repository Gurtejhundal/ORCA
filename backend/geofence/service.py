"""Geofence Service providing distance checks, trajectory breach detection, and safety warnings."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from shapely.geometry import Point, shape
from backend.schemas.marine import Location
from backend.geospatial.utils import distance_to_geometry, point_in_polygon
from backend.geofence.models import (
    GeofenceCheckRequest,
    GeofenceStatus,
    BoundaryDistance,
    GeofenceWarning,
    ProjectedPosition,
)
from backend.geofence.predictor import project_trajectory, check_trajectory_breach
from backend.geofence.warnings import evaluate_warnings, calculate_bearing
from backend.services.marine import MarineService
from backend.data_sources import demo


class GeofenceService:
    def __init__(self, marine_service: Optional[MarineService] = None):
        self.marine_service = marine_service

    async def _get_zones(self, location: Location) -> List[Dict[str, Any]]:
        if self.marine_service:
            try:
                return await self.marine_service.zones(location, radius=150.0)
            except Exception:
                if not self.marine_service.settings.demo_mode:
                    from backend.core.exceptions import SourceUnavailable
                    raise SourceUnavailable('Marine geofence', 'Live boundary lookup failed; no demo fallback permitted')

        # Fallback to demo geofences
        try:
            feats = demo.read("geofences.geojson").get("features", [])
            results = []
            for f in feats:
                p = f["properties"]
                results.append({
                    "id": p["id"],
                    "name": p["name"],
                    "type": p.get("category", "zone"),
                    "severity": p.get("severity", "standard"),
                    "geometry": f["geometry"],
                })
            return results
        except Exception:
            return []

    async def check_geofence(self, request: GeofenceCheckRequest) -> GeofenceStatus:
        loc = Location(lat=request.position.lat, lon=request.position.lon)
        zones = await self._get_zones(loc)
        if not zones and self.marine_service and not self.marine_service.settings.demo_mode:
            from backend.core.exceptions import SourceUnavailable
            raise SourceUnavailable('Marine geofence', 'No verified live boundary coverage available for this location; cannot declare SAFE')

        # 1. Project dead reckoning trajectory
        projected = project_trajectory(
            lat=request.position.lat,
            lon=request.position.lon,
            heading_deg=request.heading_degrees,
            speed_knots=request.speed_knots,
            lookahead_minutes=request.lookahead_minutes,
        )

        boundaries: List[BoundaryDistance] = []
        zone_geometries: Dict[str, Dict[str, Any]] = {}

        for z in zones:
            z_id = z["id"]
            z_name = z["name"]
            z_type = z.get("type", "restricted")
            z_sev = z.get("severity", "standard")
            geom = z["geometry"]
            zone_geometries[z_id] = geom

            # Distance in km
            dist_km = distance_to_geometry(loc, geom)
            inside = point_in_polygon(loc, geom)

            # Zone centroid bearing
            sh = shape(geom)
            bearing = calculate_bearing(loc.lat, loc.lon, sh.centroid.y, sh.centroid.x)

            # Trajectory breach minutes
            breach_mins = check_trajectory_breach(
                current_lat=loc.lat,
                current_lon=loc.lon,
                projected_positions=projected,
                zone_geometry=geom,
            )

            boundaries.append(
                BoundaryDistance(
                    zone_id=z_id,
                    zone_name=z_name,
                    zone_type=z_type,
                    severity=z_sev,
                    distance_km=round(dist_km, 2),
                    is_inside=inside,
                    bearing_degrees=bearing,
                    projected_breach_minutes=breach_mins,
                )
            )

        # Sort boundaries by distance
        boundaries.sort(key=lambda b: (0 if b.is_inside else 1, b.distance_km))

        # Evaluate warnings and course recommendations
        warnings, rec_action = evaluate_warnings(
            current_lat=loc.lat,
            current_lon=loc.lon,
            current_heading=request.heading_degrees,
            speed_knots=request.speed_knots,
            boundaries=boundaries,
            zone_geometries=zone_geometries,
        )

        # Overall status
        has_breach = any(b.is_inside and b.severity == "forbidden" for b in boundaries)
        has_critical = any(w.level == "CRITICAL" for w in warnings)
        has_warning = any(w.level == "WARNING" for w in warnings)
        has_caution = any(w.level == "CAUTION" for w in warnings)

        if has_breach:
            status = "BREACH"
        elif has_critical or has_warning:
            status = "WARNING"
        elif has_caution:
            status = "CAUTION"
        else:
            status = "SAFE"

        return GeofenceStatus(
            status=status,
            current_position=request.position,
            current_heading=request.heading_degrees,
            current_speed_knots=request.speed_knots,
            boundaries=boundaries,
            warnings=warnings,
            projected_trajectory=projected,
            recommended_action=rec_action,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

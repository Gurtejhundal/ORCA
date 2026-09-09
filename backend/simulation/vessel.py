"""Deterministic vessel movement and waypoint interpolation along route LineStrings."""
from __future__ import annotations
import math
from typing import List, Tuple
from backend.schemas.marine import Location
from backend.geospatial.utils import haversine
from backend.geofence.warnings import calculate_bearing


class VesselKinematics:
    def __init__(self, coordinates: List[List[float]]):
        """coordinates: List of [lat, lon] waypoints."""
        self.coords = coordinates
        self.cumulative_dist_km: List[float] = [0.0]

        total = 0.0
        for i in range(len(coordinates) - 1):
            p1 = Location(lat=coordinates[i][0], lon=coordinates[i][1])
            p2 = Location(lat=coordinates[i + 1][0], lon=coordinates[i + 1][1])
            d = haversine(p1, p2)
            total += d
            self.cumulative_dist_km.append(total)

        self.total_distance_km = total

    def interpolate_position(self, target_dist_km: float) -> Tuple[float, float, float, bool]:
        """Returns (lat, lon, heading_deg, is_completed) for given traveled distance."""
        if target_dist_km >= self.total_distance_km:
            last = self.coords[-1]
            prev = self.coords[-2] if len(self.coords) > 1 else last
            heading = calculate_bearing(prev[0], prev[1], last[0], last[1])
            return last[0], last[1], heading, True

        if target_dist_km <= 0.0:
            first = self.coords[0]
            nxt = self.coords[1] if len(self.coords) > 1 else first
            heading = calculate_bearing(first[0], first[1], nxt[0], nxt[1])
            return first[0], first[1], heading, False

        # Find enclosing segment
        for i in range(len(self.cumulative_dist_km) - 1):
            d0 = self.cumulative_dist_km[i]
            d1 = self.cumulative_dist_km[i + 1]
            if d0 <= target_dist_km <= d1:
                seg_len = max(0.0001, d1 - d0)
                frac = (target_dist_km - d0) / seg_len
                lat0, lon0 = self.coords[i]
                lat1, lon1 = self.coords[i + 1]

                interp_lat = lat0 + frac * (lat1 - lat0)
                interp_lon = lon0 + frac * (lon1 - lon0)
                heading = calculate_bearing(lat0, lon0, lat1, lon1)

                return round(interp_lat, 5), round(interp_lon, 5), heading, False

        last = self.coords[-1]
        return last[0], last[1], 0.0, True

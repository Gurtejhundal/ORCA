"""High-level Route Service providing A* marine route calculation and analysis."""
from __future__ import annotations
import time
import uuid
from typing import List, Tuple, Optional, Dict, Any
from shapely.geometry import LineString, Point, shape
from backend.schemas.marine import Location
from backend.geospatial.utils import haversine
from backend.risk.service import MarineRiskService
from backend.risk.config import DEFAULT_VESSEL_PROFILES
from backend.risk.models import SafetyAnalysisRequest
from backend.routing.models import RouteRequest, RouteResult, RouteSegment, RouteComparison, LatLon
from backend.routing.grid import NavigationGrid
from backend.routing.astar import astar_search, smooth_path
from backend.data_sources import demo


class MarineRouteService:
    def __init__(self, risk_service: Optional[MarineRiskService] = None):
        self.risk_service = risk_service or MarineRiskService()
        self._sample_cache: Dict[Tuple[float, float], Tuple[float, float]] = {}

    def _sample_conditions(self, lat: float, lon: float) -> Tuple[float, float]:
        """Sample wave height (m) and wind speed (kts) at coordinate."""
        key = (round(lat, 3), round(lon, 3))
        if key in self._sample_cache:
            return self._sample_cache[key]
        try:
            loc = Location(lat=lat, lon=lon)
            obs = demo.observations(loc, demo.REPLAY_TIME)
            wave_m = 1.2
            wind_kts = 12.0
            for o in obs:
                if o.parameter == "significant_wave_height" and o.value is not None:
                    wave_m = float(o.value)
                elif o.parameter == "wind_speed" and o.value is not None:
                    # Convert m/s to knots: 1 m/s = 1.94384 kts
                    wind_kts = float(o.value) * 1.94384
            res = (wave_m, wind_kts)
            self._sample_cache[key] = res
            return res
        except Exception:
            return 1.2, 12.0

    async def calculate_route(self, request: RouteRequest) -> RouteResult:
        """Calculates a deterministic risk-aware marine route."""
        from backend.core.exceptions import SourceUnavailable
        if not self.risk_service.service.settings.demo_mode:
            raise SourceUnavailable('Marine routing', 'Live navigable-water coverage and forecast grid are not configured; demo routing cannot be used for live navigation')
        start_time = time.perf_counter()

        orig = (request.origin.lat, request.origin.lon)
        dest = (request.destination.lat, request.destination.lon)

        coverage = shape(demo.read('region.json')['water'])
        if any(not coverage.covers(Point(lon, lat)) for lat, lon in (orig, dest)):
            raise SourceUnavailable('Marine routing', 'Origin and destination must be inside the recorded demo routing coverage')

        # Build navigation grid
        grid = NavigationGrid(origin=orig, destination=dest)

        # Sample function closures
        def wave_fn(lat, lon):
            w, _ = self._sample_conditions(lat, lon)
            return w

        def wind_fn(lat, lon):
            _, k = self._sample_conditions(lat, lon)
            return k

        # Execute A* search
        raw_path = astar_search(
            grid=grid,
            start_coord=orig,
            goal_coord=dest,
            optimization_preference=request.optimization_preference,
            vessel_type=request.vessel_type,
            wave_sample_fn=wave_fn,
            wind_sample_fn=wind_fn,
            avoid_hazards=request.avoid_hazards,
        )

        if not raw_path:
            raise SourceUnavailable('Marine routing', 'No traversable route found within available navigable-water coverage')

        # Smooth path
        smoothed = smooth_path(grid, raw_path, avoid_hazards=request.avoid_hazards)

        # Build segments and evaluate risks
        segments: List[RouteSegment] = []
        total_dist_km = 0.0
        max_risk = 0.0
        sum_risk = 0.0
        warnings: List[str] = []

        for i in range(len(smoothed) - 1):
            p1 = smoothed[i]
            p2 = smoothed[i + 1]
            seg_dist = haversine(Location(lat=p1[0], lon=p1[1]), Location(lat=p2[0], lon=p2[1]))
            total_dist_km += seg_dist

            mid_lat = (p1[0] + p2[0]) / 2.0
            mid_lon = (p1[1] + p2[1]) / 2.0

            wave_m, wind_kts = self._sample_conditions(mid_lat, mid_lon)

            # Evaluate risk at midpoint
            risk_resp = await self.risk_service.analyze_safety(
                SafetyAnalysisRequest(
                    location={"lat": mid_lat, "lon": mid_lon},
                    vessel_profile=request.vessel_type,
                )
            )

            r_score = float(risk_resp.risk.score)
            r_level = risk_resp.risk.level
            max_risk = max(max_risk, r_score)
            sum_risk += r_score * seg_dist

            segments.append(
                RouteSegment(
                    start=[p1[0], p1[1]],
                    end=[p2[0], p2[1]],
                    distance_km=round(seg_dist, 2),
                    wave_height_m=round(wave_m, 2),
                    wind_speed_kts=round(wind_kts, 1),
                    risk_score=round(r_score, 1),
                    risk_level=r_level,
                )
            )

            if r_level in ("HIGH", "EXTREME") and f"Segment {i+1} has {r_level} marine risk" not in warnings:
                warnings.append(f"Segment {i+1} has {r_level} marine risk ({r_score}/100)")

        # Vessel speed
        prof = DEFAULT_VESSEL_PROFILES.get(request.vessel_type, DEFAULT_VESSEL_PROFILES["small_fishing_boat"])
        speed_kts = request.vessel_speed_knots or prof.get("speed_knots", 10.0)
        speed_kmh = speed_kts * 1.852
        duration_hours = total_dist_km / max(1.0, speed_kmh)

        avg_risk = (sum_risk / total_dist_km) if total_dist_km > 0 else max_risk
        safety_score = max(0.0, min(100.0, 100.0 - avg_risk))

        if max_risk >= 75.0:
            overall_level = "EXTREME"
        elif max_risk >= 50.0:
            overall_level = "HIGH"
        elif avg_risk >= 25.0:
            overall_level = "MODERATE"
        else:
            overall_level = "LOW"

        # GeoJSON LineString coordinates: [lon, lat]
        geojson_coords = [[p[1], p[0]] for p in smoothed]
        route_id = f"route-{uuid.uuid4().hex[:8]}"

        # Identify avoided hazards
        avoided_hazards: List[str] = []
        direct_line = LineString([(orig[1], orig[0]), (dest[1], dest[0])])
        for h_name, hsh in grid.hazard_shapes:
            if direct_line.intersects(hsh):
                # Check if our route intersects it
                route_line = LineString(geojson_coords)
                if not route_line.intersects(hsh):
                    avoided_hazards.append(h_name)

        calc_ms = round((time.perf_counter() - start_time) * 1000, 2)

        geojson_feature = {
            "type": "Feature",
            "id": route_id,
            "geometry": {
                "type": "LineString",
                "coordinates": geojson_coords,
            },
            "properties": {
                "route_id": route_id,
                "origin": [orig[0], orig[1]],
                "destination": [dest[0], dest[1]],
                "total_distance_km": round(total_dist_km, 2),
                "estimated_duration_hours": round(duration_hours, 2),
                "average_speed_kts": round(speed_kts, 1),
                "safety_score": round(safety_score, 1),
                "overall_risk_score": round(avg_risk, 1),
                "overall_risk_level": overall_level,
                "avoided_hazards": avoided_hazards,
                "preference": request.optimization_preference,
            },
        }

        return RouteResult(
            route_id=route_id,
            origin=[orig[0], orig[1]],
            destination=[dest[0], dest[1]],
            total_distance_km=round(total_dist_km, 2),
            estimated_duration_hours=round(duration_hours, 2),
            average_speed_kts=round(speed_kts, 1),
            safety_score=round(safety_score, 1),
            overall_risk_score=round(avg_risk, 1),
            overall_risk_level=overall_level,
            geojson=geojson_feature,
            coordinates=[[p[0], p[1]] for p in smoothed],
            segments=segments,
            warnings=warnings,
            avoided_hazards=avoided_hazards,
            calculation_time_ms=calc_ms,
        )

    async def compare_routes(self, request: RouteRequest) -> RouteComparison:
        """Calculates and compares the shortest direct route vs. the safe recommended route."""
        # 1. Shortest navigable route (ignores hazards, but still avoids land/restricted)
        shortest_req = request.model_copy(
            update={"optimization_preference": "shortest", "avoid_hazards": False}
        )
        shortest_res = await self.calculate_route(shortest_req)

        # 2. Safe route (actively navigates around hazards and high seas)
        safe_req = request.model_copy(
            update={"optimization_preference": "safety_first", "avoid_hazards": True}
        )
        safe_res = await self.calculate_route(safe_req)

        detour_km = max(0.0, round(safe_res.total_distance_km - shortest_res.total_distance_km, 2))
        detour_pct = round((detour_km / max(0.1, shortest_res.total_distance_km)) * 100, 1)
        extra_hours = max(0.0, round(safe_res.estimated_duration_hours - shortest_res.estimated_duration_hours, 2))

        risk_reduction = max(0.0, round(shortest_res.overall_risk_score - safe_res.overall_risk_score, 1))
        risk_pct = round((risk_reduction / max(1.0, shortest_res.overall_risk_score)) * 100, 1)

        # Build trade-off explanation
        haz_str = ", ".join(safe_res.avoided_hazards) if safe_res.avoided_hazards else "active marine hazard zones"
        if detour_km > 0.5:
            explanation = (
                f"Recommended Safe Route takes a {detour_km} km ({detour_pct}%) detour "
                f"(+{int(extra_hours * 60)} mins) around {haz_str}. "
                f"The prototype risk score is {risk_reduction} points ({risk_pct}%) lower for the sampled demo conditions."
            )
        else:
            explanation = (
                "The demo routing model found no material benefit from a detour within its recorded coverage. "
                "Check the route warnings and source freshness before using this result."
            )

        return RouteComparison(
            shortest_route=shortest_res,
            safe_route=safe_res,
            detour_distance_km=detour_km,
            detour_percentage=detour_pct,
            extra_duration_hours=extra_hours,
            risk_reduction_score=risk_reduction,
            risk_reduction_percentage=risk_pct,
            trade_off_explanation=explanation,
        )

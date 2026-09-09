"""2D Navigation Grid for Marine A* Routing with PostGIS/Shapely obstacles."""
from __future__ import annotations
import math
from typing import List, Tuple, Optional, Dict, Any
from shapely.geometry import Point, LineString, Polygon, MultiPolygon, shape
from backend.schemas.marine import Location
from backend.geospatial.utils import haversine
from backend.data_sources import demo


class NavigationGrid:
    def __init__(
        self,
        origin: Tuple[float, float],       # (lat, lon)
        destination: Tuple[float, float],  # (lat, lon)
        resolution_deg: float = 0.007,     # ~780m grid spacing
        padding_deg: float = 0.12,
        geofences: Optional[List[Dict[str, Any]]] = None,
        land_polygons: Optional[List[Any]] = None,
        water_polygon: Optional[Any] = None,
    ):
        self.origin = origin
        self.destination = destination
        self.resolution = resolution_deg

        # Determine bounding box
        min_lat = min(origin[0], destination[0]) - padding_deg
        max_lat = max(origin[0], destination[0]) + padding_deg
        min_lon = min(origin[1], destination[1]) - padding_deg
        max_lon = max(origin[1], destination[1]) + padding_deg

        # Clamp to demo limits if available
        try:
            reg = demo.read("region.json")
            if "water" in reg and not water_polygon:
                self.water_shape = shape(reg["water"])
            else:
                self.water_shape = shape(water_polygon) if water_polygon else None

            if "land" in reg and not land_polygons:
                self.land_shapes = [shape(reg["land"])]
            else:
                self.land_shapes = [shape(p) for p in land_polygons] if land_polygons else []
        except Exception:
            self.water_shape = shape(water_polygon) if water_polygon else None
            self.land_shapes = [shape(p) for p in land_polygons] if land_polygons else []

        # Load geofences
        self.restricted_shapes: List[Tuple[str, Any]] = []
        self.hazard_shapes: List[Tuple[str, Any]] = []

        raw_geofences = geofences
        if raw_geofences is None:
            try:
                gf_data = demo.read("geofences.geojson")
                raw_geofences = gf_data.get("features", [])
            except Exception:
                raw_geofences = []

        for feat in raw_geofences:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            cat = props.get("category", "") or props.get("type", "")
            sev = props.get("severity", "")
            name = props.get("name", props.get("id", "Zone"))
            sh = shape(geom)
            if cat == "restricted" or sev == "forbidden":
                self.restricted_shapes.append((name, sh))
            elif cat == "hazard" or sev in ("elevated", "critical", "warning"):
                self.hazard_shapes.append((name, sh))

        # Adjust grid bounds
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lon = min_lon
        self.max_lon = max_lon

        self.n_lat = int(math.ceil((self.max_lat - self.min_lat) / self.resolution)) + 1
        self.n_lon = int(math.ceil((self.max_lon - self.min_lon) / self.resolution)) + 1

        # Cache cell navigability
        # 0 = navigable ocean, 1 = land, 2 = restricted, 3 = hazard
        self._cell_status: Dict[Tuple[int, int], int] = {}
        self._cell_hazard_name: Dict[Tuple[int, int], str] = {}

    def coord_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        i = int(round((lat - self.min_lat) / self.resolution))
        j = int(round((lon - self.min_lon) / self.resolution))
        i = max(0, min(self.n_lat - 1, i))
        j = max(0, min(self.n_lon - 1, j))
        return i, j

    def grid_to_coord(self, i: int, j: int) -> Tuple[float, float]:
        lat = self.min_lat + i * self.resolution
        lon = self.min_lon + j * self.resolution
        return round(lat, 5), round(lon, 5)

    def is_in_bounds(self, i: int, j: int) -> bool:
        return 0 <= i < self.n_lat and 0 <= j < self.n_lon

    def evaluate_cell(self, i: int, j: int) -> Tuple[int, Optional[str]]:
        """Returns (status_code, hazard_name).
        status: 0=navigable water, 1=land/outside water, 2=restricted, 3=hazard
        """
        if (i, j) in self._cell_status:
            return self._cell_status[(i, j)], self._cell_hazard_name.get((i, j))

        lat, lon = self.grid_to_coord(i, j)
        pt = Point(lon, lat)

        # 1. Land check
        for lsh in self.land_shapes:
            if lsh.covers(pt):
                self._cell_status[(i, j)] = 1
                return 1, None

        # 2. Water boundary check (if water polygon defined)
        if self.water_shape and not self.water_shape.covers(pt):
            self._cell_status[(i, j)] = 1
            return 1, None

        # 3. Restricted zone check
        for r_name, rsh in self.restricted_shapes:
            if rsh.covers(pt):
                self._cell_status[(i, j)] = 2
                return 2, r_name

        # 4. Hazard zone check
        for h_name, hsh in self.hazard_shapes:
            if hsh.covers(pt):
                self._cell_status[(i, j)] = 3
                self._cell_hazard_name[(i, j)] = h_name
                return 3, h_name

        self._cell_status[(i, j)] = 0
        return 0, None

    def get_neighbors(self, i: int, j: int, allow_restricted: bool = False) -> List[Tuple[int, int, float]]:
        """Returns 8-connected neighbors with step distance in km.
        Excludes land and forbidden restricted areas.
        Prevents diagonal corner-cutting through land/obstacles.
        """
        neighbors = []
        # (di, dj, is_diagonal)
        directions = [
            (-1, 0, False), (1, 0, False), (0, -1, False), (0, 1, False),
            (-1, -1, True), (-1, 1, True), (1, -1, True), (1, 1, True)
        ]

        lat0, lon0 = self.grid_to_coord(i, j)
        loc0 = Location(lat=lat0, lon=lon0)

        for di, dj, is_diag in directions:
            ni, nj = i + di, j + dj
            if not self.is_in_bounds(ni, nj):
                continue

            status, _ = self.evaluate_cell(ni, nj)
            if status == 1:  # land
                continue
            if status == 2 and not allow_restricted:  # restricted
                continue

            # Prevent cutting through diagonal obstacles
            if is_diag:
                s1, _ = self.evaluate_cell(i + di, j)
                s2, _ = self.evaluate_cell(i, j + dj)
                if s1 == 1 or s2 == 1:
                    continue
                if not allow_restricted and (s1 == 2 or s2 == 2):
                    continue

            lat1, lon1 = self.grid_to_coord(ni, nj)
            dist_km = haversine(loc0, Location(lat=lat1, lon=lon1))
            neighbors.append((ni, nj, dist_km))

        return neighbors

    def line_of_sight(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        avoid_hazards: bool = False,
    ) -> bool:
        """Deterministic check if a straight line between two (lat, lon) coordinates
        is collision-free from land, restricted areas, and optionally hazard zones.
        Coordinates are (lat, lon), LineString uses (lon, lat).
        """
        line = LineString([(p1[1], p1[0]), (p2[1], p2[0])])

        # Land
        for lsh in self.land_shapes:
            if lsh.intersects(line):
                return False

        # Restricted
        for _, rsh in self.restricted_shapes:
            if rsh.intersects(line):
                return False

        # Water boundary
        if self.water_shape and not self.water_shape.contains(line):
            # Check if line leaves water
            if not self.water_shape.covers(line):
                return False

        # Hazards (if required)
        if avoid_hazards:
            for _, hsh in self.hazard_shapes:
                if hsh.intersects(line):
                    return False

        return True

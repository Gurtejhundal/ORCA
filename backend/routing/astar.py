"""A* Marine Routing Search with Haversine Heuristic and Path Smoothing."""
from __future__ import annotations
import heapq
import time
from typing import List, Tuple, Optional, Dict, Any
from backend.schemas.marine import Location
from backend.geospatial.utils import haversine
from backend.routing.grid import NavigationGrid
from backend.routing.costs import calculate_segment_cost


def heuristic_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Admissible and consistent haversine distance heuristic."""
    return haversine(Location(lat=lat1, lon=lon1), Location(lat=lat2, lon=lon2))


def astar_search(
    grid: NavigationGrid,
    start_coord: Tuple[float, float],
    goal_coord: Tuple[float, float],
    optimization_preference: str = "safety_first",
    vessel_type: str = "small_fishing_boat",
    wave_sample_fn=None,
    wind_sample_fn=None,
) -> Optional[List[Tuple[float, float]]]:
    """Runs 8-connected A* search over the NavigationGrid.
    Returns list of (lat, lon) path waypoints or None if unreachable.
    """
    start_idx = grid.coord_to_grid(start_coord[0], start_coord[1])
    goal_idx = grid.coord_to_grid(goal_coord[0], goal_coord[1])

    # Check start and goal navigability
    start_status, _ = grid.evaluate_cell(start_idx[0], start_idx[1])
    if start_status in (1, 2):  # Land or restricted
        # Find closest navigable cell
        start_idx = _find_closest_navigable(grid, start_idx)
        if not start_idx:
            return None

    goal_status, _ = grid.evaluate_cell(goal_idx[0], goal_idx[1])
    if goal_status in (1, 2):
        goal_idx = _find_closest_navigable(grid, goal_idx)
        if not goal_idx:
            return None

    goal_lat, goal_lon = grid.grid_to_coord(goal_idx[0], goal_idx[1])

    # Priority queue entries: (f_score, counter, current_idx)
    open_set = []
    counter = 0

    g_score: Dict[Tuple[int, int], float] = {start_idx: 0.0}
    lat0, lon0 = grid.grid_to_coord(start_idx[0], start_idx[1])
    h0 = heuristic_km(lat0, lon0, goal_lat, goal_lon)
    heapq.heappush(open_set, (h0, counter, start_idx))

    came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
    closed_set = set()

    max_expansions = 15000
    expansions = 0

    while open_set and expansions < max_expansions:
        expansions += 1
        current_f, _, current = heapq.heappop(open_set)

        if current == goal_idx:
            # Reconstruct raw path
            path = []
            curr = current
            while curr in came_from:
                lat, lon = grid.grid_to_coord(curr[0], curr[1])
                path.append((lat, lon))
                curr = came_from[curr]
            lat, lon = grid.grid_to_coord(start_idx[0], start_idx[1])
            path.append((lat, lon))
            path.reverse()

            # Ensure exact start & goal are included
            raw_path = [start_coord] + path[1:-1] + [goal_coord]
            return raw_path

        if current in closed_set:
            continue
        closed_set.add(current)

        current_g = g_score[current]

        # Get 8-connected navigable neighbors
        neighbors = grid.get_neighbors(current[0], current[1])
        for ni, nj, dist_km in neighbors:
            if (ni, nj) in closed_set:
                continue

            status, _ = grid.evaluate_cell(ni, nj)
            is_hazard = (status == 3)
            is_restricted = (status == 2)
            is_land = (status == 1)

            n_lat, n_lon = grid.grid_to_coord(ni, nj)
            wave_h = wave_sample_fn(n_lat, n_lon) if wave_sample_fn else 1.2
            wind_k = wind_sample_fn(n_lat, n_lon) if wind_sample_fn else 12.0

            step_cost = calculate_segment_cost(
                distance_km=dist_km,
                wave_height_m=wave_h,
                wind_speed_kts=wind_k,
                is_hazard=is_hazard,
                is_restricted=is_restricted,
                is_land=is_land,
                optimization_preference=optimization_preference,
                vessel_type=vessel_type,
            )

            tentative_g = current_g + step_cost

            if tentative_g < g_score.get((ni, nj), float("inf")):
                came_from[(ni, nj)] = current
                g_score[(ni, nj)] = tentative_g
                h = heuristic_km(n_lat, n_lon, goal_lat, goal_lon)
                f = tentative_g + h
                counter += 1
                heapq.heappush(open_set, (f, counter, (ni, nj)))

    return None


def smooth_path(
    grid: NavigationGrid,
    raw_path: List[Tuple[float, float]],
    avoid_hazards: bool = True,
) -> List[Tuple[float, float]]:
    """Applies greedy line-of-sight path smoothing with post-smoothing collision checks.
    Removes redundant zig-zag grid waypoints while strictly respecting obstacles.
    """
    if len(raw_path) <= 2:
        return raw_path

    smoothed = [raw_path[0]]
    current_idx = 0
    n = len(raw_path)

    while current_idx < n - 1:
        # Look ahead as far as possible
        best_next = current_idx + 1
        for test_idx in range(n - 1, current_idx, -1):
            if grid.line_of_sight(raw_path[current_idx], raw_path[test_idx], avoid_hazards=avoid_hazards):
                best_next = test_idx
                break

        smoothed.append(raw_path[best_next])
        current_idx = best_next

    # Final verification: ensure every segment of smoothed path is collision free
    verified = [smoothed[0]]
    for i in range(len(smoothed) - 1):
        p1 = verified[-1]
        p2 = smoothed[i + 1]
        if grid.line_of_sight(p1, p2, avoid_hazards=avoid_hazards):
            verified.append(p2)
        else:
            # Fallback: keep the intermediate un-smoothed points for this interval
            # Find original range
            idx1 = raw_path.index(p1) if p1 in raw_path else 0
            idx2 = raw_path.index(p2) if p2 in raw_path else len(raw_path) - 1
            for mid in raw_path[idx1 + 1 : idx2 + 1]:
                verified.append(mid)

    return verified


def _find_closest_navigable(grid: NavigationGrid, center: Tuple[int, int]) -> Optional[Tuple[int, int]]:
    """Breadth-first search for the nearest navigable water cell."""
    queue = [center]
    visited = {center}

    while queue:
        ci, cj = queue.pop(0)
        status, _ = grid.evaluate_cell(ci, cj)
        if status == 0:
            return ci, cj

        for di, dj in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ni, nj = ci + di, cj + dj
            if grid.is_in_bounds(ni, nj) and (ni, nj) not in visited:
                visited.add((ni, nj))
                queue.append((ni, nj))
    return None

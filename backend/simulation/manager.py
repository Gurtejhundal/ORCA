"""Session-scoped Vessel Simulation Manager with Geofencing and Dynamic Rerouting."""
from __future__ import annotations
import uuid
from typing import Dict, Optional, List, Any
from shapely.geometry import LineString, shape
from backend.routing.models import LatLon, RouteResult, RouteRequest
from backend.routing.route_service import MarineRouteService
from backend.geofence.models import GeofenceCheckRequest
from backend.geofence.service import GeofenceService
from backend.alerts.proactive import create_geofence_alert, create_route_hazard_alert
from backend.simulation.models import SimulationConfig, SimulationState, SimulationStepResult
from backend.simulation.vessel import VesselKinematics
from backend.data_sources import demo


class SimulationManager:
    def __init__(
        self,
        route_service: Optional[MarineRouteService] = None,
        geofence_service: Optional[GeofenceService] = None,
    ):
        self.route_service = route_service or MarineRouteService()
        self.geofence_service = geofence_service or GeofenceService()
        self._states: Dict[str, SimulationState] = {}
        self._kinematics: Dict[str, VesselKinematics] = {}
        self._configs: Dict[str, SimulationConfig] = {}
        self._routes: Dict[str, RouteResult] = {}
        self._route_progress_km: Dict[str, float] = {}

    def create_simulation(
        self,
        config: SimulationConfig,
        route: RouteResult,
    ) -> SimulationState:
        sim_id = f"sim-{uuid.uuid4().hex[:8]}"
        coords = route.coordinates  # List of [lat, lon]
        kinematics = VesselKinematics(coords)

        p_lat, p_lon, p_heading, is_done = kinematics.interpolate_position(0.0)

        state = SimulationState(
            simulation_id=sim_id,
            vessel_id=config.vessel_id,
            route_id=route.route_id,
            current_position=LatLon(lat=p_lat, lon=p_lon),
            current_heading=p_heading,
            speed_knots=config.speed_knots,
            step_count=0,
            elapsed_time_minutes=0.0,
            distance_traveled_km=0.0,
            remaining_distance_km=kinematics.total_distance_km,
            progress_percentage=0.0,
            is_completed=is_done,
            active_warnings=[],
            route_needs_recalculation=False,
        )

        self._states[sim_id] = state
        self._kinematics[sim_id] = kinematics
        self._configs[sim_id] = config
        self._routes[sim_id] = route
        self._route_progress_km[sim_id] = 0.0
        return state

    def get_simulation(self, simulation_id: str) -> Optional[SimulationState]:
        return self._states.get(simulation_id)

    def stop_simulation(self, simulation_id: str) -> bool:
        if simulation_id in self._states:
            del self._states[simulation_id]
            del self._kinematics[simulation_id]
            del self._configs[simulation_id]
            del self._routes[simulation_id]
            del self._route_progress_km[simulation_id]
            return True
        return False

    async def step_simulation(self, simulation_id: str) -> SimulationStepResult:
        state = self._states.get(simulation_id)
        if not state:
            raise ValueError(f"Simulation session {simulation_id} not found.")

        if state.is_completed:
            return SimulationStepResult(state=state, map_actions=[], alerts=[])

        config = self._configs[simulation_id]
        kinematics = self._kinematics[simulation_id]
        route = self._routes[simulation_id]

        # Calculate forward movement
        step_mins = config.step_interval_minutes
        step_km = config.speed_knots * (step_mins / 60.0) * 1.852
        route_traveled = self._route_progress_km[simulation_id]
        new_route_traveled = min(kinematics.total_distance_km, route_traveled + step_km)
        traveled_this_step = new_route_traveled - route_traveled
        voyage_traveled = state.distance_traveled_km + traveled_this_step

        new_lat, new_lon, new_heading, is_done = kinematics.interpolate_position(new_route_traveled)
        new_remaining = max(0.0, kinematics.total_distance_km - new_route_traveled)
        pct = round((voyage_traveled / max(0.001, voyage_traveled + new_remaining)) * 100.0, 1)

        # Geofence check
        gf_req = GeofenceCheckRequest(
            position=LatLon(lat=new_lat, lon=new_lon),
            heading_degrees=new_heading,
            speed_knots=config.speed_knots,
            vessel_id=config.vessel_id,
        )
        gf_status = await self.geofence_service.check_geofence(gf_req)

        # Collect warnings & alerts
        active_warnings = [w.message for w in gf_status.warnings]
        alerts: List[Dict[str, Any]] = []
        map_actions: List[Dict[str, Any]] = []

        for w in gf_status.warnings:
            if w.level in ("WARNING", "CRITICAL"):
                alerts.append(create_geofence_alert(w, vessel_id=config.vessel_id))

        # Dynamic rerouting detection:
        # Check if simulated hazard emerges or if remaining route intersects a hazard
        needs_reroute = False
        recalculated_route: Optional[RouteResult] = None

        if not is_done and config.simulate_hazard_emergence and state.step_count == 2 and not state.route_needs_recalculation:
            needs_reroute = True
        elif not is_done:
            # Check remaining path against hazard polygons
            remaining = [[new_lat, new_lon]] + [
                point for point, distance in zip(kinematics.coords, kinematics.cumulative_dist_km)
                if distance > new_route_traveled
            ]
            rem_coords = [[lon, lat] for lat, lon in remaining]
            if len(rem_coords) >= 2:
                rem_line = LineString(rem_coords)
                try:
                    hazards = demo.read("geofences.geojson").get("features", [])
                    for hf in hazards:
                        if hf.get("properties", {}).get("category") == "hazard":
                            hsh = shape(hf["geometry"])
                            if rem_line.intersects(hsh):
                                needs_reroute = True
                                break
                except Exception:
                    pass

        if needs_reroute and not state.route_needs_recalculation:
            dest_lat, dest_lon = route.destination[0], route.destination[1]
            reroute_req = RouteRequest(
                origin=LatLon(lat=new_lat, lon=new_lon),
                destination=LatLon(lat=dest_lat, lon=dest_lon),
                vessel_type=config.vessel_type,
                optimization_preference="safety_first",
                avoid_hazards=True,
            )
            recalculated_route = await self.route_service.calculate_route(reroute_req)

            # Generate proactive alert
            alert = create_route_hazard_alert(
                route_id=route.route_id,
                hazard_id="hazard-dynamic-1",
                hazard_name="Evolving High Wave Area",
                intersection_distance_km=round(voyage_traveled + 3.0, 1),
                vessel_id=config.vessel_id,
            )
            alerts.append(alert)

            # Issue map action to redraw rerouted safe path
            map_actions.append({
                "action": "DRAW_ROUTE",
                "id": recalculated_route.route_id,
                "geojson": recalculated_route.geojson,
                "title": f"Safe Reroute to Destination ({round(recalculated_route.total_distance_km, 1)} km)",
            })

            # Update kinematics to follow new route
            reroute_kinematics = VesselKinematics(recalculated_route.coordinates)
            self._kinematics[simulation_id] = reroute_kinematics
            self._routes[simulation_id] = recalculated_route
            self._route_progress_km[simulation_id] = 0.0
            new_remaining = reroute_kinematics.total_distance_km
            pct = round((voyage_traveled / max(0.001, voyage_traveled + new_remaining)) * 100.0, 1)
        else:
            self._route_progress_km[simulation_id] = new_route_traveled

        # UPDATE_VESSEL MapLibre action
        map_actions.append({
            "action": "UPDATE_VESSEL",
            "id": config.vessel_id,
            "position": {"lat": new_lat, "lon": new_lon},
            "heading": new_heading,
            "speed": config.speed_knots,
            "title": f"Vessel {config.vessel_id} ({pct}%)",
        })

        # Update state
        state.current_position = LatLon(lat=new_lat, lon=new_lon)
        state.current_heading = new_heading
        state.step_count += 1
        state.elapsed_time_minutes += step_mins
        state.distance_traveled_km = round(voyage_traveled, 2)
        state.remaining_distance_km = round(new_remaining, 2)
        state.progress_percentage = pct
        state.is_completed = is_done
        state.geofence_status = gf_status
        state.active_warnings = active_warnings
        if needs_reroute:
            state.route_id = recalculated_route.route_id
            state.route_needs_recalculation = True
            state.recalculated_route = recalculated_route

        return SimulationStepResult(
            state=state,
            map_actions=map_actions,
            alerts=alerts,
        )

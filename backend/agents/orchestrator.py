import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any
from backend.agents.evidence_agent import EvidenceAggregator
from backend.agents.explanation_agent import ExplanationAgent
from backend.agents.intent_agent import IntentAgent
from backend.agents.planner_agent import PlannerAgent
from backend.agents.registry import AgentRegistry
from backend.agents.schemas import (
    AgentInput,
    AgentOutput,
    AgentTask,
    ChatResponsePayload,
    ExecutionPlan,
    LocationRef,
    MapAction,
)
from backend.conversation.language import detect_language
from backend.conversation.location_resolution import resolve_location
from backend.conversation.memory import ConversationMemory
from backend.conversation.time_resolution import resolve_time_expression
from backend.core.config import Settings
from backend.database.repository import Repository
from backend.llm.base import LLMProvider
from backend.services.marine import MarineService

logger = logging.getLogger(__name__)


class MarineOrchestrator:
    """Central multi-agent orchestration engine for SamudraAI."""

    def __init__(
        self,
        settings: Settings,
        marine_service: MarineService,
        repository: Repository,
        llm: LLMProvider,
        risk_service: Any = None,
        route_service: Any = None,
        geofence_service: Any = None,
    ):
        self.settings = settings
        self.service = marine_service
        self.repo = repository
        self.llm = llm
        self.registry = AgentRegistry(marine_service)
        self.memory = ConversationMemory(repository)
        self.intent_agent = IntentAgent(llm)
        self.planner_agent = PlannerAgent(llm)
        self.evidence_aggregator = EvidenceAggregator()
        self.explanation_agent = ExplanationAgent(llm)

        from backend.risk.service import MarineRiskService
        from backend.routing.route_service import MarineRouteService
        from backend.geofence.service import GeofenceService
        self.risk_service = risk_service or MarineRiskService(marine_service)
        self.route_service = route_service or MarineRouteService(self.risk_service)
        self.geofence_service = geofence_service or GeofenceService(marine_service)

    async def execute_task_graph(
        self,
        plan: ExecutionPlan,
        session_id: str,
        query: str,
        intent: str,
        location: LocationRef | None,
        requested_time: datetime,
        context_data: dict[str, Any],
    ) -> tuple[dict[str, AgentOutput], list[dict[str, Any]]]:
        """Execute task graph with asyncio, respecting dependencies and parallelizing independent tasks."""
        completed: dict[str, AgentOutput] = {}
        tool_traces = []

        # Graph execution loop
        remaining_tasks = list(plan.tasks)
        max_loops = len(remaining_tasks) + 2

        loop_count = 0
        while remaining_tasks and loop_count < max_loops:
            loop_count += 1
            # Ready tasks have all depends_on completed
            ready_tasks = [
                t for t in remaining_tasks
                if all(dep in completed for dep in t.depends_on)
            ]

            if not ready_tasks:
                logger.warning("no_ready_tasks_remaining uncompleted=%s", [t.id for t in remaining_tasks])
                break

            # Run ready tasks concurrently
            async def _run_single(task: AgentTask) -> tuple[AgentTask, AgentOutput]:
                agent = self.registry.get(task.agent)
                start_time = datetime.utcnow()
                if not agent:
                    out = AgentOutput(agent=task.agent, status='failed', errors=[f"Agent '{task.agent}' not in registry"])
                else:
                    # Merge candidates from previous tasks into context
                    shared_context = dict(context_data)
                    for comp_out in completed.values():
                        if 'candidates' in comp_out.data:
                            shared_context['candidates'] = comp_out.data['candidates']

                    inp = AgentInput(
                        session_id=session_id,
                        query=query,
                        intent=intent,
                        location=location,
                        requested_time=requested_time.isoformat(),
                        context=shared_context,
                        task=task,
                    )
                    out = await agent.run(inp)

                duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                tool_traces.append({
                    'task_id': task.id,
                    'agent': task.agent,
                    'action': task.action,
                    'status': out.status,
                    'duration_ms': round(duration_ms, 1),
                })
                return task, out

            task_results = await asyncio.gather(*[_run_single(t) for t in ready_tasks])
            for task, out in task_results:
                completed[task.id] = out
                remaining_tasks.remove(task)

        return completed, tool_traces

    def calculate_confidence(
        self,
        intent_conf: float,
        loc_ref: LocationRef | None,
        completeness: float,
        is_stale: bool,
        has_conflicts: bool,
        task_outputs: dict[str, AgentOutput],
    ) -> float:
        """Deterministic confidence score calculation."""
        # 1. Location factor
        loc_factor = 0.95 if loc_ref else 0.60

        # 2. Agent success factor
        total_tasks = max(1, len(task_outputs))
        success_tasks = sum(1 for o in task_outputs.values() if o.status == 'success')
        success_ratio = success_tasks / total_tasks

        # 3. Penalties
        stale_penalty = 0.10 if is_stale else 0.0
        conflict_penalty = 0.15 if has_conflicts else 0.0

        raw_score = (
            (0.25 * intent_conf) +
            (0.20 * loc_factor) +
            (0.30 * completeness) +
            (0.25 * success_ratio)
        ) - stale_penalty - conflict_penalty

        return max(0.1, min(0.99, round(raw_score, 2)))

    def generate_map_actions(
        self,
        location: LocationRef | None,
        task_outputs: dict[str, AgentOutput],
    ) -> list[MapAction]:
        """Generate generic Google Maps actions."""
        actions: list[MapAction] = []

        # 1. Focus user location
        if location:
            actions.append(
                MapAction(
                    action='FOCUS_LOCATION',
                    lat=location.lat,
                    lon=location.lon,
                    zoom=9,
                )
            )

        # 2. Extract PFZ candidates
        pfz_output = next((o for o in task_outputs.values() if o.agent == 'pfz_agent'), None)
        if pfz_output and pfz_output.data.get('candidates'):
            candidates = pfz_output.data['candidates']
            markers = []
            features = []

            for c in candidates:
                geom = c.get('geometry')
                coords = None
                if geom and geom.get('type') == 'Point':
                    coords = geom['coordinates']
                elif geom and geom.get('type') in ('LineString', 'MultiPoint') and geom.get('coordinates'):
                    coords = geom['coordinates'][0]
                elif geom and geom.get('type') == 'MultiLineString' and geom.get('coordinates') and geom['coordinates'][0]:
                    coords = geom['coordinates'][0][0]

                if coords:
                    markers.append({
                        'id': c.get('id'),
                        'title': f"PFZ: {c.get('name')} ({c.get('distance_km', 'N/A')} km)",
                        'position': {'lat': coords[1], 'lng': coords[0]},
                        'label': 'PFZ',
                    })

                if geom:
                    features.append({
                        'type': 'Feature',
                        'id': c.get('id'),
                        'geometry': geom,
                        'properties': {
                            'name': c.get('name'),
                            'distance_km': c.get('distance_km'),
                            'source': c.get('source'),
                        },
                    })

            if markers:
                actions.append(
                    MapAction(
                        action='SHOW_MARKERS',
                        id='pfz_markers',
                        markers=markers,
                    )
                )

            if features:
                actions.append(
                    MapAction(
                        action='ADD_LAYER',
                        id='pfz_layer',
                        layer='pfz',
                        data={'type': 'FeatureCollection', 'features': features},
                    )
                )

        # 3. Hazard alerts on map
        hazard_output = next((o for o in task_outputs.values() if o.agent == 'hazard_agent'), None)
        if hazard_output and hazard_output.data.get('alerts'):
            for alert in hazard_output.data['alerts']:
                if alert.get('geometry'):
                    actions.append(
                        MapAction(
                            action='SHOW_HAZARD_ZONE',
                            id=f"hazard_{alert.get('id')}",
                            data={'type': 'Feature', 'geometry': alert['geometry'], 'properties': alert},
                        )
                    )

        return actions

    async def chat(
        self,
        query: str,
        session_id: str | None = None,
        explicit_location: dict | None = None,
        language_hint: str | None = None,
        developer_mode: bool = False,
    ) -> ChatResponsePayload:
        sid = session_id or str(uuid.uuid4())
        run_id = uuid.uuid4()

        # 1. Load conversation context
        context = await self.memory.get_context(sid)

        # 2. Language Detection
        detected_lang = detect_language(query, language_hint)
        context.language = detected_lang

        # 3. Intent Recognition
        intent_out = await self.intent_agent.detect_intent(
            query=query,
            context_dict=context.model_dump(),
            language_hint=detected_lang,
        )

        # 4. Location Resolution
        named_loc = intent_out.location.get('name') if intent_out.location else None
        resolved_loc = resolve_location(
            query=query,
            explicit_location=explicit_location,
            context=context,
            named_hint=named_loc,
        )
        if resolved_loc:
            if context.current_location and (context.current_location.lat, context.current_location.lon) != (resolved_loc.lat, resolved_loc.lon):
                context.selected_pfz = None
                context.pfz_candidates = []
            context.current_location = resolved_loc
        loc_ref = LocationRef(lat=resolved_loc.lat, lon=resolved_loc.lon, name=resolved_loc.name) if resolved_loc else None

        # 5. Time Resolution
        resolved_dt = resolve_time_expression(
            expr=intent_out.time_expression,
            demo_mode=self.settings.demo_mode,
        )
        context.requested_time = resolved_dt.isoformat()

        # 6. Check for ordinal candidate reference (e.g. "second one")
        referenced_pfz = self.memory.resolve_candidate_reference(query, context)
        if referenced_pfz:
            context.selected_pfz = referenced_pfz

        # 7. Generate Plan
        plan = await self.planner_agent.create_plan(
            intent_output=intent_out,
            query=query,
            has_location=loc_ref is not None,
        )

        # 8. Execute Agent Graph
        task_outputs, tool_traces = await self.execute_task_graph(
            plan=plan,
            session_id=sid,
            query=query,
            intent=intent_out.intent,
            location=loc_ref,
            requested_time=resolved_dt,
            context_data=context.model_dump(),
        )

        # 9. Aggregate Evidence
        raw_evidence = []
        all_warnings = []
        for o in task_outputs.values():
            raw_evidence.extend(o.evidence)
            all_warnings.extend(o.warnings)

        agg_evidence = self.evidence_aggregator.aggregate(
            raw_evidence=raw_evidence,
            expected_categories=intent_out.required_capabilities,
        )

        # Update candidate memory if PFZ agent ran
        pfz_out = next((o for o in task_outputs.values() if o.agent == 'pfz_agent'), None)
        if pfz_out and pfz_out.data.get('candidates'):
            from backend.conversation.context import CandidatePFZ
            context.pfz_candidates = [
                CandidatePFZ.model_validate(c)
                for c in pfz_out.data['candidates']
            ]
            if context.pfz_candidates:
                context.selected_pfz = context.pfz_candidates[0]

        # 10. Confidence Engine
        confidence = self.calculate_confidence(
            intent_conf=intent_out.confidence,
            loc_ref=loc_ref,
            completeness=agg_evidence['completeness'],
            is_stale=agg_evidence['is_any_stale'],
            has_conflicts=len(agg_evidence['conflicts']) > 0,
            task_outputs=task_outputs,
        )

        # 11. Generate Explanation
        explanation = await self.explanation_agent.explain(
            query=query,
            intent=intent_out.intent,
            evidence=agg_evidence['all_evidence'],
            warnings=list(set(all_warnings)),
            language=detected_lang,
            location_name=loc_ref.name if loc_ref else None,
            recommended_pfz=context.selected_pfz.model_dump() if context.selected_pfz else None,
        )

        # 12. Provider-neutral map actions consumed by the MapLibre frontend
        map_actions = self.generate_map_actions(loc_ref, task_outputs)

        # 13. Part 3 Deterministic Enhancements (Risk, Safe PFZ, Route, Geofence)
        risk_payload = None
        route_payload = None
        route_comp_payload = None
        geofence_payload = None
        ranked_payload = None
        ranked_candidates_payload = []

        try:
            # Deterministic Risk Assessment
            if intent_out.intent in ('marine_safety', 'hazard_check', 'nearest_safe_pfz') and loc_ref:
                risk_res = await self.risk_service.analyze_safety(
                    location={'lat': loc_ref.lat, 'lon': loc_ref.lon},
                    requested_time=resolved_dt,
                )
                risk_payload = risk_res.model_dump()

            # Deterministic Safe PFZ Ranking
            if intent_out.intent in ('nearest_safe_pfz', 'nearest_pfz') and loc_ref:
                ranked_res = await self.risk_service.rank_safe_pfz(
                    origin={'lat': loc_ref.lat, 'lon': loc_ref.lon},
                    requested_time=resolved_dt,
                )
                ranked_candidates_payload = [candidate.model_dump() for candidate in ranked_res.ranked_candidates]
                context.selected_pfz = None
                if ranked_res.ranked_candidates:
                    top_cand = ranked_res.ranked_candidates[0]
                    ranked_payload = top_cand.model_dump()
                    from backend.conversation.context import CandidatePFZ
                    centroid = [loc_ref.lat, loc_ref.lon]
                    if top_cand.geometry:
                        try:
                            from shapely.geometry import shape
                            sh = shape(top_cand.geometry)
                            centroid = [round(sh.centroid.y, 4), round(sh.centroid.x, 4)]
                        except Exception:
                            pass
                    context.selected_pfz = CandidatePFZ(
                        id=top_cand.pfz_id,
                        name=top_cand.name,
                        distance_km=top_cand.distance_km,
                        geometry=top_cand.geometry,
                        source=top_cand.source,
                    )
                else:
                    explanation.warnings.append('No PFZ passed the safety gates; no safe destination is recommended.')

            # Deterministic Routing & Route Comparison
            if intent_out.intent in ('route_request', 'nearest_safe_pfz'):
                if not loc_ref or not context.selected_pfz or not context.selected_pfz.geometry:
                    from backend.core.exceptions import SourceUnavailable
                    raise SourceUnavailable('Route destination', 'Select an available PFZ destination first; no default destination will be invented')
                from backend.routing.models import RouteRequest, LatLon
                orig_lat = loc_ref.lat if loc_ref else 10.767
                orig_lon = loc_ref.lon if loc_ref else 79.872
                dest_lat = 10.87
                dest_lon = 80.1
                if context.selected_pfz and context.selected_pfz.geometry:
                    try:
                        from shapely.geometry import shape
                        sh = shape(context.selected_pfz.geometry)
                        dest_lat, dest_lon = round(sh.centroid.y, 4), round(sh.centroid.x, 4)
                    except Exception:
                        pass
                r_req = RouteRequest(
                    origin=LatLon(lat=orig_lat, lon=orig_lon),
                    destination=LatLon(lat=dest_lat, lon=dest_lon),
                    optimization_preference='safety_first',
                )
                comp = await self.route_service.compare_routes(r_req)
                route_payload = comp.safe_route.model_dump()
                route_comp_payload = comp.model_dump()
                map_actions.append(
                    MapAction(
                        action='DRAW_ROUTE',
                        id=comp.safe_route.route_id,
                        geojson=comp.safe_route.geojson,
                        title=f"Recommended Safe Route ({comp.safe_route.total_distance_km} km)",
                    )
                )

            # Deterministic Geofencing Check
            if intent_out.intent in ('geofence_question', 'marine_safety') and loc_ref:
                from backend.geofence.models import GeofenceCheckRequest
                from backend.routing.models import LatLon
                gf_req = GeofenceCheckRequest(
                    position=LatLon(lat=loc_ref.lat, lon=loc_ref.lon),
                )
                gf_res = await self.geofence_service.check_geofence(gf_req)
                geofence_payload = gf_res.model_dump()
                if gf_res.warnings:
                    top_w = gf_res.warnings[0]
                    map_actions.append(
                        MapAction(
                            action='SHOW_GEOFENCE_WARNING',
                            id=top_w.zone_id,
                            title=top_w.message,
                        )
                    )
        except Exception as e:
            logger.warning("part3_orchestration_enhancement_error: %s", e)
            explanation.warnings.append('Requested deterministic analysis is unavailable: ' + str(e))

        # 14. Persist State & Agent Run
        context.last_intent = intent_out.intent
        await self.memory.save_context(context)

        # Save trace in agent_runs
        final_data = {
            'ranked_pfz': ranked_payload,
            'ranked_pfz_candidates': ranked_candidates_payload,
            'tasks': [t.model_dump() for t in plan.tasks],
            'outputs': {k: v.model_dump() for k, v in task_outputs.items()},
            'evidence_summary': {
                'completeness': agg_evidence['completeness'],
                'conflicts': agg_evidence['conflicts'],
            },
        }
        await self.repo.save_agent_run(
            session_id=sid,
            query=query,
            intent=intent_out.intent,
            plan=plan.model_dump(),
            tool_calls=tool_traces,
            evidence=[e.model_dump() for e in agg_evidence['all_evidence']],
            final_result=final_data,
            run_id=run_id,
        )

        status = 'success' if all(o.status == 'success' for o in task_outputs.values()) and not explanation.warnings else 'partial'

        return ChatResponsePayload(
            session_id=sid,
            answer=explanation.answer,
            language=detected_lang,
            intent=intent_out.intent,
            location=loc_ref.model_dump() if loc_ref else None,
            data=final_data,
            recommended_pfz=context.selected_pfz.model_dump() if context.selected_pfz else None,
            risk=risk_payload,
            route=route_payload,
            route_comparison=route_comp_payload,
            geofence=geofence_payload,
            warnings=explanation.warnings,
            evidence=agg_evidence['all_evidence'],
            sources=explanation.sources,
            confidence=confidence,
            map_actions=map_actions,
            status=status,
            run_id=str(run_id),
        )

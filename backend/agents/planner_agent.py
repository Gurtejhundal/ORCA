import logging
from backend.agents.schemas import ExecutionPlan, AgentTask, IntentOutput
from backend.llm.base import LLMProvider
from backend.llm.prompts import PLANNER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

ALLOWED_ACTIONS_MAP = {
    'pfz_agent': ['find_candidates', 'get_zone_details'],
    'weather_agent': ['conditions_for_location', 'conditions_for_candidates'],
    'ocean_agent': ['conditions_for_location', 'conditions_for_candidates'],
    'hazard_agent': ['check_hazards', 'check_candidate_hazards'],
    'geospatial_agent': ['check_candidate_zones', 'get_intersections', 'prepare_geojson'],
    'satellite_agent': ['get_sst', 'get_chlorophyll', 'find_high_chlorophyll_regions', 'correlate_sst_chlorophyll', 'compare_regions', 'analyze_temporal_change'],
}


class PlannerAgent:
    """Agent that dynamically plans an executable DAG of marine agent tasks."""

    def __init__(self, llm: LLMProvider):
        self.llm = llm

    def validate_plan(self, plan: ExecutionPlan) -> bool:
        """Enforce strict validation of tasks, allowed actions, and DAG properties."""
        task_ids = set()
        for task in plan.tasks:
            if task.agent not in ALLOWED_ACTIONS_MAP:
                logger.error("invalid_agent_in_plan agent=%s", task.agent)
                return False
            if task.action not in ALLOWED_ACTIONS_MAP[task.agent]:
                logger.error("invalid_action_in_plan agent=%s action=%s", task.agent, task.action)
                return False
            task_ids.add(task.id)

        # Validate dependency references
        for task in plan.tasks:
            for dep in task.depends_on:
                if dep not in task_ids:
                    logger.error("missing_dependency_task_id dep=%s", dep)
                    return False

        return True

    async def create_plan(
        self,
        intent_output: IntentOutput,
        query: str,
        has_location: bool,
    ) -> ExecutionPlan:
        from backend.llm.provider import MockLLMProvider
        if isinstance(self.llm, MockLLMProvider):
            return self._build_default_plan(intent_output)
        prompt = f"""User Intent: {intent_output.intent}
Required Capabilities: {intent_output.required_capabilities}
Entities: {intent_output.entities}
Location Present: {has_location}
Query: "{query}"

Create an optimal execution DAG of tasks to fulfill this goal.
Ensure independent tasks can run in parallel.
Tasks evaluating PFZ candidates must depend on the pfz_agent task.
"""

        try:
            plan = await self.llm.generate_structured(
                prompt=prompt,
                schema=ExecutionPlan,
                system_prompt=PLANNER_SYSTEM_PROMPT,
                temperature=0.0,
            )
            if self.validate_plan(plan):
                return plan
            logger.warning("plan_validation_failed; using safe default DAG")
        except Exception as exc:
            logger.warning("planner_llm_failed: %s; using safe default DAG", exc)

        return self._build_default_plan(intent_output)

    def _build_default_plan(self, intent_output: IntentOutput) -> ExecutionPlan:
        """Deterministic, guaranteed-valid DAG fallback based on capabilities."""
        tasks = []
        caps = intent_output.required_capabilities or ['weather', 'ocean']

        if 'pfz' in caps:
            tasks.append(
                AgentTask(
                    id='task_pfz',
                    agent='pfz_agent',
                    action='find_candidates',
                    depends_on=[],
                    params={'limit': 3},
                )
            )
            deps = ['task_pfz']
            if 'weather' in caps:
                tasks.append(
                    AgentTask(
                        id='task_wx',
                        agent='weather_agent',
                        action='conditions_for_candidates',
                        depends_on=deps,
                    )
                )
            if 'ocean' in caps:
                tasks.append(
                    AgentTask(
                        id='task_oc',
                        agent='ocean_agent',
                        action='conditions_for_candidates',
                        depends_on=deps,
                    )
                )
            if 'hazards' in caps:
                tasks.append(
                    AgentTask(
                        id='task_hz',
                        agent='hazard_agent',
                        action='check_candidate_hazards',
                        depends_on=deps,
                    )
                )
            if 'geospatial' in caps:
                tasks.append(
                    AgentTask(
                        id='task_geo',
                        agent='geospatial_agent',
                        action='check_candidate_zones',
                        depends_on=deps,
                    )
                )
        else:
            if 'weather' in caps:
                tasks.append(
                    AgentTask(
                        id='task_wx',
                        agent='weather_agent',
                        action='conditions_for_location',
                        depends_on=[],
                    )
                )
            if 'ocean' in caps:
                tasks.append(
                    AgentTask(
                        id='task_oc',
                        agent='ocean_agent',
                        action='conditions_for_location',
                        depends_on=[],
                    )
                )
            if 'hazards' in caps:
                tasks.append(
                    AgentTask(
                        id='task_hz',
                        agent='hazard_agent',
                        action='check_hazards',
                        depends_on=[],
                    )
                )
            if 'satellite' in caps:
                tasks.append(
                    AgentTask(
                        id='task_sat',
                        agent='satellite_agent',
                        action='get_sst',
                        depends_on=[],
                    )
                )

        return ExecutionPlan(
            goal=f"Analyze marine conditions for intent '{intent_output.intent}'",
            tasks=tasks,
        )

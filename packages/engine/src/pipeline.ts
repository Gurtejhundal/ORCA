import { randomUUID } from 'node:crypto';
import type { Feature, FeatureCollection } from 'geojson';
import type {
  AgentTrace,
  CandidateFishingZone,
  ChatRequest,
  ChatResponse,
  DecisionResponse,
  Evidence,
  FishingZoneProvider,
  MarineProvider,
  ProviderResult,
  RankedZone,
  RouteCandidate,
  TripPlan,
} from '@orca/contracts';
import { asPoint, haversineDistance, pointInPolygon } from '@orca/geo';
import { CONFIG } from './config';
import { evidenceAt, snapshotFromEvidence } from './evidence';
import { explainDecision } from './explanation';
import { FIXTURES } from './fixtures';
import { parseIntent } from './planner';
import {
  FixtureFishingZoneProvider,
  FixtureMarineProvider,
  FixtureWeatherProvider,
  getGeofences,
} from './providers';
import { prepareRoutes, scoreRoutes } from './routes';
import {
  calculateConfidence,
  calculateFishingOpportunity,
  calculateSafetyScore,
  compareRoutes,
  rankFishingZones,
} from './scoring';

export type Providers = {
  marine: MarineProvider;
  weather: MarineProvider;
  fishing: FishingZoneProvider;
};
const defaults: Providers = {
  marine: new FixtureMarineProvider(),
  weather: new FixtureWeatherProvider(),
  fishing: new FixtureFishingZoneProvider(),
};

async function isolated<T>(
  get: () => Promise<ProviderResult<T[]>>,
): Promise<ProviderResult<T[]>> {
  try {
    return await get();
  } catch {
    return {
      status: 'unavailable',
      data: [],
      source: 'Provider',
      fetchedAt: CONFIG.replayClock,
      error: 'Provider failed to return evidence.',
    };
  }
}
async function execute<T>(
  trace: AgentTrace[],
  id: string,
  name: string,
  tool: string,
  run: () => T | Promise<T>,
  describe: (result: T) => { summary: string; failed?: boolean },
): Promise<T> {
  const start = performance.now();
  const result = await run();
  const { summary, failed } = describe(result);
  trace.push({
    id,
    name,
    tool,
    status: failed ? 'FAILED' : 'COMPLETE',
    durationMs: Math.round((performance.now() - start) * 100) / 100,
    summary,
  });
  return result;
}
function scoreZones(
  candidates: CandidateFishingZone[],
  routes: RouteCandidate[],
  evidence: Evidence[],
  plan: TripPlan,
  fences: ReturnType<typeof getGeofences>,
): RankedZone[] {
  return candidates.map((zone) => {
    const best = compareRoutes(routes.filter((r) => r.zoneId === zone.id)).find(
      (r) => !r.rejected,
    );
    const location = asPoint(zone.geometry.coordinates);
    const time = best?.samples.at(-1)?.arrivalTime ?? plan.departureTime;
    const local = evidenceAt(evidence, location, time);
    const snapshot = snapshotFromEvidence(local, location, time);
    const confidence = calculateConfidence(local, time);
    const restricted = fences.some(
      (g) =>
        g.category === 'restricted' && pointInPolygon(location, g.geometry),
    );
    const safety = calculateSafetyScore(snapshot, confidence.score, restricted);
    const opportunity = calculateFishingOpportunity(snapshot, local);
    const rejectionReasons = [...safety.gates];
    if (confidence.score < CONFIG.minimumConfidence)
      rejectionReasons.push('INSUFFICIENT_EVIDENCE');
    if (!best) rejectionReasons.push('NO_FEASIBLE_ROUTE');
    const distanceKm = haversineDistance(plan.origin, location);
    const voyageSafety = Math.min(safety.score, best?.safetyScore ?? 0);
    return {
      ...zone,
      evidenceIds: local.map((e) => e.id),
      distanceKm,
      snapshot,
      confidence,
      safety,
      opportunity,
      rejected: rejectionReasons.length > 0,
      rejectionReasons,
      bestRouteId: best?.id,
      utility:
        opportunity.score -
        CONFIG.utility.safetyPenalty * (100 - voyageSafety) -
        CONFIG.utility.distancePenalty * (best?.distanceKm ?? distanceKm),
    };
  });
}
function buildLayers(
  zones: RankedZone[],
  routes: RouteCandidate[],
  geofences: ReturnType<typeof getGeofences>,
  recommendedZoneId?: string,
  recommendedRouteId?: string,
): FeatureCollection {
  const features: Feature[] = [
    {
      type: 'Feature',
      properties: { kind: 'land', freshness: 'DEMO' },
      geometry: FIXTURES.region.land,
    },
    ...geofences.map(
      (g): Feature => ({
        type: 'Feature',
        properties: {
          id: g.id,
          name: g.name,
          kind: g.category,
          freshness: g.freshness,
        },
        geometry: g.geometry,
      }),
    ),
    ...routes.map(
      (r): Feature => ({
        type: 'Feature',
        properties: {
          id: r.id,
          name: r.name,
          kind: 'route',
          freshness: r.freshness,
          rejected: r.rejected,
          recommended: r.id === recommendedRouteId,
          visible: r.zoneId === recommendedZoneId || !recommendedZoneId,
        },
        geometry: r.geometry,
      }),
    ),
    ...zones.map(
      (z): Feature => ({
        type: 'Feature',
        properties: {
          id: z.id,
          name: z.name,
          kind: 'zone',
          freshness: z.freshness,
          rejected: z.rejected,
          recommended: z.id === recommendedZoneId,
          opportunity: z.opportunity.score,
          safety: z.safety.score,
        },
        geometry: z.geometry,
      }),
    ),
    {
      type: 'Feature',
      properties: {
        kind: 'origin',
        name: FIXTURES.origin.name,
        freshness: 'DEMO',
      },
      geometry: {
        type: 'Point',
        coordinates: [FIXTURES.origin.lon, FIXTURES.origin.lat],
      },
    },
  ];
  return { type: 'FeatureCollection', features };
}
export async function runQuery(
  request: ChatRequest,
  providers: Providers = defaults,
): Promise<ChatResponse> {
  const trace: AgentTrace[] = [];
  const parsed = await execute(
    trace,
    'planner',
    'Planner',
    'parse_intent',
    () => parseIntent(request.message, request.context),
    (p) => ({
      summary:
        p.status === 'READY'
          ? 'Origin, IST departure and 6 execution tasks resolved.'
          : p.message,
    }),
  );
  if (parsed.status !== 'READY')
    return {
      status: parsed.status,
      answer: parsed.message,
      context: parsed.context,
    };
  const plan = parsed.plan;
  const start = plan.departureTime;
  const end = new Date(Date.parse(start) + 8 * 3600000).toISOString();
  const input = { start, end, scenario: request.scenario };
  const [marine, weather] = await Promise.all([
    execute(
      trace,
      'marine',
      'Marine intelligence',
      'marine_snapshot + pfz_candidates',
      async () => {
        const [readings, candidates] = await Promise.all([
          isolated(() => providers.marine.getSnapshot(input)),
          isolated(() =>
            providers.fishing.getCandidates({
              origin: plan.origin,
              radiusKm: 50,
              time: start,
            }),
          ),
        ]);
        return { readings, candidates };
      },
      (v) => ({
        summary:
          v.candidates.data.length +
          ' zones; ' +
          v.readings.data.length +
          ' ocean evidence records.',
        failed:
          v.readings.status === 'unavailable' ||
          v.candidates.status === 'unavailable',
      }),
    ),
    execute(
      trace,
      'weather',
      'Weather intelligence',
      'weather_snapshot',
      () => isolated(() => providers.weather.getSnapshot(input)),
      (v) => ({
        summary: v.data.length + ' wind and alert evidence records.',
        failed: v.status === 'unavailable',
      }),
    ),
  ]);
  const evidence = [...marine.readings.data, ...weather.data];
  const geo = await execute(
    trace,
    'gis',
    'Geospatial analysis',
    'geofence_lookup + route_sampling',
    () => {
      const fences = getGeofences(request.scenario, start, end);
      return {
        fences,
        prepared: prepareRoutes(
          marine.candidates.data.map((z) => z.id),
          fences,
        ),
      };
    },
    (v) => ({
      summary:
        v.prepared.length +
        ' routes checked against ' +
        v.fences.length +
        ' geofences and the water mask.',
    }),
  );
  const scored = await execute(
    trace,
    'decision',
    'Decision engine',
    'calculate_scores + hard_gates',
    () => {
      const routes = scoreRoutes(geo.prepared, evidence, plan);
      return {
        routes,
        zones: scoreZones(
          marine.candidates.data,
          routes,
          evidence,
          plan,
          geo.fences,
        ),
      };
    },
    (v) => ({
      summary:
        v.zones.length +
        ' zones scored; ' +
        v.routes.filter((r) => r.rejected).length +
        ' routes rejected by rules.',
    }),
  );
  const resolved = await execute(
    trace,
    'routes',
    'Route comparison',
    'compare_routes + rank_zones',
    () => {
      const zones = rankFishingZones(scored.zones);
      const selected = zones.find((z) => !z.rejected);
      const route = scored.routes.find((r) => r.id === selected?.bestRouteId);
      return { zones, selected, route };
    },
    (v) => ({
      summary: v.selected
        ? v.selected.name + ' selected by utility and feasible route cost.'
        : 'No candidate satisfies the evidence and safety requirements.',
    }),
  );
  const missing =
    !resolved.zones.length ||
    resolved.zones.every(
      (z) =>
        z.rejectionReasons.some(
          (r) =>
            r.startsWith('MISSING_CRITICAL') || r === 'INSUFFICIENT_EVIDENCE',
        ) ||
        scored.routes
          .filter((r) => r.zoneId === z.id)
          .every((r) =>
            r.rejectionReasons.includes('INSUFFICIENT_ROUTE_EVIDENCE'),
          ),
    );
  const safety = resolved.route?.safetyScore;
  const decision: DecisionResponse = {
    requestId: randomUUID(),
    intent: plan.intent,
    plan,
    scenario: request.scenario,
    mode: 'DEMO',
    recommendation: {
      status: resolved.selected
        ? safety! < CONFIG.cautionSafety
          ? 'CAUTION'
          : 'RECOMMENDED'
        : missing
          ? 'INSUFFICIENT_DATA'
          : 'NOT_RECOMMENDED',
      candidateZoneId: resolved.selected?.id,
      routeId: resolved.route?.id,
      safetyScore: safety,
      opportunityScore: resolved.selected?.opportunity.score,
      confidence: resolved.selected
        ? Math.min(
            resolved.selected.confidence.score,
            resolved.route?.confidence ?? 0,
          )
        : 0,
    },
    answer: '',
    reasons: [],
    alternatives: resolved.zones
      .filter((z) => z.id !== resolved.selected?.id)
      .map((z) => z.id),
    warnings: [
      ...FIXTURES.advisories.map((a) => a.text),
      'Replay clock: 6 September 2026, 12:00 IST. Evidence validity: 7 September 2026 only.',
      'Confidence measures evidence coverage and quality; it is not prediction accuracy or a probability of safety.',
      ...[marine.readings, marine.candidates, weather].flatMap((v) =>
        v.error ? [v.error] : [],
      ),
    ],
    zones: resolved.zones,
    routes: scored.routes,
    evidence,
    geofences: geo.fences,
    map: {
      center: plan.origin,
      layers: buildLayers(
        resolved.zones,
        scored.routes,
        geo.fences,
        resolved.selected?.id,
        resolved.route?.id,
      ),
      waterRegion: FIXTURES.region.water,
    },
    agentTrace: [],
  };
  const explanation = await execute(
    trace,
    'explanation',
    'Explanation',
    'explain_decision',
    () => explainDecision(decision),
    () => ({
      summary:
        'Explanation assembled exclusively from the computed decision and evidence.',
    }),
  );
  decision.answer = explanation.answer;
  decision.reasons = explanation.reasons;
  decision.agentTrace = [
    'planner',
    'marine',
    'weather',
    'gis',
    'decision',
    'routes',
    'explanation',
  ].flatMap((id) => trace.filter((t) => t.id === id));
  return { status: 'COMPLETE', context: parsed.context, decision };
}

import type {
  ConfidenceBreakdown,
  Evidence,
  MarineSnapshot,
  MarineVariable,
  RankedZone,
  RouteCandidate,
  ScoreBreakdown,
} from '@orca/contracts';
import { CONFIG } from './config';
import { CRITICAL, EXPECTED, usableEvidence } from './evidence';

export const clamp = (value: number, min = 0, max = 1): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const risk = (value: number | undefined, ceiling: number) =>
  value === undefined || !Number.isFinite(value) || value < 0
    ? 1
    : clamp(value / ceiling);

export function calculateConfidence(
  evidence: Evidence[],
  time: string,
): ConfidenceBreakdown {
  const valid = evidence.filter(
    (e) => usableEvidence(e, time) && EXPECTED.includes(e.variable),
  );
  const groups = EXPECTED.map((variable) =>
    valid.filter((e) => e.variable === variable),
  );
  const present = groups.filter((g) => g.length);
  const missing = EXPECTED.filter((_, i) => !groups[i].length);
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const coverage = present.length / EXPECTED.length;
  const sourceQuality = average(
    present.map((g) => average(g.map((e) => clamp(e.quality)))),
  );
  const freshness = average(
    present.map((g) =>
      average(
        g.map((e) => {
          if (e.freshness === 'DEMO') return CONFIG.confidence.demoFreshness;
          if (e.freshness !== 'CACHED') return 1;
          const ageHours =
            Math.max(0, Date.parse(time) - Date.parse(e.observedAt)) / 3600000;
          return 2 ** (-ageHours / CONFIG.confidence.cacheHalfLifeHours);
        }),
      ),
    ),
  );
  const consistency = present.length
    ? Math.min(
        ...present.map((g) => {
          const values = g.map((e) => e.value);
          return clamp(
            1 -
              (Math.max(...values) - Math.min(...values)) /
                Math.max(1, ...values.map(Math.abs)),
          );
        }),
      )
    : 0;
  return {
    score: clamp(coverage * freshness * sourceQuality * consistency),
    coverage,
    freshness,
    sourceQuality,
    consistency,
    missing,
  };
}

export function calculateSafetyScore(
  snapshot: MarineSnapshot,
  confidence: number,
  restricted = false,
): ScoreBreakdown {
  const gates: string[] = [];
  for (const variable of CRITICAL) {
    const value = snapshot[variable];
    if (value === undefined || !Number.isFinite(value) || value < 0)
      gates.push('MISSING_CRITICAL_' + variable);
  }
  if ((snapshot.waveHeightM ?? 0) >= CONFIG.gates.waveM)
    gates.push('HARD_GATE_WAVES');
  if ((snapshot.windSpeedMs ?? 0) >= CONFIG.gates.windMs)
    gates.push('HARD_GATE_WIND');
  if ((snapshot.currentSpeedMs ?? 0) >= CONFIG.gates.currentMs)
    gates.push('HARD_GATE_CURRENT');
  if ((snapshot.alertSeverity ?? 0) >= CONFIG.gates.alertSeverity)
    gates.push('HARD_GATE_SEVERE_ALERT');
  if (restricted) gates.push('HARD_GATE_RESTRICTED_ZONE');
  const factors = {
    wave: risk(snapshot.waveHeightM, CONFIG.normalization.waveM),
    wind: risk(snapshot.windSpeedMs, CONFIG.normalization.windMs),
    alert: risk(snapshot.alertSeverity, CONFIG.normalization.alert),
    current: risk(snapshot.currentSpeedMs, CONFIG.normalization.currentMs),
    boundary: restricted ? 1 : 0,
    uncertainty: 1 - clamp(confidence),
  };
  const total = Object.entries(factors).reduce(
    (sum, [key, value]) =>
      sum + CONFIG.riskWeights[key as keyof typeof CONFIG.riskWeights] * value,
    0,
  );
  return { score: Math.round(100 * (1 - clamp(total))), factors, gates };
}

export function calculateFishingOpportunity(
  snapshot: MarineSnapshot,
  evidence: Evidence[] = [],
): ScoreBreakdown {
  const suitability = (
    value: number | undefined,
    ideal: number,
    tolerance: number,
  ) =>
    value === undefined ? 0 : clamp(1 - Math.abs(value - ideal) / tolerance);
  const quality = (variable: MarineVariable) => {
    const rows = evidence.filter(
      (e) => e.variable === variable && usableEvidence(e, snapshot.time),
    );
    return rows.length ? Math.min(...rows.map((e) => e.quality)) : 0;
  };
  const cfg = CONFIG.opportunity;
  const factors = {
    pfz: clamp(snapshot.pfzSignal ?? 0) * quality('pfzSignal'),
    sst:
      suitability(snapshot.sstC, cfg.optimalSstC, cfg.sstToleranceC) *
      quality('sstC'),
    chlorophyll:
      suitability(snapshot.chlorophyllMgM3, cfg.optimalChl, cfg.chlTolerance) *
      quality('chlorophyllMgM3'),
    other: clamp(snapshot.otherSignal ?? 0) * quality('otherSignal'),
  };
  const score = Math.round(
    100 *
      clamp(
        cfg.pfz * factors.pfz +
          cfg.sst * factors.sst +
          cfg.chlorophyll * factors.chlorophyll +
          cfg.other * factors.other,
      ),
  );
  return { score, factors, gates: [] };
}

export function calculateRouteCost(
  route: Pick<
    RouteCandidate,
    'distanceKm' | 'meanRisk' | 'maxRisk' | 'confidence' | 'rejected'
  >,
) {
  const c = CONFIG.route;
  const breakdown = {
    distance: clamp(route.distanceKm / c.distanceScaleKm) * c.distanceWeight,
    meanRisk: clamp(route.meanRisk) * c.meanWeight,
    maxRisk: clamp(route.maxRisk) * c.maxWeight,
    uncertainty: (1 - clamp(route.confidence)) * c.uncertaintyWeight,
  };
  // JSON cannot serialize Infinity. null explicitly represents an infeasible cost.
  return {
    cost: route.rejected
      ? null
      : Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown,
  };
}
export function compareRoutes(routes: RouteCandidate[]): RouteCandidate[] {
  return [...routes].sort(
    (a, b) =>
      Number(a.rejected) - Number(b.rejected) ||
      (a.routeCost ?? Number.MAX_VALUE) - (b.routeCost ?? Number.MAX_VALUE) ||
      a.id.localeCompare(b.id),
  );
}
export function rankFishingZones(zones: RankedZone[]): RankedZone[] {
  return [...zones].sort(
    (a, b) =>
      Number(a.rejected) - Number(b.rejected) ||
      b.utility - a.utility ||
      a.id.localeCompare(b.id),
  );
}

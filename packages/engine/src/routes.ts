import type {
  Evidence,
  Geofence,
  RouteCandidate,
  TripPlan,
} from '@orca/contracts';
import {
  aggregateRouteRisk,
  lineIntersectsPolygon,
  lineWithinWater,
  routeLength,
  sampleRoute,
} from '@orca/geo';
import { CONFIG } from './config';
import { evidenceAt, snapshotFromEvidence } from './evidence';
import { FIXTURES } from './fixtures';
import {
  calculateConfidence,
  calculateRouteCost,
  calculateSafetyScore,
} from './scoring';

export function prepareRoutes(zoneIds: string[], geofences: Geofence[]) {
  return FIXTURES.routes
    .filter((route) => zoneIds.includes(route.zoneId))
    .map((route) => ({
      ...structuredClone(route),
      distanceKm: routeLength(route.geometry),
      points: sampleRoute(route.geometry, CONFIG.route.sampleKm),
      inWater: lineWithinWater(route.geometry, FIXTURES.region.water),
      boundaryIntersections: geofences
        .filter(
          (g) =>
            g.category === 'restricted' &&
            lineIntersectsPolygon(route.geometry, g.geometry),
        )
        .map((g) => g.id),
      hazardIntersections: geofences
        .filter(
          (g) =>
            g.category === 'hazard' &&
            lineIntersectsPolygon(route.geometry, g.geometry),
        )
        .map((g) => g.id),
    }));
}
export function scoreRoutes(
  prepared: ReturnType<typeof prepareRoutes>,
  evidence: Evidence[],
  plan: TripPlan,
): RouteCandidate[] {
  return prepared.map((route) => {
    const samples = route.points.map((sample) => {
      const arrivalTime = new Date(
        Date.parse(plan.departureTime) +
          (sample.distanceKm / CONFIG.route.speedKmH) * 3600000,
      ).toISOString();
      const local = evidenceAt(evidence, sample.location, arrivalTime);
      const snapshot = snapshotFromEvidence(
        local,
        sample.location,
        arrivalTime,
      );
      const confidence = calculateConfidence(local, arrivalTime);
      const safety = calculateSafetyScore(snapshot, confidence.score);
      return {
        ...sample,
        arrivalTime,
        evidenceIds: snapshot.evidenceIds,
        risk: 1 - safety.score / 100,
        gates: safety.gates,
        confidence: confidence.score,
      };
    });
    const { meanRisk, maxRisk } = aggregateRouteRisk(samples);
    const confidence = Math.min(...samples.map((s) => s.confidence));
    const rejectionReasons = [...new Set(samples.flatMap((s) => s.gates))];
    if (route.boundaryIntersections.length)
      rejectionReasons.push('HARD_GATE_RESTRICTED_ZONE');
    if (!route.inWater) rejectionReasons.push('HARD_GATE_OUTSIDE_WATER_MASK');
    if (confidence < CONFIG.minimumConfidence)
      rejectionReasons.push('INSUFFICIENT_ROUTE_EVIDENCE');
    const safetyScore = Math.round(100 * (1 - maxRisk));
    if (safetyScore < CONFIG.minimumSafety)
      rejectionReasons.push('BELOW_MINIMUM_ROUTE_SAFETY');
    const rejected = rejectionReasons.length > 0;
    const cost = calculateRouteCost({
      distanceKm: route.distanceKm,
      meanRisk,
      maxRisk,
      confidence,
      rejected,
    });
    return {
      id: route.id,
      zoneId: route.zoneId,
      name: route.name,
      kind: route.kind,
      freshness: route.freshness,
      geometry: route.geometry,
      distanceKm: route.distanceKm,
      etaMinutes: Math.ceil((route.distanceKm / CONFIG.route.speedKmH) * 60),
      meanRisk,
      maxRisk,
      safetyScore,
      confidence,
      boundaryIntersections: route.boundaryIntersections,
      hazardIntersections: route.hazardIntersections,
      rejected,
      rejectionReasons,
      routeCost: cost.cost,
      costBreakdown: cost.breakdown,
      samples: samples.map((sample) => ({
        location: sample.location,
        distanceKm: sample.distanceKm,
        arrivalTime: sample.arrivalTime,
        evidenceIds: sample.evidenceIds,
        risk: sample.risk,
        gates: sample.gates,
      })),
    };
  });
}

import type { DecisionResponse } from '@orca/contracts';

const LABELS: Record<string, string> = {
  HARD_GATE_WAVES: 'Wave height reaches the prototype limit',
  HARD_GATE_WIND: 'Wind reaches the prototype limit',
  HARD_GATE_CURRENT: 'Current reaches the prototype limit',
  HARD_GATE_SEVERE_ALERT: 'Severe alert',
  HARD_GATE_RESTRICTED_ZONE: 'Restricted-area intersection',
  HARD_GATE_OUTSIDE_WATER_MASK: 'Route leaves the demonstration water mask',
  INSUFFICIENT_ROUTE_EVIDENCE: 'Insufficient evidence along the route',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  NO_FEASIBLE_ROUTE: 'No feasible route',
  BELOW_MINIMUM_ROUTE_SAFETY: 'Route safety below the prototype minimum',
};
export function gateLabel(gate: string): string {
  if (gate.startsWith('MISSING_CRITICAL_'))
    return (
      'Missing critical ' +
      gate
        .slice(17)
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
    );
  return LABELS[gate] ?? gate;
}
export function explainDecision(
  decision: Pick<
    DecisionResponse,
    'recommendation' | 'zones' | 'routes' | 'intent'
  >,
): { answer: string; reasons: string[] } {
  const zone = decision.zones.find(
    (z) => z.id === decision.recommendation.candidateZoneId,
  );
  const route = decision.routes.find(
    (r) => r.id === decision.recommendation.routeId,
  );
  if (!zone || !route) {
    const missing = decision.recommendation.status === 'INSUFFICIENT_DATA';
    return {
      answer: missing
        ? 'No recommendation: required evidence is unavailable for this trip. Missing readings have not been substituted.'
        : 'No candidate has a feasible route under the prototype rules. Do not use a rejected option.',
      reasons: [
        ...new Set(
          decision.zones.flatMap((z) => z.rejectionReasons).map(gateLabel),
        ),
      ],
    };
  }
  const nearest = [...decision.zones].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0];
  const reasons = [
    'Relative fishing opportunity: ' +
      zone.opportunity.score +
      '/100 from the demo evidence.',
    'Worst sampled voyage safety: ' + route.safetyScore + '/100.',
    'No restricted-area intersection on the selected route.',
    route.hazardIntersections.length
      ? 'The route intersects a demonstration hazard layer; inspect the exposure.'
      : 'The selected route avoids the mapped hazard area.',
  ];
  const comparison =
    nearest && nearest.id !== zone.id
      ? ' ' +
        nearest.name +
        ' is closer (' +
        nearest.distanceKm.toFixed(1) +
        ' km), but ' +
        (nearest.rejected
          ? nearest.rejectionReasons.map(gateLabel).join('; ').toLowerCase()
          : 'has lower combined utility') +
        '.'
      : '';
  return {
    answer:
      'In this DEMO replay, ' +
      zone.name +
      ' ranks first. Use the ' +
      route.name.toLowerCase() +
      ' candidate (' +
      route.distanceKm.toFixed(1) +
      ' km).' +
      comparison,
    reasons,
  };
}

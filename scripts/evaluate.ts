import { writeFileSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import { scenarioSchema } from '@orca/contracts';
import { CONFIG, runQuery } from '@orca/engine';
import rawCases from '../data/demo/evaluation-cases.json';

const cases = z
  .array(
    z.object({
      id: z.string(),
      message: z.string(),
      scenario: scenarioSchema,
      status: z.enum(['COMPLETE', 'CLARIFICATION', 'UNSUPPORTED']),
      zoneId: z.string().nullable().optional(),
      decisionStatus: z.string().optional(),
    }),
  )
  .parse(rawCases);
const results = [];
for (const item of cases) {
  const start = performance.now();
  const response = await runQuery({
    message: item.message,
    scenario: item.scenario,
    language: 'en',
  });
  const d = response.status === 'COMPLETE' ? response.decision : undefined;
  const allowed = new Set([
    '100',
    ...(d?.zones ?? []).flatMap((zone) => [
      String(zone.opportunity.score),
      zone.distanceKm.toFixed(1),
    ]),
    ...(d?.routes ?? []).flatMap((route) => [
      String(route.safetyScore),
      route.distanceKm.toFixed(1),
    ]),
  ]);
  const numbers = d
    ? ((d.answer + ' ' + d.reasons.join(' ')).match(/\b\d+(?:\.\d+)?\b/g) ?? [])
    : [];
  const unsupportedNumbers = numbers.filter((n) => !allowed.has(n));
  const passed =
    response.status === item.status &&
    (!d ||
      ((d.recommendation.candidateZoneId ?? null) === (item.zoneId ?? null) &&
        d.recommendation.status === item.decisionStatus &&
        unsupportedNumbers.length === 0 &&
        d.evidence.every((e) => e.freshness === 'DEMO')));
  results.push({
    id: item.id,
    passed,
    status: response.status,
    selectedZone: d?.recommendation.candidateZoneId ?? null,
    decisionStatus: d?.recommendation.status ?? null,
    unsupportedNumbers,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
  });
}
const report = {
  evaluatedAt: new Date().toISOString(),
  engineVersion: CONFIG.version,
  evaluationKind:
    'Controlled, synthetic acceptance cases authored with this implementation. Not a held-out real-world benchmark.',
  requestedRealWorldAccuracy: 0.99,
  measuredRealWorldAccuracy: null,
  trainedModel: false,
  passed: results.filter((r) => r.passed).length,
  total: results.length,
  unsupportedNumericClaims: results.reduce(
    (sum, r) => sum + r.unsupportedNumbers.length,
    0,
  ),
  notes: [
    'Passing these cases measures conformance to this demo specification, not marine prediction skill.',
    'No catch, vessel, hazard or expert-labelled real-world outcomes were used.',
    'Evidence confidence and deterministic safety scores are not probabilities or model accuracy.',
  ],
  results,
};
mkdirSync('docs', { recursive: true });
writeFileSync(
  'docs/evaluation-report.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  report.passed +
    '/' +
    report.total +
    ' synthetic acceptance cases passed; ' +
    report.unsupportedNumericClaims +
    ' unsupported numerical claims.',
);
console.log(
  'Real-world accuracy: not measured. Report: docs/evaluation-report.json',
);
if (report.passed !== report.total) process.exitCode = 1;

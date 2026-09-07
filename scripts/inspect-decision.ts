import { runQuery } from '@orca/engine';
const result = await runQuery({
  message: 'I leave from Nagapattinam tomorrow at 5 AM to fish.',
  scenario: 'normal',
  language: 'en',
});
if (result.status !== 'COMPLETE') throw new Error(result.answer);
console.log(
  JSON.stringify(
    {
      recommendation: result.decision.recommendation,
      zones: result.decision.zones.map((z) => ({
        id: z.id,
        utility: z.utility,
        gates: z.rejectionReasons,
      })),
      routes: result.decision.routes.map((r) => ({
        id: r.id,
        gates: r.rejectionReasons,
        safety: r.safetyScore,
        distanceKm: r.distanceKm,
        badSampleCount: r.samples.filter((s) => s.gates.length).length,
      })),
    },
    null,
    2,
  ),
);

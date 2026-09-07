import { CONFIG, FIXTURES } from '@orca/engine';
export const dynamic = 'force-dynamic';
export function GET() {
  const disabled = process.env.DEMO_MODE === 'false';
  return Response.json(
    {
      app: 'ok',
      mode: disabled ? 'disabled' : 'DEMO',
      marine: disabled ? 'unavailable' : 'demo',
      pfz: disabled ? 'unavailable' : 'demo',
      weather: disabled ? 'unavailable' : 'demo',
      geo: 'in-process',
      llm: 'not-configured',
      database: 'not-used',
      replayClock: CONFIG.replayClock,
      modelAccuracy: null,
      fixtures: {
        zones: FIXTURES.candidates.length,
        evidence: FIXTURES.evidence.length,
        routes: FIXTURES.routes.length,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

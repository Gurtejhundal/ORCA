import { describe, expect, it } from 'vitest';
import type { ChatResponse, Scenario } from '@orca/contracts';
import {
  FIXTURES,
  FixtureFishingZoneProvider,
  FixtureMarineProvider,
  FixtureWeatherProvider,
  parseIntent,
  runQuery,
} from '@orca/engine';
export const QUERY =
  'I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?';
const run = (scenario: Scenario = 'normal') =>
  runQuery({ message: QUERY, scenario, language: 'en' });
function complete(r: ChatResponse) {
  expect(r.status).toBe('COMPLETE');
  if (r.status !== 'COMPLETE') throw new Error('Expected complete decision');
  return r.decision;
}
describe('intent and replay time', () => {
  it('parses tomorrow at 5 AM in IST', () => {
    const result = parseIntent(QUERY);
    expect(result.status).toBe('READY');
    if (result.status === 'READY')
      expect(result.plan.departureTime).toBe('2026-09-07T05:00:00+05:30');
  });
  it('handles local month rollover', () => {
    const result = parseIntent(QUERY, {}, '2026-12-31T23:00:00+05:30');
    if (result.status !== 'READY') throw new Error('Unparsed');
    expect(result.plan.departureTime).toBe('2027-01-01T05:00:00+05:30');
  });
  it.each([
    'I leave from Chennai tomorrow at 5 AM to fish',
    'What is quantum mechanics?',
  ])('rejects unsupported request %s', (query) =>
    expect(parseIntent(query).status).toBe('UNSUPPORTED'),
  );
  it.each([
    'Where should I fish tomorrow at 5 AM?',
    'I leave from Nagapattinam tomorrow to fish',
    'I leave from Nagapattinam tomorrow at 5 to fish',
    'I leave from Nagapattinam tomorrow at 13 AM to fish',
    'I leave from Nagapattinam on 2026-02-30 at 5 AM to fish',
    'I leave from Nagapattinam next Monday at 5 AM to fish',
  ])('clarifies incomplete/invalid query %s', (query) =>
    expect(parseIntent(query).status).toBe('CLARIFICATION'),
  );
  it('completes a date/time clarification with context', () => {
    const first = parseIntent('I am leaving from Nagapattinam to fish');
    const second = parseIntent('tomorrow at 5 AM', first.context);
    expect(second.status).toBe('READY');
  });
});
describe('end-to-end decision pipeline', () => {
  it('recommends B, rejects A, and selects a longer route that avoids restrictions', async () => {
    const d = complete(await run());
    expect(d.recommendation.candidateZoneId).toBe('zone-b');
    expect(d.recommendation.routeId).toBe('zone-b-waypoint');
    expect(d.zones).toHaveLength(3);
    expect(d.zones.find((z) => z.id === 'zone-a')!.rejected).toBe(true);
    const direct = d.routes.find((r) => r.id === 'zone-b-direct')!;
    const selected = d.routes.find((r) => r.id === d.recommendation.routeId)!;
    expect(direct.boundaryIntersections).toContain('restricted-1');
    expect(direct.rejected).toBe(true);
    expect(selected.rejected).toBe(false);
    expect(selected.distanceKm).toBeGreaterThan(direct.distanceKm);
    expect(selected.hazardIntersections).toEqual([]);
    expect(d.agentTrace).toHaveLength(7);
    expect(d.agentTrace.every((t) => t.status === 'COMPLETE')).toBe(true);
  });
  it.each(['high-waves', 'restricted-route'] as const)(
    '%s perturbation changes the destination to C',
    async (scenario) => {
      const d = complete(await run(scenario));
      expect(d.recommendation.candidateZoneId).toBe('zone-c');
      expect(d.zones.find((z) => z.id === 'zone-b')!.rejected).toBe(true);
    },
  );
  it('provider failure returns insufficient data without fabricated marine values', async () => {
    const d = complete(await run('api-failure'));
    expect(d.recommendation.status).toBe('INSUFFICIENT_DATA');
    expect(d.recommendation.routeId).toBeUndefined();
    expect(d.evidence.some((e) => e.variable === 'waveHeightM')).toBe(false);
    expect(d.agentTrace.find((t) => t.id === 'marine')!.status).toBe('FAILED');
  });
  it('isolates thrown provider errors', async () => {
    const d = complete(
      await runQuery(
        { message: QUERY, scenario: 'normal', language: 'en' },
        {
          marine: {
            getSnapshot: async () => {
              throw new Error('Network failed');
            },
          },
          weather: new FixtureWeatherProvider(),
          fishing: new FixtureFishingZoneProvider(),
        },
      ),
    );
    expect(d.recommendation.status).toBe('INSUFFICIENT_DATA');
  });
  it('no fishing zones yields no destination', async () => {
    const d = complete(
      await runQuery(
        { message: QUERY, scenario: 'normal', language: 'en' },
        {
          marine: new FixtureMarineProvider(),
          weather: new FixtureWeatherProvider(),
          fishing: {
            getCandidates: async () => ({
              status: 'unavailable',
              source: 'test',
              fetchedAt: '2026-09-06T12:00:00Z',
              data: [],
              error: 'Unavailable',
            }),
          },
        },
      ),
    );
    expect(d.recommendation.candidateZoneId).toBeUndefined();
    expect(d.recommendation.status).toBe('INSUFFICIENT_DATA');
  });
  it('does not use fixtures outside their validity window', async () => {
    const d = complete(
      await runQuery({
        message: QUERY.replace('tomorrow', 'on 2027-01-01'),
        scenario: 'normal',
        language: 'en',
      }),
    );
    expect(d.recommendation.status).toBe('INSUFFICIENT_DATA');
    expect(d.evidence).toEqual([]);
  });
  it('checks validity throughout transit, including the destination', async () => {
    const d = complete(
      await runQuery({
        message: QUERY.replace('5 AM', '11:59 PM'),
        scenario: 'normal',
        language: 'en',
      }),
    );
    expect(d.recommendation.routeId).toBeUndefined();
    expect(d.routes.every((r) => r.rejected)).toBe(true);
  });
  it('supports context follow-ups and recomputes a changed departure', async () => {
    const first = await run();
    if (first.status !== 'COMPLETE') throw new Error('No context');
    const why = complete(
      await runQuery({
        message: 'Why not the nearest fishing zone?',
        context: first.context,
        scenario: 'normal',
        language: 'en',
      }),
    );
    expect(why.intent).toBe('EXPLAIN_NEAREST');
    expect(why.answer).toContain('Zone A');
    const later = complete(
      await runQuery({
        message: 'What if I leave 3 hours later?',
        context: first.context,
        scenario: 'normal',
        language: 'en',
      }),
    );
    expect(later.plan.departureTime).toBe('2026-09-07T08:00:00+05:30');
  });
  it('has no dangling evidence references, and every synthetic record is labelled', async () => {
    const d = complete(await run());
    const ids = new Set(d.evidence.map((e) => e.id));
    for (const zone of d.zones)
      for (const id of zone.evidenceIds) expect(ids.has(id)).toBe(true);
    for (const route of d.routes)
      for (const sample of route.samples)
        for (const id of sample.evidenceIds) expect(ids.has(id)).toBe(true);
    expect(d.evidence.every((e) => e.freshness === 'DEMO')).toBe(true);
    expect(
      d.map.layers.features.every((f) => f.properties?.freshness === 'DEMO'),
    ).toBe(true);
    expect(FIXTURES.advisories.every((a) => a.freshness === 'DEMO')).toBe(true);
  });
  it('numeric explanation claims are traceable to computed scores or distances', async () => {
    const d = complete(await run());
    const allowed = new Set([
      '100',
      ...d.zones.flatMap((z) => [
        String(z.opportunity.score),
        z.distanceKm.toFixed(1),
      ]),
      ...d.routes.flatMap((r) => [
        String(r.safetyScore),
        r.distanceKm.toFixed(1),
      ]),
    ]);
    const claims =
      (d.answer + ' ' + d.reasons.join(' ')).match(/\b\d+(?:\.\d+)?\b/g) ?? [];
    for (const claim of claims) expect(allowed.has(claim)).toBe(true);
  });
  it('all-critical-hazard change suppresses every recommendation', async () => {
    const provider = new FixtureMarineProvider();
    const d = complete(
      await runQuery(
        { message: QUERY, scenario: 'normal', language: 'en' },
        {
          marine: {
            getSnapshot: async (input) => {
              const result = await provider.getSnapshot(input);
              return {
                ...result,
                data: result.data.map((e) =>
                  e.variable === 'waveHeightM' ? { ...e, value: 5 } : e,
                ),
              };
            },
          },
          weather: new FixtureWeatherProvider(),
          fishing: new FixtureFishingZoneProvider(),
        },
      ),
    );
    expect(d.recommendation.status).toBe('NOT_RECOMMENDED');
    expect(d.recommendation.candidateZoneId).toBeUndefined();
  });
});

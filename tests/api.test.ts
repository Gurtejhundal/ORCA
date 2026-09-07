import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../apps/web/src/app/api/chat/route';
import { GET } from '../apps/web/src/app/api/health/route';

const QUERY = 'I leave from Nagapattinam tomorrow at 5 AM to fish.';
const post = (body: string) =>
  POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
afterEach(() => {
  delete process.env.DEMO_MODE;
});
describe('API boundary', () => {
  it('rejects malformed JSON', async () =>
    expect((await post('{bad')).status).toBe(400));
  it.each([
    {},
    { message: '' },
    { message: 42 },
    { message: QUERY, scenario: 'invented' },
    { message: 'a'.repeat(2001) },
  ])('validates request %#', async (body) =>
    expect((await post(JSON.stringify(body))).status).toBe(400),
  );
  it('limits request size', async () =>
    expect((await post('x'.repeat(12001))).status).toBe(413));
  it('returns a computed decision and prevents caching', async () => {
    const response = await post(JSON.stringify({ message: QUERY }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.decision.recommendation.candidateZoneId).toBe('zone-b');
  });
  it('does not silently substitute demo data when demo mode is disabled', async () => {
    process.env.DEMO_MODE = 'false';
    expect((await post(JSON.stringify({ message: QUERY }))).status).toBe(503);
    expect((await GET().json()).mode).toBe('disabled');
  });
  it('health does not claim an LLM, live data, database or measured accuracy', async () => {
    const health = await GET().json();
    expect(health.llm).toBe('not-configured');
    expect(health.database).toBe('not-used');
    expect(health.modelAccuracy).toBeNull();
    expect(health.marine).toBe('demo');
  });
});

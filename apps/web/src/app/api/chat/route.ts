import { chatRequestSchema } from '@orca/contracts';
import { runQuery } from '@orca/engine';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (process.env.DEMO_MODE === 'false')
    return Response.json(
      {
        status: 'ERROR',
        answer: 'Demo mode is disabled. No live providers are configured.',
      },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 12000)
    return Response.json(
      { status: 'ERROR', answer: 'Request is too large.' },
      { status: 413 },
    );
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { status: 'ERROR', answer: 'Request must contain valid JSON.' },
      { status: 400 },
    );
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        status: 'ERROR',
        answer:
          'Provide a message of 1–2,000 characters and a supported scenario.',
      },
      { status: 400 },
    );
  try {
    return Response.json(await runQuery(parsed.data), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(
      'ORCA pipeline failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return Response.json(
      {
        status: 'ERROR',
        answer: 'The decision could not be computed. Retry the demo.',
      },
      { status: 500 },
    );
  }
}

import { chatRequestSchema } from '@orca/contracts';
import { parseIntent } from '@orca/engine';
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 12000)
      return Response.json({ error: 'Request is too large' }, { status: 413 });
    const body = chatRequestSchema.safeParse(JSON.parse(raw));
    if (!body.success)
      return Response.json(
        { error: 'Invalid planning request' },
        { status: 400 },
      );
    return Response.json(parseIntent(body.data.message, body.data.context), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

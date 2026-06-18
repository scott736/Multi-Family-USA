export const prerender = false;

import type { APIRoute } from 'astro';

const CRM_WEBHOOK_SECRET =
  import.meta.env.CRM_WEBHOOK_SECRET ||
  (typeof process !== 'undefined' ? process.env.CRM_WEBHOOK_SECRET : undefined);

export const POST: APIRoute = async ({ request }) => {
  if (!CRM_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'not-configured' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const provided = request.headers.get('x-crm-webhook-secret');
  if (provided !== CRM_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid-json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'CRM webhook stub received payload',
      receivedAt: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

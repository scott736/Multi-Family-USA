export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { jsonResponse, parseJsonBody } from '@/lib/nylas/api-response';
import {
  cancelBookingByToken,
  getPendingBookingByToken,
  toPendingBookingView,
} from '@/lib/nylas/booking';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const cancelPostSchema = z.object({
  token: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const GET: APIRoute = async ({ request, url }) => {
  const rl = await rateLimit(request, { id: 'nylas-cancel-get', limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const token = url.searchParams.get('token');
  if (!token) {
    return jsonResponse({ success: false, error: 'Missing token' }, 400);
  }

  try {
    const record = await getPendingBookingByToken(token);
    if (!record) {
      return jsonResponse({ success: false, error: 'Booking not found' }, 404);
    }

    return jsonResponse({ success: true, data: toPendingBookingView(record) });
  } catch (err) {
    logger.error('Cancel GET failed', err);
    return jsonResponse({ success: false, error: 'Failed to load booking' }, 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'nylas-cancel-post', limit: 10, windowSeconds: 60 * 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const raw = await parseJsonBody(request);
  if (!raw) {
    return jsonResponse({ success: false, error: 'Invalid body' }, 400);
  }

  const parsed = cancelPostSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ success: false, error: 'Invalid input' }, 400);
  }

  try {
    await cancelBookingByToken(parsed.data.token, parsed.data.reason);
    return jsonResponse({ success: true });
  } catch (err) {
    logger.error('Cancel POST failed', err);
    const message = err instanceof Error ? err.message : 'Failed to cancel booking';
    const status = message === 'Booking not found' ? 404 : 502;
    return jsonResponse({ success: false, error: message }, status);
  }
};

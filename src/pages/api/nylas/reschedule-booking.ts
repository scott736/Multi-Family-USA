export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { jsonResponse, parseJsonBody } from '@/lib/nylas/api-response';
import { rescheduleBookingByToken } from '@/lib/nylas/booking';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const rescheduleSchema = z.object({
  token: z.string().min(1),
  newStartTime: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(100),
});

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'nylas-reschedule', limit: 10, windowSeconds: 60 * 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const raw = await parseJsonBody(request);
  if (!raw) {
    return jsonResponse({ success: false, error: 'Invalid body' }, 400);
  }

  const parsed = rescheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ success: false, error: 'Invalid input' }, 400);
  }

  try {
    const data = await rescheduleBookingByToken(
      parsed.data.token,
      parsed.data.newStartTime,
      parsed.data.timezone,
    );
    return jsonResponse({ success: true, data });
  } catch (err) {
    logger.error('Reschedule failed', err);
    const message = err instanceof Error ? err.message : 'Failed to reschedule booking';
    const status =
      message === 'Booking not found'
        ? 404
        : message.includes('no longer available') || message.includes('Only confirmed')
          ? 400
          : 502;
    return jsonResponse({ success: false, error: message }, status);
  }
};

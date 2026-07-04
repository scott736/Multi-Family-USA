export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { jsonResponse, parseJsonBody } from '@/lib/nylas/api-response';
import { getAvailability } from '@/lib/nylas/availability';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const availabilitySchema = z.object({
  serviceId: z.string().min(1),
  teamMemberId: z.string().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
  duration: z.coerce.number().int().positive().max(480).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'nylas-availability', limit: 60, windowSeconds: 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const raw = await parseJsonBody(request);
  if (!raw) {
    return jsonResponse({ success: false, error: 'Invalid body' }, 400);
  }

  const parsed = availabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ success: false, error: 'Invalid input' }, 400);
  }

  try {
    const days = await getAvailability(parsed.data);
    return jsonResponse({ success: true, data: { days } });
  } catch (err) {
    logger.error('Availability lookup failed', err);
    const message = err instanceof Error ? err.message : 'Failed to load availability';
    return jsonResponse({ success: false, error: message }, 400);
  }
};

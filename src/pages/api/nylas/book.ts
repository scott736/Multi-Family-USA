export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { jsonResponse, parseJsonBody } from '@/lib/nylas/api-response';
import { createPendingBooking } from '@/lib/nylas/booking';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const bookSchema = z.object({
  serviceId: z.string().min(1),
  teamMemberId: z.string().min(1),
  startTime: z.string().datetime({ offset: true }),
  guestName: z.string().min(2).max(120),
  guestEmail: z.string().email().max(200),
  guestPhone: z.string().min(7).max(40).optional(),
  notes: z.string().max(1000).optional(),
  timezone: z.string().min(1).max(100),
  meetingType: z.enum(['phone', 'teams', 'zoom', 'meet']).optional(),
  cancelToken: z.string().min(1).optional(),
  // Honeypot: allow any short string so bots pass Zod, then short-circuit below.
  website: z.string().max(200).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'nylas-book', limit: 10, windowSeconds: 60 * 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const raw = await parseJsonBody(request);
  if (!raw) {
    return jsonResponse({ success: false, error: 'Invalid body' }, 400);
  }

  const parsed = bookSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ success: false, error: 'Invalid input' }, 400);
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    return jsonResponse({ success: true, requiresConfirmation: true, data: { email: parsed.data.guestEmail } });
  }

  try {
    const result = await createPendingBooking(parsed.data);
    return jsonResponse({
      success: true,
      requiresConfirmation: true,
      data: result,
    });
  } catch (err) {
    logger.error('Booking creation failed', err);
    const message = err instanceof Error ? err.message : 'Failed to create booking';
    const status = message.includes('Too many booking attempts') ? 429 : 502;
    return jsonResponse({ success: false, error: message }, status);
  }
};

export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { jsonResponse, parseJsonBody } from '@/lib/nylas/api-response';
import {
  confirmPendingBooking,
  expireStalePendingBookings,
  getPendingBookingByToken,
  toPendingBookingView,
} from '@/lib/nylas/booking';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const confirmPostSchema = z.object({
  token: z.string().min(1),
});

export const GET: APIRoute = async ({ request, url }) => {
  const rl = await rateLimit(request, { id: 'nylas-confirm-get', limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const token = url.searchParams.get('token');
  if (!token) {
    return jsonResponse({ success: false, error: 'Missing token' }, 400);
  }

  try {
    await expireStalePendingBookings();
    const record = await getPendingBookingByToken(token);
    if (!record) {
      return jsonResponse({ success: false, error: 'Booking not found' }, 404);
    }

    return jsonResponse({ success: true, data: toPendingBookingView(record) });
  } catch (err) {
    logger.error('Confirm GET failed', err);
    return jsonResponse({ success: false, error: 'Failed to load booking' }, 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'nylas-confirm-post', limit: 10, windowSeconds: 60 * 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const raw = await parseJsonBody(request);
  if (!raw) {
    return jsonResponse({ success: false, error: 'Invalid body' }, 400);
  }

  const parsed = confirmPostSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ success: false, error: 'Invalid input' }, 400);
  }

  try {
    const confirmation = await confirmPendingBooking(parsed.data.token);
    return jsonResponse({
      success: true,
      data: {
        id: confirmation.id,
        service: {
          name: confirmation.service.name,
          duration: confirmation.service.duration,
        },
        teamMember: {
          name: confirmation.teamMember.name,
          email: confirmation.teamMember.email,
        },
        startTime: confirmation.startTime.toISOString(),
        endTime: confirmation.endTime.toISOString(),
        meetingLink: confirmation.meetingLink,
        calendarLinks: confirmation.calendarLinks,
      },
    });
  } catch (err) {
    logger.error('Confirm POST failed', err);
    const message = err instanceof Error ? err.message : 'Failed to confirm booking';
    const status =
      message === 'Booking not found'
        ? 404
        : message.includes('already confirmed') || message.includes('expired') || message.includes('cancelled')
          ? 400
          : 502;
    return jsonResponse({ success: false, error: message }, status);
  }
};

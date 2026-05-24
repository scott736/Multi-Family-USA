/**
 * Pending Bookings Management
 * Handles booking confirmations via email before creating calendar events
 */

import { getServerSupabase } from '@/lib/supabase';
import { createBooking, getAvailability } from './client';
import { getServiceById } from './config';
import type { BookingRequest, BookingConfirmation } from './types';
import crypto from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface PendingBooking {
  id: string;
  token: string;
  service_id: string;
  team_member_id: string;
  start_time: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  notes?: string;
  timezone: string;
  duration_override?: number;
  meeting_type?: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  confirmed_at?: string;
}

// ============================================================================
// Configuration
// ============================================================================

// How long the user has to confirm their booking (in hours)
const CONFIRMATION_EXPIRY_HOURS = 24;

// ============================================================================
// Functions
// ============================================================================

/**
 * Generate a secure random token for confirmation links
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a pending booking (before email confirmation)
 */
export async function createPendingBooking(
  request: BookingRequest
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const supabase = getServerSupabase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + CONFIRMATION_EXPIRY_HOURS * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('pending_bookings')
    .insert({
      token,
      service_id: request.serviceId,
      team_member_id: request.teamMemberId,
      start_time: request.startTime,
      guest_name: request.guestName,
      guest_email: request.guestEmail.toLowerCase().trim(),
      guest_phone: request.guestPhone || null,
      notes: request.notes || null,
      timezone: request.timezone,
      duration_override: request.durationOverride || null,
      meeting_type: request.meetingType || null,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating pending booking:', error);
    throw new Error('Failed to create pending booking');
  }

  return {
    id: data.id,
    token,
    expiresAt,
  };
}

/**
 * Get a pending booking by its confirmation token
 */
export async function getPendingBookingByToken(token: string): Promise<PendingBooking | null> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('pending_bookings')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PendingBooking;
}

/**
 * Confirm a pending booking and create the actual calendar event.
 * Uses an atomic UPDATE with a WHERE status='pending' clause to prevent
 * double-booking from concurrent confirmation requests.
 */
export async function confirmPendingBooking(token: string): Promise<{
  success: boolean;
  booking?: BookingConfirmation;
  error?: string;
}> {
  const supabase = getServerSupabase();

  // Atomically claim the pending booking — only one request can succeed
  const { data: pending, error: claimError } = await supabase
    .from('pending_bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'pending')
    .select()
    .single();

  if (claimError || !pending) {
    // No row matched — either already confirmed, expired, cancelled, or not found
    const existing = await getPendingBookingByToken(token);
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }
    if (existing.status === 'confirmed') {
      return { success: false, error: 'This booking has already been confirmed' };
    }
    if (existing.status === 'expired' || existing.status === 'cancelled') {
      return { success: false, error: 'This booking link has expired or been cancelled' };
    }
    return { success: false, error: 'Unable to confirm booking. Please try again.' };
  }

  const typedPending = pending as PendingBooking;

  // Check if expired (claim succeeded but link was past expiry)
  if (new Date(typedPending.expires_at) < new Date()) {
    await supabase
      .from('pending_bookings')
      .update({ status: 'expired', confirmed_at: null })
      .eq('id', typedPending.id);

    return { success: false, error: 'This confirmation link has expired. Please book again.' };
  }

  // Check if the time slot is still in the future
  if (new Date(typedPending.start_time) < new Date()) {
    await supabase
      .from('pending_bookings')
      .update({ status: 'expired', confirmed_at: null })
      .eq('id', typedPending.id);

    return { success: false, error: 'This time slot has passed. Please book a new time.' };
  }

  try {
    // Re-validate that the time slot is still available on the calendar
    const service = getServiceById(typedPending.service_id);
    const slotDuration = typedPending.duration_override ?? service?.duration ?? 30;
    const slotStart = new Date(typedPending.start_time);
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);

    try {
      // endDate must be at least 1 day after startDate so Nylas gets a
      // non-zero time window (both dates resolve to midnight UTC)
      const dayStart = slotStart.toISOString().split('T')[0];
      const nextDay = new Date(slotStart.getTime() + 24 * 60 * 60 * 1000);
      const dayEnd = nextDay.toISOString().split('T')[0];

      const availableSlots = await getAvailability({
        serviceId: typedPending.service_id,
        teamMemberId: typedPending.team_member_id,
        startDate: dayStart,
        endDate: dayEnd,
        timezone: typedPending.timezone,
        duration: slotDuration,
      });

      const slotStillAvailable = availableSlots.some(
        (slot) => new Date(slot.startTime).getTime() === slotStart.getTime()
      );

      if (!slotStillAvailable) {
        // Revert status so user can rebook a different time
        await supabase
          .from('pending_bookings')
          .update({ status: 'pending', confirmed_at: null })
          .eq('id', typedPending.id);

        return {
          success: false,
          error: 'This time slot is no longer available. Please book a different time.',
        };
      }
    } catch (availError) {
      // If availability check fails, proceed anyway — better to attempt the booking
      // than to block it due to a transient availability API error
      console.warn('Availability re-validation failed, proceeding with booking:', availError);
    }

    // Create the actual booking on the calendar
    const bookingRequest: BookingRequest = {
      serviceId: typedPending.service_id,
      teamMemberId: typedPending.team_member_id,
      startTime: typedPending.start_time,
      guestName: typedPending.guest_name,
      guestEmail: typedPending.guest_email,
      guestPhone: typedPending.guest_phone,
      notes: typedPending.notes,
      timezone: typedPending.timezone,
      durationOverride: typedPending.duration_override ?? undefined,
      meetingType: (typedPending.meeting_type as BookingRequest['meetingType']) ?? undefined,
    };

    // Retry up to 2 additional times for transient errors (5xx, timeout, network)
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const booking = await createBooking(bookingRequest);
        return { success: true, booking };
      } catch (err) {
        lastError = err;
        const isTransient =
          err instanceof Error &&
          (/5\d{2}/.test(err.message) ||
            /timeout/i.test(err.message) ||
            /network/i.test(err.message) ||
            /ECONNRESET/i.test(err.message) ||
            /ETIMEDOUT/i.test(err.message));
        if (!isTransient || attempt === 2) break;
        console.warn(`createBooking attempt ${attempt + 1} failed (transient), retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // All attempts failed — throw to trigger revert
    throw lastError;
  } catch (error) {
    // Calendar event creation failed — revert status back to pending
    const { error: revertError } = await supabase
      .from('pending_bookings')
      .update({ status: 'pending', confirmed_at: null })
      .eq('id', typedPending.id);

    if (revertError) {
      console.error(
        `CRITICAL: Failed to revert booking to pending. Booking ID: ${typedPending.id}, Token: ${typedPending.token}. Revert error:`,
        revertError
      );
    }

    console.error('Error confirming booking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create calendar event',
    };
  }
}

/**
 * Cancel a pending booking
 */
export async function cancelPendingBooking(token: string): Promise<boolean> {
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('pending_bookings')
    .update({ status: 'cancelled' })
    .eq('token', token)
    .eq('status', 'pending');

  return !error;
}

/**
 * Clean up expired pending bookings (can be run periodically)
 */
export async function cleanupExpiredBookings(): Promise<number> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('pending_bookings')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Error cleaning up expired bookings:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Check if an email has too many pending bookings (anti-spam)
 */
export async function hasReachedPendingLimit(email: string, limit = 6): Promise<boolean> {
  const supabase = getServerSupabase();

  const { count, error } = await supabase
    .from('pending_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('guest_email', email.toLowerCase())
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error checking pending limit:', error);
    return false;
  }

  return (count || 0) >= limit;
}

/**
 * Get all pending bookings for a team member within a time range
 * Used to block time slots that have tentative (unconfirmed) bookings
 */
export async function getPendingBookingsForTimeRange(
  teamMemberId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ startTime: Date; endTime: Date; durationOverride?: number }>> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('pending_bookings')
    .select('start_time, duration_override, service_id')
    .eq('team_member_id', teamMemberId)
    .eq('status', 'pending')
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .gt('expires_at', new Date().toISOString()); // Only include non-expired pending bookings

  if (error) {
    console.error('Error getting pending bookings:', error);
    return [];
  }

  return (data || []).map((booking) => {
    const service = getServiceById(booking.service_id);
    const duration = booking.duration_override || service?.duration || 30;
    return {
      startTime: new Date(booking.start_time),
      endTime: new Date(
        new Date(booking.start_time).getTime() + duration * 60 * 1000
      ),
      durationOverride: booking.duration_override,
    };
  });
}

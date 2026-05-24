/**
 * Nylas API Client
 * Server-side client for interacting with Nylas v3 API
 */

import Nylas from 'nylas';
import type {
  TimeSlot,
  AvailabilityRequest,
  BookingRequest,
  BookingConfirmation,
  NylasEvent,
  TeamMember,
  Service,
} from './types';
import {
  getServiceById,
  getTeamMemberById,
  getTeamMembersByService,
  schedulingConfig,
} from './config';
import { enrichTeamMember, enrichTeamMembers } from './grants';
import { timingSafeCompare } from '@/lib/crypto-utils';
import { escapeHtml } from '@/lib/email';

// ============================================================================
// Environment Variables
// ============================================================================

const NYLAS_API_KEY = import.meta.env.NYLAS_API_KEY;
const NYLAS_API_URI = import.meta.env.NYLAS_API_URI || 'https://api.us.nylas.com';
const NYLAS_CLIENT_ID = import.meta.env.NYLAS_CLIENT_ID;

// ============================================================================
// Client Initialization
// ============================================================================

let nylasClient: Nylas | null = null;

/**
 * Get the initialized Nylas client
 * Lazy initialization to avoid errors when env vars are not set
 */
export function getNylasClient(): Nylas {
  if (!nylasClient) {
    if (!NYLAS_API_KEY) {
      throw new Error('NYLAS_API_KEY environment variable is not set');
    }

    nylasClient = new Nylas({
      apiKey: NYLAS_API_KEY,
      apiUri: NYLAS_API_URI,
    });
  }

  return nylasClient;
}

/**
 * Check if Nylas is configured (has required env vars)
 */
export function isNylasConfigured(): boolean {
  return Boolean(NYLAS_API_KEY && NYLAS_CLIENT_ID);
}

// ============================================================================
// OAuth Functions
// ============================================================================

/**
 * Generate an HMAC-signed OAuth state parameter to prevent CSRF attacks.
 * State format: `payload:timestamp:hmac`
 */
export async function generateOAuthState(payload: string): Promise<string> {
  const secret = NYLAS_API_KEY;
  if (!secret) throw new Error('NYLAS_API_KEY required for OAuth state signing');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${payload}:${timestamp}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hmac = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${payload}:${timestamp}:${hmac}`;
}

/**
 * Verify and extract the payload from an HMAC-signed OAuth state.
 * Returns the original payload (e.g. teamMemberId or 'connect'), or null if invalid.
 * States older than 1 hour are rejected.
 */
export async function verifyOAuthState(state: string): Promise<string | null> {
  const secret = NYLAS_API_KEY;
  if (!secret) return null;

  const parts = state.split(':');
  if (parts.length < 3) return null;

  const hmac = parts.pop()!;
  const timestamp = parts.pop()!;
  const payload = parts.join(':');

  // Reject states older than 1 hour
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 3600) return null;

  const message = `${payload}:${timestamp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!timingSafeCompare(hmac, expected)) return null;

  return payload;
}

/**
 * Generate OAuth URL for a team member to connect their calendar.
 * Uses the Nylas SDK's built-in URL builder for correct parameter formatting.
 */
export async function getAuthUrl(teamMemberId: string, redirectUri: string): Promise<string> {
  if (!NYLAS_CLIENT_ID) {
    throw new Error('NYLAS_CLIENT_ID environment variable is not set');
  }

  const teamMember = getTeamMemberById(teamMemberId);
  if (!teamMember) {
    throw new Error(`Team member not found: ${teamMemberId}`);
  }

  const state = await generateOAuthState(teamMemberId);
  const nylas = getNylasClient();
  return nylas.auth.urlForOAuth2({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    state,
  });
}

/**
 * Generate OAuth URL without pre-selecting a team member.
 * The callback will match the signed-in email to a team member.
 */
export async function getConnectAuthUrl(redirectUri: string): Promise<string> {
  if (!NYLAS_CLIENT_ID) {
    throw new Error('NYLAS_CLIENT_ID environment variable is not set');
  }

  const state = await generateOAuthState('connect');
  const nylas = getNylasClient();
  return nylas.auth.urlForOAuth2({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    state,
  });
}

/**
 * Exchange OAuth code for a grant
 */
export async function exchangeCodeForGrant(
  code: string,
  redirectUri: string
): Promise<{ grantId: string; email: string; provider: 'google' | 'microsoft' }> {
  const nylas = getNylasClient();

  const response = await nylas.auth.exchangeCodeForToken({
    clientId: NYLAS_CLIENT_ID!,
    clientSecret: NYLAS_API_KEY!,
    redirectUri,
    code,
  });

  // Nylas returns the provider in the token exchange response
  const provider = (response as { provider?: string }).provider === 'google'
    ? ('google' as const)
    : ('microsoft' as const);

  return {
    grantId: response.grantId,
    email: response.email,
    provider,
  };
}

// ============================================================================
// Availability Functions
// ============================================================================

/**
 * Get all grant IDs for a team member (supports multiple calendars)
 */
function getTeamMemberGrantIds(member: TeamMember): string[] {
  const grantIds: string[] = [];

  // Add primary grant ID if set
  if (member.nylasGrantId) {
    grantIds.push(member.nylasGrantId);
  }

  // Add all grants from nylasGrants array
  if (member.nylasGrants && member.nylasGrants.length > 0) {
    for (const grant of member.nylasGrants) {
      if (!grantIds.includes(grant.grantId)) {
        grantIds.push(grant.grantId);
      }
    }
  }

  return grantIds;
}

/**
 * Get the primary grant info for a team member (for creating events)
 */
function getPrimaryGrant(member: TeamMember): { grantId: string; provider?: string; email?: string } | undefined {
  // Check nylasGrants for one marked as primary
  if (member.nylasGrants && member.nylasGrants.length > 0) {
    const primary = member.nylasGrants.find((g) => g.isPrimary);
    if (primary) return primary;
    // If none marked primary, use the first one
    return member.nylasGrants[0];
  }

  // Fall back to nylasGrantId
  if (member.nylasGrantId) {
    return { grantId: member.nylasGrantId };
  }

  return undefined;
}

/**
 * Get the primary grant ID for a team member (for creating events)
 */
function getPrimaryGrantId(member: TeamMember): string | undefined {
  return getPrimaryGrant(member)?.grantId;
}

/**
 * Get the calendar ID for a team member
 * For Microsoft 365, we use 'primary' keyword which resolves to the default calendar
 */
function getCalendarId(member: TeamMember): string {
  const grant = getPrimaryGrant(member);

  // For Microsoft providers, 'primary' should work, but if not, try email
  // The calendar ID 'primary' is a Nylas convention that works across providers
  if (member.calendars.primary && member.calendars.primary !== '') {
    return member.calendars.primary;
  }

  // Fallback to 'primary' keyword for the default calendar
  return 'primary';
}

/**
 * Get available time slots for a service
 * Checks ALL connected calendars (Google + Microsoft) for conflicts
 */
export async function getAvailability(request: AvailabilityRequest): Promise<TimeSlot[]> {
  const nylas = getNylasClient();
  const service = getServiceById(request.serviceId);

  if (!service) {
    throw new Error(`Service not found: ${request.serviceId}`);
  }

  // Determine which team members to check
  let teamMembersToCheck: TeamMember[];

  if (request.teamMemberId) {
    const rawMember = getTeamMemberById(request.teamMemberId);
    if (!rawMember) {
      throw new Error(`Team member not found: ${request.teamMemberId}`);
    }
    const member = await enrichTeamMember(rawMember);
    const grantIds = getTeamMemberGrantIds(member);
    if (grantIds.length === 0) {
      throw new Error(`Team member ${member.name} has not connected their calendar`);
    }
    teamMembersToCheck = [member];
  } else {
    // Get all team members who offer this service and have connected calendars
    const rawMembers = getTeamMembersByService(request.serviceId);
    const enrichedMembers = await enrichTeamMembers(rawMembers);
    teamMembersToCheck = enrichedMembers.filter(
      (member) => getTeamMemberGrantIds(member).length > 0
    );
  }

  if (teamMembersToCheck.length === 0) {
    if (import.meta.env.DEV) {
      return generateMockAvailability(request);
    }
    throw new Error('No team members available for this service');
  }

  // Shuffle team members for round-robin so no single person is consistently
  // favored when deduplicating overlapping time slots
  if (service.roundRobin && !request.teamMemberId && teamMembersToCheck.length > 1) {
    for (let i = teamMembersToCheck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamMembersToCheck[i], teamMembersToCheck[j]] = [teamMembersToCheck[j], teamMembersToCheck[i]];
    }
  }

  // Use requested duration if provided, otherwise fall back to service config
  const durationMinutes = request.duration ?? service.duration;

  const allSlots: TimeSlot[] = [];
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);

  // Get availability for each team member (checking ALL their calendars)
  for (const member of teamMembersToCheck) {
    try {
      const grantIds = getTeamMemberGrantIds(member);
      const primaryGrantId = grantIds[0];

      // Nylas v3 Availability API requires participants (emails)
      // Build open hours from member's availability rules
      const openHours = member.availability?.rules.map((rule) => ({
        days: [rule.dayOfWeek],
        timezone: member.availability?.timezone || schedulingConfig.defaultTimezone,
        start: rule.startTime,
        end: rule.endTime,
        exdates: [] as string[], // Required by Nylas SDK types
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const availability = await (nylas.calendars.getAvailability as any)({
        identifier: primaryGrantId,
        requestBody: {
          startTime: Math.floor(startDate.getTime() / 1000),
          endTime: Math.floor(endDate.getTime() / 1000),
          durationMinutes,
          intervalMinutes: schedulingConfig.slotInterval,
          participants: [
            {
              email: member.email,
              // Only include openHours if available
              ...(openHours && openHours.length > 0 && { openHours }),
            },
          ],
        },
      });

      // Convert Nylas availability to our TimeSlot format
      if (availability.data?.timeSlots) {
        for (const slot of availability.data.timeSlots) {
          const startTimestamp = slot.startTime as unknown as number;
          const endTimestamp = slot.endTime as unknown as number;
          allSlots.push({
            startTime: new Date(startTimestamp * 1000).toISOString(),
            endTime: new Date(endTimestamp * 1000).toISOString(),
            teamMemberId: member.id,
            available: true,
          });
        }
      }
    } catch (error) {
      console.error(`Error getting availability for ${member.name}:`, error);
      // Continue with other team members
    }
  }

  // Sort slots by start time
  allSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // For round-robin, deduplicate overlapping slots (keep first available team member)
  if (service.roundRobin && !request.teamMemberId) {
    return deduplicateSlots(allSlots, schedulingConfig.slotInterval);
  }

  return allSlots;
}

/**
 * Remove duplicate time slots (for round-robin scheduling)
 */
function deduplicateSlots(slots: TimeSlot[], intervalMinutes: number): TimeSlot[] {
  const seen = new Map<string, TimeSlot>();

  for (const slot of slots) {
    // Round to interval to group similar slots
    const roundedStart = roundToInterval(new Date(slot.startTime), intervalMinutes);
    const key = roundedStart.toISOString();

    if (!seen.has(key)) {
      seen.set(key, slot);
    }
  }

  return Array.from(seen.values());
}

/**
 * Round a date to the nearest interval
 */
function roundToInterval(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

// ============================================================================
// Booking Functions
// ============================================================================

/**
 * Create a booking
 */
export async function createBooking(request: BookingRequest): Promise<BookingConfirmation> {
  const nylas = getNylasClient();
  const service = getServiceById(request.serviceId);

  if (!service) {
    throw new Error(`Service not found: ${request.serviceId}`);
  }

  // Determine which team member to book with
  let teamMember: TeamMember | undefined;

  if (request.teamMemberId) {
    const rawMember = getTeamMemberById(request.teamMemberId);
    teamMember = rawMember ? await enrichTeamMember(rawMember) : undefined;
  } else if (service.roundRobin) {
    // For round-robin, get the team member from the selected slot
    // This should have been determined during availability selection
    throw new Error('Team member ID is required for booking');
  } else {
    // For non-round-robin services with a single team member
    const rawMembers = getTeamMembersByService(request.serviceId);
    const enrichedMembers = await enrichTeamMembers(rawMembers);
    const eligibleMembers = enrichedMembers.filter(
      (m) => getTeamMemberGrantIds(m).length > 0
    );
    if (eligibleMembers.length === 1) {
      teamMember = eligibleMembers[0];
    }
  }

  if (!teamMember) {
    throw new Error('Could not determine team member for booking');
  }

  const primaryGrantId = getPrimaryGrantId(teamMember);
  if (!primaryGrantId) {
    throw new Error(`Team member ${teamMember.name} has not connected their calendar`);
  }

  const startTime = new Date(request.startTime);
  // Use duration override if provided (for profile pages), otherwise use service default
  const duration = request.durationOverride ?? service.duration;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  // Determine if we should add video conferencing based on meeting type
  // 'phone' = no conferencing, just include phone number in description
  // 'teams'/'zoom'/'meet' = add appropriate video conferencing
  const shouldAddConferencing =
    request.meetingType !== 'phone' && schedulingConfig.autoAddConferencing;

  // Map meeting type to Nylas conferencing provider
  const getConferencingProvider = (meetingType?: string) => {
    switch (meetingType) {
      case 'zoom':
        return 'Zoom Meeting' as const;
      case 'meet':
        return 'Google Meet' as const;
      case 'teams':
      default:
        return 'Microsoft Teams' as const;
    }
  };

  // Get the calendar ID (handles Microsoft vs Google differences)
  const calendarId = getCalendarId(teamMember);
  const grant = getPrimaryGrant(teamMember);

  // Create the calendar event on the primary calendar
  const eventRequest: Parameters<typeof nylas.events.create>[0] = {
    identifier: primaryGrantId,
    requestBody: {
      calendarId: calendarId,
      title: `${service.name} - ${request.guestName}`,
      description: buildEventDescription(service, request),
      when: {
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        startTimezone: request.timezone,
        endTimezone: request.timezone,
      },
      participants: [
        {
          email: request.guestEmail,
          name: request.guestName,
          // 'noreply' = hasn't responded yet, triggers calendar invite to be sent
          // Per Nylas docs: use 'noreply' when inviting external guests
          status: 'noreply' as const,
        },
        {
          email: teamMember.email,
          name: teamMember.name,
          status: 'yes' as const,
        },
      ],
      // Add video conferencing based on meeting type preference
      ...(shouldAddConferencing && {
        conferencing: {
          provider: getConferencingProvider(request.meetingType),
          autocreate: {},
        },
      }),
    },
    queryParams: {
      calendarId: calendarId,
      // Explicitly request that calendar invites be sent to participants
      // For Microsoft 365, this should trigger Outlook to send meeting invites
      notifyParticipants: true,
    },
  };

  const event = await nylas.events.create(eventRequest);

  // Build confirmation response
  const eventData = event.data as unknown as NylasEvent;
  return {
    id: event.data.id,
    service,
    teamMember,
    startTime,
    endTime,
    meetingLink: eventData.conferencing?.details?.url,
    calendarLinks: generateCalendarLinks({
      title: `${service.name} with ${teamMember.name}`,
      description: service.description,
      startTime,
      endTime,
      location: eventData.conferencing?.details?.url,
    }),
  };
}

/**
 * Build the event description (HTML formatted for proper display in calendar apps)
 */
function buildEventDescription(service: Service, request: BookingRequest): string {
  const lines: string[] = [];

  lines.push(escapeHtml(service.description));
  lines.push('');

  // If phone call selected, show call instructions prominently
  if (request.meetingType === 'phone' && request.guestPhone) {
    lines.push(`<b>📞 PHONE CALL</b>`);
    lines.push(`Call: ${escapeHtml(request.guestPhone)}`);
    lines.push('');
  }

  lines.push(`<b>Guest Details</b>`);
  lines.push(`Name: ${escapeHtml(request.guestName)}`);
  lines.push(`Email: ${escapeHtml(request.guestEmail)}`);

  if (request.guestPhone) {
    lines.push(`Phone: ${escapeHtml(request.guestPhone)}`);
  }

  if (request.notes) {
    lines.push('');
    lines.push(`<b>Notes</b>`);
    lines.push(escapeHtml(request.notes));
  }

  lines.push('');
  lines.push('---');
  lines.push('Booked via DSCRAuthority.com');

  // Join with <br> for HTML line breaks (works in Outlook/Google Calendar)
  return lines.join('<br>');
}

/**
 * Generate "Add to Calendar" links
 */
function generateCalendarLinks(event: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}): { google: string; outlook: string; ical: string } {
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${formatDate(event.startTime)}/${formatDate(event.endTime)}`,
    ...(event.location && { location: event.location }),
  });

  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    subject: event.title,
    body: event.description,
    startdt: event.startTime.toISOString(),
    enddt: event.endTime.toISOString(),
    ...(event.location && { location: event.location }),
  });

  // Generate iCal content
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(event.startTime)}`,
    `DTEND:${formatDate(event.endTime)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return {
    google: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
    ical: `data:text/calendar;charset=utf-8,${encodeURIComponent(icalContent)}`,
  };
}

// ============================================================================
// Event Management Functions
// ============================================================================

/**
 * Cancel a booking
 */
export async function cancelBooking(
  teamMemberId: string,
  eventId: string,
  notifyParticipants = true
): Promise<void> {
  const nylas = getNylasClient();
  const rawMember = getTeamMemberById(teamMemberId);

  if (!rawMember) {
    throw new Error('Team member not found');
  }

  const teamMember = await enrichTeamMember(rawMember);
  const primaryGrantId = getPrimaryGrantId(teamMember);
  if (!primaryGrantId) {
    throw new Error('Team member calendar not connected');
  }

  await nylas.events.destroy({
    identifier: primaryGrantId,
    eventId,
    queryParams: {
      calendarId: getCalendarId(teamMember),
      notifyParticipants,
    },
  });
}

/**
 * Get event details
 */
export async function getEvent(teamMemberId: string, eventId: string): Promise<NylasEvent | null> {
  const nylas = getNylasClient();
  const rawMember = getTeamMemberById(teamMemberId);

  if (!rawMember) {
    throw new Error('Team member not found');
  }

  const teamMember = await enrichTeamMember(rawMember);
  const primaryGrantId = getPrimaryGrantId(teamMember);
  if (!primaryGrantId) {
    throw new Error('Team member calendar not connected');
  }

  try {
    const event = await nylas.events.find({
      identifier: primaryGrantId,
      eventId,
      queryParams: {
        calendarId: getCalendarId(teamMember),
      },
    });

    return event.data as unknown as NylasEvent;
  } catch {
    return null;
  }
}

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
  const webhookSecret = import.meta.env.NYLAS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('NYLAS_WEBHOOK_SECRET not set — rejecting webhook for safety');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return timingSafeCompare(signature, expected);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}
/**
 * Generate mock availability for development testing
 */
function generateMockAvailability(request: AvailabilityRequest): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const service = getServiceById(request.serviceId);
  const duration = service?.duration || 30;

  // Generate 2 slots per day for work days
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dayStr = d.toISOString().split('T')[0];
    const times = ['09:00', '14:00'];

    for (const time of times) {
      const startTime = new Date(`${dayStr}T${time}:00.000Z`);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      slots.push({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        teamMemberId: 'scott',
        available: true,
      });
    }
  }

  return slots;
}

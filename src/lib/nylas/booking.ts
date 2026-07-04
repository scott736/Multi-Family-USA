import { randomBytes } from 'node:crypto';

import { SITE_SHORT_NAME, SITE_URL } from '@/consts';
import { fireCrmWebhook } from '@/lib/crm-webhook';
import { sendElasticEmail } from '@/lib/elastic-email';
import { leadOversightCc } from '@/lib/lead-inbox';
import { logger } from '@/lib/logger';
import { isSlotStillAvailable } from '@/lib/nylas/availability';
import { isNylasConfigured, nylasFetch } from '@/lib/nylas/client';
import { schedulingConfig, services } from '@/lib/nylas/config';
import { getGrantIdForTeamMember, getTeamMemberById } from '@/lib/nylas/grants';
import type { BookingConfirmation, MeetingType, Service, TeamMember } from '@/lib/nylas/types';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

const PENDING_EXPIRY_HOURS = 24;

export type PendingBookingStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';

export interface PendingBookingRecord {
  id: string;
  token: string;
  serviceId: string;
  teamMemberId: string;
  startTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  timezone: string;
  durationOverride?: number;
  meetingType?: MeetingType;
  status: PendingBookingStatus;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  nylasEventId?: string;
  meetingLink?: string;
}

interface PendingBookingRow {
  id: string;
  token: string;
  service_id: string;
  team_member_id: string;
  start_time: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  notes: string | null;
  timezone: string;
  duration_override: number | null;
  meeting_type: string | null;
  status: PendingBookingStatus;
  expires_at: string;
  created_at: string;
  confirmed_at: string | null;
  nylas_event_id?: string | null;
  meeting_link?: string | null;
}

interface CreatePendingBookingInput {
  serviceId: string;
  teamMemberId: string;
  startTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  timezone: string;
  meetingType?: MeetingType;
  durationOverride?: number;
  cancelToken?: string;
}

interface NylasEventResponse {
  data?: {
    id: string;
    conferencing?: {
      details?: {
        url?: string;
      };
    };
  };
}

function getSiteUrl(): string {
  return ((import.meta.env.SITE as string | undefined) || SITE_URL).replace(/\/$/, '');
}

function getServiceById(id: string): Service | undefined {
  return services.find((service) => service.id === id);
}

function mapRow(row: PendingBookingRow): PendingBookingRecord {
  return {
    id: row.id,
    token: row.token,
    serviceId: row.service_id,
    teamMemberId: row.team_member_id,
    startTime: row.start_time,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone ?? undefined,
    notes: row.notes ?? undefined,
    timezone: row.timezone,
    durationOverride: row.duration_override ?? undefined,
    meetingType: (row.meeting_type as MeetingType | null) ?? undefined,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined,
    nylasEventId: row.nylas_event_id ?? undefined,
    meetingLink: row.meeting_link ?? undefined,
  };
}

function effectiveStatus(record: PendingBookingRecord): PendingBookingStatus {
  if (record.status === 'pending' && new Date(record.expiresAt) < new Date()) {
    return 'expired';
  }
  return record.status;
}

function getDurationMinutes(record: PendingBookingRecord, service: Service): number {
  return record.durationOverride ?? service.duration;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatGoogleCalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildCalendarLinks(options: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  location?: string;
}): BookingConfirmation['calendarLinks'] {
  const { title, description, startTime, endTime, timezone, location } = options;
  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleCalendarDate(startTime)}/${formatGoogleCalendarDate(endTime)}`,
    details: description,
    ctz: timezone,
  });
  if (location) googleParams.set('location', location);

  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    body: description,
    startdt: startTime.toISOString(),
    enddt: endTime.toISOString(),
  });
  if (location) outlookParams.set('location', location);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Multi-Family USA//Scheduling//EN',
    'BEGIN:VEVENT',
    `UID:${randomBytes(8).toString('hex')}@multifamily-usa.com`,
    `DTSTAMP:${formatGoogleCalendarDate(new Date())}`,
    `DTSTART:${formatGoogleCalendarDate(startTime)}`,
    `DTEND:${formatGoogleCalendarDate(endTime)}`,
    `SUMMARY:${title.replace(/[,;\\]/g, '')}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n').replace(/[,;\\]/g, '')}`,
    location ? `LOCATION:${location.replace(/[,;\\]/g, '')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const icsContent = icsLines.join('\r\n');
  const ical = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  return {
    google: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
    ical,
  };
}

async function countRecentPendingByEmail(email: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getServerSupabase();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('pending_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('guest_email', email.toLowerCase())
    .eq('status', 'pending')
    .gte('created_at', since);

  if (error) {
    logger.error('Failed to count recent pending bookings', error);
    return 0;
  }
  return count ?? 0;
}

export async function getPendingBookingByToken(token: string): Promise<PendingBookingRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pending_bookings')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load pending booking', error);
    throw new Error('Failed to load booking');
  }
  if (!data) return null;
  return mapRow(data as PendingBookingRow);
}

export async function createPendingBooking(
  input: CreatePendingBookingInput,
): Promise<{ token: string; email: string; expiresAt: string; startTime: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Booking storage is not configured');
  }

  const service = getServiceById(input.serviceId);
  const teamMember = getTeamMemberById(input.teamMemberId);
  if (!service || !teamMember) {
    throw new Error('Invalid service or team member');
  }
  if (!service.teamMembers.includes(teamMember.id)) {
    throw new Error('Team member cannot offer this service');
  }

  const durationMinutes = input.durationOverride ?? service.duration;
  const slotAvailable = await isSlotStillAvailable(
    input.serviceId,
    input.teamMemberId,
    input.startTime,
    durationMinutes,
    input.timezone,
  );
  if (!slotAvailable) {
    throw new Error('That time is no longer available. Please choose another slot.');
  }

  const recentCount = await countRecentPendingByEmail(input.guestEmail);
  if (recentCount >= 3) {
    throw new Error('Too many booking attempts. Please wait a few minutes and try again.');
  }

  if (input.cancelToken) {
    await cancelBookingByToken(input.cancelToken, 'Rescheduled by guest');
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PENDING_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  const supabase = getServerSupabase();

  const { error } = await supabase.from('pending_bookings').insert({
    token,
    service_id: input.serviceId,
    team_member_id: input.teamMemberId,
    start_time: input.startTime,
    guest_name: input.guestName,
    guest_email: input.guestEmail.toLowerCase(),
    guest_phone: input.guestPhone ?? null,
    notes: input.notes ?? null,
    timezone: input.timezone,
    duration_override: input.durationOverride ?? null,
    meeting_type: input.meetingType ?? null,
    status: 'pending',
    expires_at: expiresAt,
  });

  if (error) {
    logger.error('Failed to create pending booking', error);
    throw new Error('Failed to create booking');
  }

  await sendBookingConfirmationEmail({
    token,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    service,
    teamMember,
    startTime: input.startTime,
    timezone: input.timezone,
    durationMinutes,
    expiresAt,
  });

  return {
    token,
    email: input.guestEmail,
    expiresAt,
    startTime: input.startTime,
  };
}

async function sendBookingConfirmationEmail(options: {
  token: string;
  guestName: string;
  guestEmail: string;
  service: Service;
  teamMember: TeamMember;
  startTime: string;
  timezone: string;
  durationMinutes: number;
  expiresAt: string;
}) {
  const confirmUrl = `${getSiteUrl()}/booking/confirm?token=${encodeURIComponent(options.token)}`;
  const start = new Date(options.startTime);
  const formattedStart = start.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timezone,
  });

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">Confirm your ${escapeHtml(options.service.name)}</h2>
  <p style="font-size:15px;line-height:1.6;">
    Hi ${escapeHtml(options.guestName.split(' ')[0])}, please confirm your appointment with
    ${escapeHtml(options.teamMember.name)}.
  </p>
  <p style="font-size:15px;line-height:1.6;"><strong>${escapeHtml(formattedStart)}</strong> (${options.durationMinutes} minutes)</p>
  <p style="margin:24px 0;">
    <a href="${confirmUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
      Confirm appointment
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280;">This link expires in ${PENDING_EXPIRY_HOURS} hours.</p>
  <p style="margin-top:32px;font-size:13px;color:#6b7280;">- The ${SITE_SHORT_NAME} team</p>
</body>
</html>`;

  const text = `Confirm your ${options.service.name}

Hi ${options.guestName.split(' ')[0]}, please confirm your appointment with ${options.teamMember.name}.

When: ${formattedStart} (${options.durationMinutes} minutes)

Confirm here: ${confirmUrl}

This link expires in ${PENDING_EXPIRY_HOURS} hours.`;

  await sendElasticEmail({
    to: options.guestEmail,
    replyTo: options.teamMember.email,
    subject: `Confirm your ${options.service.name} - ${SITE_SHORT_NAME}`,
    html,
    text,
  });
}

function buildEventDescription(
  record: PendingBookingRecord,
  service: Service,
  teamMember: TeamMember,
): string {
  const lines = [
    `${service.name} with ${teamMember.name}`,
    `Guest: ${record.guestName} (${record.guestEmail})`,
  ];
  if (record.guestPhone) lines.push(`Phone: ${record.guestPhone}`);
  if (record.notes) lines.push(`Notes: ${record.notes}`);
  if (record.meetingType === 'phone') lines.push('Meeting format: Phone call');
  return lines.join('\n');
}

function conferencingPayload(meetingType?: MeetingType) {
  if (!schedulingConfig.autoAddConferencing || meetingType === 'phone') return undefined;

  const providerMap: Record<string, string> = {
    teams: 'Microsoft Teams',
    zoom: 'Zoom Meeting',
    meet: 'Google Meet',
  };
  const provider =
    (meetingType && providerMap[meetingType]) || schedulingConfig.conferencingProvider;

  return {
    provider,
    autocreate: {},
  };
}

async function createNylasEvent(
  record: PendingBookingRecord,
  service: Service,
  teamMember: TeamMember,
  durationMinutes: number,
): Promise<{ eventId?: string; meetingLink?: string }> {
  const grantId = getGrantIdForTeamMember(teamMember.id);
  if (!grantId || !isNylasConfigured()) {
    return {};
  }

  const start = new Date(record.startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const calendarId = teamMember.calendars.primary || 'primary';
  const conferencing = conferencingPayload(record.meetingType);

  const payload: Record<string, unknown> = {
    title: `${service.name} - ${record.guestName}`,
    description: buildEventDescription(record, service, teamMember),
    when: {
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
      start_timezone: record.timezone,
      end_timezone: record.timezone,
    },
    participants: [
      { email: teamMember.email, name: teamMember.name, status: 'yes' },
      { email: record.guestEmail, name: record.guestName, status: 'yes' },
    ],
  };
  if (conferencing) payload.conferencing = conferencing;

  const query = calendarId ? `?calendar_id=${encodeURIComponent(calendarId)}` : '';
  const response = await nylasFetch<NylasEventResponse>(
    `/v3/grants/${grantId}/events${query}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return {
    eventId: response.data?.id,
    meetingLink: response.data?.conferencing?.details?.url,
  };
}

async function deleteNylasEvent(teamMemberId: string, eventId: string): Promise<void> {
  const grantId = getGrantIdForTeamMember(teamMemberId);
  if (!grantId || !isNylasConfigured()) return;

  try {
    await nylasFetch(`/v3/grants/${grantId}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    logger.error('Failed to delete Nylas event', err);
  }
}

async function updateNylasEvent(
  record: PendingBookingRecord,
  service: Service,
  teamMember: TeamMember,
  durationMinutes: number,
  newStartIso: string,
): Promise<{ meetingLink?: string }> {
  if (!record.nylasEventId) {
    const created = await createNylasEvent(record, service, teamMember, durationMinutes);
    return { meetingLink: created.meetingLink };
  }

  const grantId = getGrantIdForTeamMember(teamMember.id);
  if (!grantId || !isNylasConfigured()) return {};

  const start = new Date(newStartIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const response = await nylasFetch<NylasEventResponse>(
    `/v3/grants/${grantId}/events/${encodeURIComponent(record.nylasEventId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        when: {
          start_time: Math.floor(start.getTime() / 1000),
          end_time: Math.floor(end.getTime() / 1000),
          start_timezone: record.timezone,
          end_timezone: record.timezone,
        },
      }),
    },
  );

  return { meetingLink: response.data?.conferencing?.details?.url ?? record.meetingLink };
}

export function toPendingBookingView(record: PendingBookingRecord) {
  const service = getServiceById(record.serviceId);
  const teamMember = getTeamMemberById(record.teamMemberId);
  const status = effectiveStatus(record);

  return {
    status,
    service: service
      ? { name: service.name, duration: record.durationOverride ?? service.duration }
      : null,
    teamMember: teamMember
      ? { name: teamMember.name, email: teamMember.email, photo: teamMember.photo }
      : null,
    startTime: record.startTime,
    guestName: record.guestName,
    guestEmail: record.guestEmail,
    timezone: record.timezone,
    expiresAt: record.expiresAt,
    confirmedAt: record.confirmedAt,
    serviceId: record.serviceId,
    teamMemberId: record.teamMemberId,
  };
}

export async function confirmPendingBooking(token: string): Promise<BookingConfirmation & { id: string }> {
  const record = await getPendingBookingByToken(token);
  if (!record) throw new Error('Booking not found');
  if (effectiveStatus(record) === 'expired') throw new Error('This confirmation link has expired');
  if (record.status === 'cancelled') throw new Error('This booking was cancelled');
  if (record.status === 'confirmed') throw new Error('This booking is already confirmed');

  const service = getServiceById(record.serviceId);
  const teamMember = getTeamMemberById(record.teamMemberId);
  if (!service || !teamMember) throw new Error('Booking configuration is invalid');

  const durationMinutes = getDurationMinutes(record, service);
  const slotAvailable = await isSlotStillAvailable(
    record.serviceId,
    record.teamMemberId,
    record.startTime,
    durationMinutes,
    record.timezone,
  );
  if (!slotAvailable) {
    throw new Error('That time is no longer available. Please book a new appointment.');
  }

  const { eventId, meetingLink } = await createNylasEvent(record, service, teamMember, durationMinutes);
  const confirmedAt = new Date().toISOString();
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('pending_bookings')
    .update({
      status: 'confirmed',
      confirmed_at: confirmedAt,
      nylas_event_id: eventId ?? null,
      meeting_link: meetingLink ?? null,
    })
    .eq('token', token)
    .eq('status', 'pending');

  if (error) {
    logger.error('Failed to confirm booking', error);
    throw new Error('Failed to confirm booking');
  }

  const startTime = new Date(record.startTime);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const calendarLinks = buildCalendarLinks({
    title: `${service.name} - ${teamMember.name}`,
    description: buildEventDescription(record, service, teamMember),
    startTime,
    endTime,
    timezone: record.timezone,
    location: meetingLink,
  });

  await Promise.all([
    sendElasticEmail({
      to: teamMember.email,
      cc: leadOversightCc(teamMember.email),
      replyTo: record.guestEmail,
      subject: `[Confirmed] ${record.guestName} - ${service.name}`,
      html: `<p>${escapeHtml(record.guestName)} confirmed a ${escapeHtml(service.name)} on ${escapeHtml(startTime.toLocaleString('en-US', { timeZone: record.timezone }))}.</p>`,
      text: `${record.guestName} confirmed a ${service.name} on ${startTime.toLocaleString('en-US', { timeZone: record.timezone })}.`,
    }),
    sendElasticEmail({
      to: record.guestEmail,
      replyTo: teamMember.email,
      subject: `Your ${service.name} is confirmed - ${SITE_SHORT_NAME}`,
      html: `<p>Your appointment with ${escapeHtml(teamMember.name)} is confirmed for ${escapeHtml(startTime.toLocaleString('en-US', { timeZone: record.timezone }))}.</p>`,
      text: `Your appointment with ${teamMember.name} is confirmed for ${startTime.toLocaleString('en-US', { timeZone: record.timezone })}.`,
    }),
  ]);

  void fireCrmWebhook({
    event: 'booking_confirmed',
    name: record.guestName,
    email: record.guestEmail,
    phone: record.guestPhone,
    source: '/booking',
    serviceName: service.name,
    startTime: startTime.toLocaleString('en-US', { timeZone: record.timezone }),
    toolName: teamMember.name,
    metadata: {
      'Team member': teamMember.name,
      Duration: `${durationMinutes} minutes`,
      Timezone: record.timezone,
      ...(record.meetingType ? { 'Meeting type': record.meetingType } : {}),
      ...(meetingLink ? { 'Meeting link': meetingLink } : {}),
      ...(record.notes ? { Notes: record.notes } : {}),
    },
  });

  return {
    id: record.id,
    service,
    teamMember,
    startTime,
    endTime,
    meetingLink,
    calendarLinks,
  };
}

export async function cancelBookingByToken(token: string, reason?: string): Promise<void> {
  const record = await getPendingBookingByToken(token);
  if (!record) throw new Error('Booking not found');

  const status = effectiveStatus(record);
  if (status === 'cancelled') return;
  if (status === 'confirmed' && record.nylasEventId) {
    await deleteNylasEvent(record.teamMemberId, record.nylasEventId);
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('pending_bookings')
    .update({
      status: 'cancelled',
      notes: reason ? [record.notes, `Cancellation reason: ${reason}`].filter(Boolean).join('\n') : record.notes,
    })
    .eq('token', token);

  if (error) {
    logger.error('Failed to cancel booking', error);
    throw new Error('Failed to cancel booking');
  }

  if (status === 'confirmed') {
    const service = getServiceById(record.serviceId);
    const teamMember = getTeamMemberById(record.teamMemberId);
    if (teamMember) {
      await sendElasticEmail({
        to: teamMember.email,
        cc: leadOversightCc(teamMember.email),
        subject: `[Cancelled] ${record.guestName}${service ? ` - ${service.name}` : ''}`,
        html: `<p>${escapeHtml(record.guestName)} cancelled their appointment.${reason ? ` Reason: ${escapeHtml(reason)}` : ''}</p>`,
        text: `${record.guestName} cancelled their appointment.${reason ? ` Reason: ${reason}` : ''}`,
      });
    }
  }
}

export async function rescheduleBookingByToken(
  token: string,
  newStartTime: string,
  timezone: string,
): Promise<{
  startTime: string;
  endTime: string;
  meetingLink?: string;
  calendarLinks: BookingConfirmation['calendarLinks'];
}> {
  const record = await getPendingBookingByToken(token);
  if (!record) throw new Error('Booking not found');
  if (effectiveStatus(record) !== 'confirmed') {
    throw new Error('Only confirmed appointments can be rescheduled');
  }

  const service = getServiceById(record.serviceId);
  const teamMember = getTeamMemberById(record.teamMemberId);
  if (!service || !teamMember) throw new Error('Booking configuration is invalid');

  const durationMinutes = getDurationMinutes(record, service);
  const slotAvailable = await isSlotStillAvailable(
    record.serviceId,
    record.teamMemberId,
    newStartTime,
    durationMinutes,
    timezone,
  );
  if (!slotAvailable) {
    throw new Error('That time is no longer available. Please choose another slot.');
  }

  const { meetingLink } = await updateNylasEvent(
    record,
    service,
    teamMember,
    durationMinutes,
    newStartTime,
  );

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('pending_bookings')
    .update({
      start_time: newStartTime,
      timezone,
      meeting_link: meetingLink ?? record.meetingLink ?? null,
    })
    .eq('token', token);

  if (error) {
    logger.error('Failed to reschedule booking', error);
    throw new Error('Failed to reschedule booking');
  }

  const startTime = new Date(newStartTime);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const calendarLinks = buildCalendarLinks({
    title: `${service.name} - ${teamMember.name}`,
    description: buildEventDescription({ ...record, startTime: newStartTime, timezone }, service, teamMember),
    startTime,
    endTime,
    timezone,
    location: meetingLink ?? record.meetingLink,
  });

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    meetingLink: meetingLink ?? record.meetingLink,
    calendarLinks,
  };
}

export async function expireStalePendingBookings(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getServerSupabase();
  await supabase
    .from('pending_bookings')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());
}

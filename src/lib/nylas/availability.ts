import { isNylasConfigured, nylasFetch } from '@/lib/nylas/client';
import { schedulingConfig, services, teamMembers } from '@/lib/nylas/config';
import { getGrantIdForTeamMember } from '@/lib/nylas/grants';
import {
  enumerateDateKeys,
  getDateKeyInTimezone,
  getDayOfWeekInTimezone,
  zonedLocalToUtc,
} from '@/lib/nylas/timezone';
import type {
  AvailabilityRequest,
  AvailabilityRule,
  DayAvailability,
  Service,
  TeamMember,
  TimeSlot,
} from '@/lib/nylas/types';

interface NylasFreeBusyResponse {
  data?: Array<{
    email: string;
    time_slots?: Array<{
      start_time: number;
      end_time: number;
      status: 'busy' | 'free';
    }>;
  }>;
}

function getServiceById(id: string): Service | undefined {
  return services.find((service) => service.id === id);
}

function getEligibleMembers(service: Service, teamMemberId?: string): TeamMember[] {
  if (teamMemberId) {
    const member = teamMembers.find((m) => m.id === teamMemberId);
    if (!member || !service.teamMembers.includes(member.id)) return [];
    return [member];
  }
  return teamMembers.filter((member) => service.teamMembers.includes(member.id));
}

function getMemberAvailabilityRules(member: TeamMember): AvailabilityRule[] {
  if (member.availability?.rules?.length) {
    return member.availability.rules;
  }
  return [
    { dayOfWeek: 1, startTime: schedulingConfig.businessHours.start, endTime: schedulingConfig.businessHours.end },
    { dayOfWeek: 2, startTime: schedulingConfig.businessHours.start, endTime: schedulingConfig.businessHours.end },
    { dayOfWeek: 3, startTime: schedulingConfig.businessHours.start, endTime: schedulingConfig.businessHours.end },
    { dayOfWeek: 4, startTime: schedulingConfig.businessHours.start, endTime: schedulingConfig.businessHours.end },
    { dayOfWeek: 5, startTime: schedulingConfig.businessHours.start, endTime: schedulingConfig.businessHours.end },
  ];
}

function getMemberTimezone(member: TeamMember, fallback: string): string {
  return member.availability?.timezone ?? fallback;
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function overlaps(
  slotStartMs: number,
  slotEndMs: number,
  busyStartMs: number,
  busyEndMs: number,
): boolean {
  return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
}

async function fetchBusyIntervals(
  member: TeamMember,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Array<{ start: number; end: number }>> {
  const grantId = getGrantIdForTeamMember(member.id);
  if (!grantId || !isNylasConfigured()) return [];

  const body = {
    start_time: Math.floor(rangeStart.getTime() / 1000),
    end_time: Math.floor(rangeEnd.getTime() / 1000),
    emails: [member.email],
  };

  try {
    const response = await nylasFetch<NylasFreeBusyResponse>(
      `/v3/grants/${grantId}/calendars/free-busy`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    const intervals: Array<{ start: number; end: number }> = [];
    for (const entry of response.data ?? []) {
      for (const slot of entry.time_slots ?? []) {
        if (slot.status === 'busy') {
          intervals.push({
            start: slot.start_time * 1000,
            end: slot.end_time * 1000,
          });
        }
      }
    }
    return intervals;
  } catch {
    return [];
  }
}

function generateMemberSlotsForDay(
  member: TeamMember,
  dateStr: string,
  service: Service,
  durationMinutes: number,
  requestTimezone: string,
  busyIntervals: Array<{ start: number; end: number }>,
  now: Date,
): TimeSlot[] {
  const memberTz = getMemberTimezone(member, requestTimezone);
  const dayOfWeek = getDayOfWeekInTimezone(dateStr, memberTz) as AvailabilityRule['dayOfWeek'];
  const rules = getMemberAvailabilityRules(member).filter((rule) => rule.dayOfWeek === dayOfWeek);
  if (rules.length === 0) return [];

  const bufferBefore = service.bufferBefore ?? 0;
  const bufferAfter = service.bufferAfter ?? 0;
  const slotInterval = schedulingConfig.slotInterval;
  const minimumNoticeMs = schedulingConfig.minimumNotice * 60 * 60 * 1000;
  const maxAdvanceMs = schedulingConfig.maxAdvanceBooking * 24 * 60 * 60 * 1000;
  const slots: TimeSlot[] = [];

  for (const rule of rules) {
    const ruleStart = parseTimeToMinutes(rule.startTime);
    const ruleEnd = parseTimeToMinutes(rule.endTime);

    for (let minute = ruleStart; minute + durationMinutes <= ruleEnd; minute += slotInterval) {
      const hour = Math.floor(minute / 60);
      const min = minute % 60;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const start = zonedLocalToUtc(dateStr, timeStr, memberTz);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      if (start.getTime() < now.getTime() + minimumNoticeMs) continue;
      if (start.getTime() > now.getTime() + maxAdvanceMs) continue;

      const bufferedStart = start.getTime() - bufferBefore * 60 * 1000;
      const bufferedEnd = end.getTime() + bufferAfter * 60 * 1000;
      const isBusy = busyIntervals.some((interval) =>
        overlaps(bufferedStart, bufferedEnd, interval.start, interval.end),
      );

      slots.push({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        teamMemberId: member.id,
        available: !isBusy,
      });
    }
  }

  return slots.filter((slot) => slot.available);
}

export async function getAvailability(request: AvailabilityRequest): Promise<DayAvailability[]> {
  const service = getServiceById(request.serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  const durationMinutes = request.duration ?? service.duration;
  const members = getEligibleMembers(service, request.teamMemberId);
  if (members.length === 0) {
    throw new Error('No team members available for this service');
  }

  const dateKeys = enumerateDateKeys(request.startDate, request.endDate);
  const now = new Date();
  const rangeStart = zonedLocalToUtc(request.startDate, '00:00', request.timezone);
  const rangeEnd = zonedLocalToUtc(request.endDate, '23:59', request.timezone);

  const busyByMember = new Map<string, Array<{ start: number; end: number }>>();
  if (isNylasConfigured()) {
    await Promise.all(
      members.map(async (member) => {
        if (!getGrantIdForTeamMember(member.id)) return;
        const busy = await fetchBusyIntervals(member, rangeStart, rangeEnd);
        busyByMember.set(member.id, busy);
      }),
    );
  }

  return dateKeys.map((dateStr) => {
    const daySlots: TimeSlot[] = [];

    for (const member of members) {
      const busyIntervals = busyByMember.get(member.id) ?? [];
      daySlots.push(
        ...generateMemberSlotsForDay(
          member,
          dateStr,
          service,
          durationMinutes,
          request.timezone,
          busyIntervals,
          now,
        ),
      );
    }

    daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      date: dateStr,
      slots: daySlots,
      hasAvailability: daySlots.length > 0,
    };
  });
}

export function isSlotStillAvailable(
  serviceId: string,
  teamMemberId: string,
  startTimeIso: string,
  durationMinutes: number,
  timezone: string,
): Promise<boolean> {
  const startDate = getDateKeyInTimezone(new Date(startTimeIso), timezone);
  return getAvailability({
    serviceId,
    teamMemberId,
    startDate,
    endDate: startDate,
    timezone,
    duration: durationMinutes,
  }).then((days) => {
    const day = days.find((entry) => entry.date === startDate);
    if (!day) return false;
    return day.slots.some(
      (slot) => slot.startTime === startTimeIso && slot.teamMemberId === teamMemberId,
    );
  });
}

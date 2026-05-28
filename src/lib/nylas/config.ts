/**
 * Nylas Scheduling Configuration — Multi-Family USA
 * US-focused commercial multifamily advisory calls.
 */

import type { AvailabilityRule, Service, TeamMember } from "./types";

const DEFAULT_AVAILABILITY: AvailabilityRule[] = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
];

const DEFAULT_CALENDAR = { primary: "" };
const DEFAULT_TZ = { timezone: "America/New_York", rules: DEFAULT_AVAILABILITY };

export const teamMembers: TeamMember[] = [
  {
    id: "scott",
    name: "Scott Dillingham",
    email: "scott@lendcity.ca",
    slug: "scott-dillingham",
    title: "Multifamily Advisor",
    photo: "/images/team/chris-micucci.webp",
    bio: "Commercial multifamily advisor focused on execution planning and lender fit.",
    services: ["strategy-call"],
    calendars: DEFAULT_CALENDAR,
    availability: DEFAULT_TZ,
  },
  {
    id: "aya",
    name: "Aya Dillingham",
    email: "aya@lendcity.ca",
    slug: "aya-dillingham",
    title: "Client Success",
    photo: "/images/team/david-cardozo.webp",
    bio: "Intake and borrower support for multifamily financing workflows.",
    services: ["strategy-call"],
    calendars: DEFAULT_CALENDAR,
    availability: DEFAULT_TZ,
  },
];

export const services: Service[] = [
  {
    id: "strategy-call",
    name: "Free Multifamily Strategy Call",
    description:
      "A 30-minute call to review your 5+ unit scenario, underwriting constraints, and likely financing execution paths.",
    duration: 30,
    bufferBefore: 5,
    bufferAfter: 5,
    teamMembers: [],
    roundRobin: true,
    icon: "PhoneCall",
    category: "commercial",
    meetingTypes: ["phone", "teams"],
    region: "usa",
  },
];

const teamMemberIdsByService = new Map<string, string[]>();
for (const member of teamMembers) {
  if (member.personalOnly) continue;
  for (const serviceId of member.services) {
    const ids = teamMemberIdsByService.get(serviceId);
    if (ids) {
      ids.push(member.id);
    } else {
      teamMemberIdsByService.set(serviceId, [member.id]);
    }
  }
}

for (const service of services) {
  service.teamMembers = teamMemberIdsByService.get(service.id) ?? [];
}

function getTeamMemberById(id: string): TeamMember | undefined {
  return teamMembers.find((member) => member.id === id);
}

function getTeamMemberBySlug(slug: string): TeamMember | undefined {
  return teamMembers.find((member) => member.slug === slug);
}

function getTeamMemberByEmail(email: string): TeamMember | undefined {
  const normalizedEmail = email.toLowerCase();
  return teamMembers.find((member) => member.email.toLowerCase() === normalizedEmail);
}

function getServiceById(id: string): Service | undefined {
  return services.find((service) => service.id === id);
}

function getServicesByTeamMember(teamMemberId: string): Service[] {
  return services.filter((service) => service.teamMembers.includes(teamMemberId));
}

function getTeamMembersByService(serviceId: string): TeamMember[] {
  const service = getServiceById(serviceId);
  if (!service) return [];
  return teamMembers.filter((member) => service.teamMembers.includes(member.id));
}

function getServicesByCategory(
  category: "residential" | "commercial" | "investment" | "development",
): Service[] {
  return services.filter((service) => service.category === category);
}

function getActiveTeamMembers(): TeamMember[] {
  return teamMembers.filter(
    (member) => member.nylasGrantId || (member.nylasGrants && member.nylasGrants.length > 0),
  );
}

function canTeamMemberOfferService(teamMemberId: string, serviceId: string): boolean {
  const service = getServiceById(serviceId);
  if (!service) return false;
  return service.teamMembers.includes(teamMemberId);
}

const schedulingConfig = {
  minimumNotice: 3,
  maxAdvanceBooking: 60,
  defaultTimezone: "America/New_York",
  slotInterval: 15,
  businessHours: {
    start: "09:00",
    end: "17:00",
  },
  daysToShow: 14,
  autoAddConferencing: true,
  conferencingProvider: "Microsoft Teams" as const,
};

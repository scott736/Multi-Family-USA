/**
 * Nylas Scheduling System Types
 * TypeScript interfaces for the DSCR Authority scheduling integration.
 */

// ============================================================================
// Team Member Types
// ============================================================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  slug: string;
  title: string;
  photo?: string;
  bio?: string;
  // Nylas grants - support multiple calendar providers
  nylasGrantId?: string; // Primary grant (for backwards compatibility)
  nylasGrants?: NylasGrantConfig[]; // Multiple grants for multi-calendar sync
  services: string[]; // Service IDs they can handle
  personalOnly?: boolean; // If true, only appears on their personal booking page, not the main booking calendar
  calendars: {
    primary: string; // Calendar ID for availability & booking
    additional?: string[]; // Additional calendars to check for conflicts
  };
  availability?: AvailabilitySchedule;
}

export interface NylasGrantConfig {
  grantId: string;
  provider: 'google' | 'microsoft';
  email: string;
  isPrimary?: boolean; // Which calendar to create events on
}

export interface AvailabilitySchedule {
  timezone: string;
  rules: AvailabilityRule[];
}

export interface AvailabilityRule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm format (e.g., "09:00")
  endTime: string; // HH:mm format (e.g., "17:00")
}

// ============================================================================
// Service Types
// ============================================================================

export type MeetingType = 'phone' | 'teams' | 'zoom' | 'meet';

export type ServiceRegion = 'usa';

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  bufferBefore?: number; // minutes before meeting
  bufferAfter?: number; // minutes after meeting
  teamMembers: string[]; // Team member IDs who offer this
  roundRobin: boolean; // If true, auto-assign based on availability
  color?: string; // For calendar display
  icon?: string; // Lucide icon name
  category?: 'residential' | 'commercial' | 'investment' | 'development';
  meetingTypes?: MeetingType[]; // Available meeting formats (phone, teams, etc.)
  region?: ServiceRegion; // Which country/region this service is for
}

// ============================================================================
// Booking Types
// ============================================================================

export interface Booking {
  id: string;
  serviceId: string;
  teamMemberId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
  status: BookingStatus;
  nylasEventId: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';

export interface BookingRequest {
  serviceId: string;
  teamMemberId?: string; // Optional for round-robin services
  startTime: string; // ISO string
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  timezone: string;
  durationOverride?: number; // Override service duration (for profile pages)
  meetingType?: MeetingType; // Preferred meeting format
}

export interface BookingConfirmation {
  id: string;
  service: Service;
  teamMember: TeamMember;
  startTime: Date;
  endTime: Date;
  meetingLink?: string;
  calendarLinks: {
    google: string;
    outlook: string;
    ical: string;
  };
}

// ============================================================================
// Availability Types
// ============================================================================

export interface TimeSlot {
  startTime: string; // ISO string
  endTime: string; // ISO string
  teamMemberId: string;
  available: boolean;
}

export interface AvailabilityRequest {
  serviceId: string;
  teamMemberId?: string; // Optional - if not provided, checks all eligible team members
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone: string;
  duration?: number; // Override duration in minutes (e.g., from profile pages)
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  teamMember?: TeamMember; // Populated if specific team member requested
  service: Service;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
  hasAvailability: boolean;
}

// ============================================================================
// Nylas API Types
// ============================================================================

export interface NylasGrant {
  id: string;
  provider: 'microsoft' | 'google';
  email: string;
  status: 'valid' | 'invalid';
}

export interface NylasEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  when: {
    startTime: number; // Unix timestamp
    endTime: number; // Unix timestamp
    timezone: string;
  };
  participants: NylasParticipant[];
  conferencing?: NylasConferencing;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface NylasParticipant {
  email: string;
  name?: string;
  status: 'yes' | 'no' | 'maybe' | 'noreply';
}

export interface NylasConferencing {
  provider: 'Microsoft Teams' | 'Google Meet' | 'Zoom';
  details: {
    url: string;
    meetingCode?: string;
  };
}

export interface NylasFreeBusy {
  email: string;
  timeSlots: {
    startTime: number;
    endTime: number;
    status: 'busy' | 'free';
  }[];
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface NylasWebhookPayload {
  specversion: string;
  type: NylasWebhookEventType;
  source: string;
  id: string;
  time: number;
  data: {
    application_id: string;
    grant_id: string;
    object: NylasEvent | NylasGrant;
  };
}

export type NylasWebhookEventType =
  | 'event.created'
  | 'event.updated'
  | 'event.deleted'
  | 'grant.created'
  | 'grant.updated'
  | 'grant.deleted'
  | 'grant.expired';

// ============================================================================
// UI State Types
// ============================================================================

export type SchedulingStep = 'service' | 'datetime' | 'details' | 'confirmation';

export interface SchedulingState {
  currentStep: SchedulingStep;
  selectedService: Service | null;
  selectedTeamMember: TeamMember | null;
  selectedSlot: TimeSlot | null;
  guestInfo: GuestInfo | null;
  booking: BookingConfirmation | null;
  error: string | null;
  isLoading: boolean;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

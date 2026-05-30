'use client';

import { useCallback, useMemo, useReducer } from 'react';

import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { type TranslateFn, useTranslations } from '@/i18n/utils';
import { trackConversion } from '@/lib/analytics';
import type {
  BookingConfirmation as BookingConfirmationType,
  GuestInfo,
  MeetingType,
  SchedulingStep,
  Service,
  TeamMember,
  TimeSlot,
} from '@/lib/nylas/types';
import { cn } from '@/lib/utils';

import { AvailabilityPicker } from './AvailabilityPicker';
import { BookingConfirmation } from './BookingConfirmation';
import { BookingForm } from './BookingForm';
import { PendingConfirmation } from './PendingConfirmation';
import { ServiceSelector } from './ServiceSelector';

interface PendingBookingInfo {
  email: string;
  expiresAt: Date;
  startTime: Date;
}

interface SchedulingWidgetProps {
  services: Service[];
  teamMembers: TeamMember[];
  initialServiceId?: string;
  initialTeamMemberId?: string;
  cancelToken?: string;
  onMeetingTypeChange?: (type: MeetingType) => void;
  lang?: 'en' | 'es';
  className?: string;
}

interface SchedulingWidgetState {
  currentStep: SchedulingStep;
  selectedServiceId: string | null;
  selectedTeamMemberId: string | null;
  selectedSlot: TimeSlot | null;
  booking: BookingConfirmationType | null;
  pendingBooking: PendingBookingInfo | null;
  meetingType: MeetingType;
}

type SchedulingWidgetAction =
  | {
      type: 'selectService';
      payload: {
        serviceId: string | null;
        teamMemberId: string | null;
        meetingType: MeetingType;
      };
    }
  | {
      type: 'selectSlot';
      payload: {
        slot: TimeSlot;
        teamMemberId: string | null;
      };
    }
  | { type: 'goBack' }
  | { type: 'setStep'; payload: SchedulingStep }
  | { type: 'setMeetingType'; payload: MeetingType }
  | { type: 'setPendingBooking'; payload: PendingBookingInfo }
  | { type: 'setConfirmedBooking'; payload: BookingConfirmationType }
  | { type: 'resetFlow' };

const STEPS: SchedulingStep[] = ['service', 'datetime', 'details', 'confirmation'];

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

function createInitialWidgetState({
  services,
  teamMembers,
  initialServiceId,
  initialTeamMemberId,
}: {
  services: Service[];
  teamMembers: TeamMember[];
  initialServiceId?: string;
  initialTeamMemberId?: string;
}): SchedulingWidgetState {
  const initialService = initialServiceId
    ? services.find((service) => service.id === initialServiceId)
    : null;
  const meetingType = initialService?.meetingTypes?.[0] ?? 'teams';

  if (!initialService) {
    return {
      currentStep: 'service',
      selectedServiceId: null,
      selectedTeamMemberId: null,
      selectedSlot: null,
      booking: null,
      pendingBooking: null,
      meetingType,
    };
  }

  const eligibleMembers = teamMembers.filter((member) =>
    initialService.teamMembers.includes(member.id)
  );
  const initialMember =
    (initialTeamMemberId && teamMembers.find((member) => member.id === initialTeamMemberId)) ||
    (eligibleMembers.length === 1 ? eligibleMembers[0] : null);

  return {
    currentStep: 'datetime',
    selectedServiceId: initialService.id,
    selectedTeamMemberId: initialMember?.id ?? null,
    selectedSlot: null,
    booking: null,
    pendingBooking: null,
    meetingType,
  };
}

function schedulingWidgetReducer(
  state: SchedulingWidgetState,
  action: SchedulingWidgetAction
): SchedulingWidgetState {
  switch (action.type) {
    case 'selectService':
      return {
        ...state,
        currentStep: 'service',
        selectedServiceId: action.payload.serviceId,
        selectedTeamMemberId: action.payload.teamMemberId,
        selectedSlot: null,
        booking: null,
        pendingBooking: null,
        meetingType: action.payload.meetingType,
      };
    case 'selectSlot':
      return {
        ...state,
        selectedSlot: action.payload.slot,
        selectedTeamMemberId: action.payload.teamMemberId ?? state.selectedTeamMemberId,
      };
    case 'goBack':
      if (state.currentStep === 'datetime') {
        return {
          ...state,
          currentStep: 'service',
          selectedSlot: null,
          selectedTeamMemberId: null,
        };
      }
      if (state.currentStep === 'details') {
        return {
          ...state,
          currentStep: 'datetime',
          selectedSlot: null,
        };
      }
      return state;
    case 'setStep':
      return { ...state, currentStep: action.payload };
    case 'setMeetingType':
      return { ...state, meetingType: action.payload };
    case 'setPendingBooking':
      return {
        ...state,
        pendingBooking: action.payload,
        booking: null,
        currentStep: 'confirmation',
      };
    case 'setConfirmedBooking':
      return {
        ...state,
        booking: action.payload,
        pendingBooking: null,
        currentStep: 'confirmation',
      };
    case 'resetFlow':
      return {
        ...state,
        currentStep: 'service',
        selectedServiceId: null,
        selectedTeamMemberId: null,
        selectedSlot: null,
        booking: null,
        pendingBooking: null,
      };
  }
}

function getStepIndex(step: SchedulingStep): number {
  return STEPS.indexOf(step);
}

function SchedulingProgress({ currentStep, t }: { currentStep: SchedulingStep; t: TranslateFn }) {
  if (currentStep === 'confirmation') return null;

  const progressSteps = [
    { id: 'service', label: t('scheduling.progressService') },
    { id: 'datetime', label: t('scheduling.progressDateTime') },
    { id: 'details', label: t('scheduling.progressDetails') },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2">
        {progressSteps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isComplete = getStepIndex(currentStep) > index;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  isActive && 'bg-brand text-brand-foreground',
                  isComplete && 'bg-brand/20 text-brand',
                  !isActive && !isComplete && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'ml-2 hidden text-sm sm:inline',
                  isActive && 'font-medium text-foreground',
                  !isActive && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              {index < progressSteps.length - 1 && (
                <div
                  className={cn('mx-3 h-0.5 w-8 sm:w-12', isComplete ? 'bg-brand' : 'bg-muted')}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchedulingStepContent({
  currentStep,
  selectedService,
  selectedTeamMember,
  selectedSlot,
  booking,
  pendingBooking,
  timezone,
  meetingType,
  services,
  teamMembers,
  lang,
  onServiceSelect,
  onSlotSelect,
  onBookingSubmit,
  onBookAnother,
  onBack,
  onMeetingTypeChange,
}: {
  currentStep: SchedulingStep;
  selectedService: Service | null;
  selectedTeamMember: TeamMember | null;
  selectedSlot: TimeSlot | null;
  booking: BookingConfirmationType | null;
  pendingBooking: PendingBookingInfo | null;
  timezone: string;
  meetingType: MeetingType;
  services: Service[];
  teamMembers: TeamMember[];
  lang: 'en' | 'es';
  onServiceSelect: (service: Service | null) => void;
  onSlotSelect: (slot: TimeSlot) => void;
  onBookingSubmit: (guestInfo: GuestInfo) => Promise<void>;
  onBookAnother: () => void;
  onBack: () => void;
  onMeetingTypeChange: (type: MeetingType) => void;
}) {
  switch (currentStep) {
    case 'service':
      return (
        <ServiceSelector
          services={services}
          teamMembers={teamMembers}
          selectedService={selectedService}
          onSelect={onServiceSelect}
          timezone={timezone}
          lang={lang}
        />
      );
    case 'datetime':
      if (!selectedService) return null;
      return (
        <AvailabilityPicker
          service={selectedService}
          teamMember={selectedTeamMember || undefined}
          selectedSlot={selectedSlot}
          onSelectSlot={onSlotSelect}
          timezone={timezone}
          lang={lang}
        />
      );
    case 'details':
      if (!selectedService || !selectedTeamMember || !selectedSlot) return null;
      return (
        <BookingForm
          service={selectedService}
          teamMember={selectedTeamMember}
          selectedSlot={selectedSlot}
          timezone={timezone}
          onSubmit={onBookingSubmit}
          onBack={onBack}
          selectedMeetingType={meetingType}
          onMeetingTypeChange={onMeetingTypeChange}
          lang={lang}
        />
      );
    case 'confirmation':
      if (pendingBooking && selectedService && selectedTeamMember) {
        return (
          <PendingConfirmation
            email={pendingBooking.email}
            serviceName={selectedService.name}
            teamMember={selectedTeamMember}
            startTime={pendingBooking.startTime}
            duration={selectedService.duration}
            expiresAt={pendingBooking.expiresAt}
            timezone={timezone}
            onBookAnother={onBookAnother}
            lang={lang}
          />
        );
      }
      if (booking) {
        return (
          <BookingConfirmation
            booking={booking}
            timezone={timezone}
            onBookAnother={onBookAnother}
            lang={lang}
          />
        );
      }
      return null;
  }
}

export function SchedulingWidget({
  services,
  teamMembers,
  initialServiceId,
  initialTeamMemberId,
  cancelToken,
  onMeetingTypeChange,
  className,
  lang = 'en',
}: SchedulingWidgetProps) {
  const t = useTranslations(lang);
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const [state, dispatch] = useReducer(
    schedulingWidgetReducer,
    {
      services,
      teamMembers,
      initialServiceId,
      initialTeamMemberId,
    },
    createInitialWidgetState
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === state.selectedServiceId) ?? null,
    [services, state.selectedServiceId]
  );
  const selectedTeamMember = useMemo(
    () => teamMembers.find((member) => member.id === state.selectedTeamMemberId) ?? null,
    [teamMembers, state.selectedTeamMemberId]
  );

  const canGoBack = () => getStepIndex(state.currentStep) > 0 && state.currentStep !== 'confirmation';
  const canGoNext =
    state.currentStep === 'service'
      ? !!selectedService
      : state.currentStep === 'datetime'
        ? !!state.selectedSlot
        : false;

  const goBack = useCallback(() => {
    dispatch({ type: 'goBack' });
  }, []);

  const goNext = useCallback(() => {
    const currentIndex = getStepIndex(state.currentStep);
    if (currentIndex < STEPS.length - 1 && canGoNext) {
      dispatch({ type: 'setStep', payload: STEPS[currentIndex + 1] });
    }
  }, [canGoNext, state.currentStep]);

  const handleServiceSelect = (service: Service | null) => {
    if (!service) {
      dispatch({
        type: 'selectService',
        payload: {
          serviceId: null,
          teamMemberId: null,
          meetingType: state.meetingType,
        },
      });
      return;
    }

    const eligibleMembers = teamMembers.filter((member) => service.teamMembers.includes(member.id));
    const teamMemberId = !service.roundRobin && eligibleMembers.length === 1 ? eligibleMembers[0].id : null;
    const nextMeetingType = service.meetingTypes?.[0] ?? state.meetingType;

    dispatch({
      type: 'selectService',
      payload: {
        serviceId: service.id,
        teamMemberId,
        meetingType: nextMeetingType,
      },
    });
  };

  const handleMeetingTypeChange = (type: MeetingType) => {
    dispatch({ type: 'setMeetingType', payload: type });
    onMeetingTypeChange?.(type);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    const member = teamMembers.find((teamMember) => teamMember.id === slot.teamMemberId);
    dispatch({
      type: 'selectSlot',
      payload: {
        slot,
        teamMemberId: member?.id ?? null,
      },
    });
  };

  const handleBookingSubmit = async (guestInfo: GuestInfo) => {
    if (!selectedService || !selectedTeamMember || !state.selectedSlot) {
      throw new Error('Missing required booking information');
    }

    const response = await fetch('/api/nylas/book/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService.id,
        teamMemberId: selectedTeamMember.id,
        startTime: state.selectedSlot.startTime,
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        notes: guestInfo.notes,
        timezone,
        meetingType: state.meetingType,
        ...(cancelToken && { cancelToken }),
      }),
    });
    const data = await response.json();

    if (!data.success) {
      if (response.status === 429) {
        throw new Error(
          data.error || 'Too many booking attempts. Please wait a few minutes and try again.'
        );
      }
      throw new Error(data.error || 'Failed to create booking');
    }

    if (data.requiresConfirmation) {
      dispatch({
        type: 'setPendingBooking',
        payload: {
          email: data.data.email,
          expiresAt: new Date(data.data.expiresAt),
          startTime: new Date(data.data.startTime),
        },
      });
      return;
    }

    const confirmation: BookingConfirmationType = {
      id: data.data.id,
      service: selectedService,
      teamMember: selectedTeamMember,
      startTime: new Date(data.data.startTime),
      endTime: new Date(data.data.endTime),
      meetingLink: data.data.meetingLink,
      calendarLinks: data.data.calendarLinks,
    };

    dispatch({ type: 'setConfirmedBooking', payload: confirmation });
    trackConversion('strategy_call_booked', {
      service: selectedService.name,
      teamMember: selectedTeamMember.name,
    });
  };

  return (
    <div className={cn('mx-auto max-w-6xl', className)}>
      <SchedulingProgress currentStep={state.currentStep} t={t} />

      <SchedulingStepContent
        currentStep={state.currentStep}
        selectedService={selectedService}
        selectedTeamMember={selectedTeamMember}
        selectedSlot={state.selectedSlot}
        booking={state.booking}
        pendingBooking={state.pendingBooking}
        timezone={timezone}
        meetingType={state.meetingType}
        services={services}
        teamMembers={teamMembers}
        lang={lang}
        onServiceSelect={handleServiceSelect}
        onSlotSelect={handleSlotSelect}
        onBookingSubmit={handleBookingSubmit}
        onBookAnother={() => dispatch({ type: 'resetFlow' })}
        onBack={goBack}
        onMeetingTypeChange={handleMeetingTypeChange}
      />

      {state.currentStep !== 'details' && state.currentStep !== 'confirmation' && (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={goBack} disabled={!canGoBack()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('nav.back')}
          </Button>
          <Button onClick={goNext} disabled={!canGoNext}>
            {t('scheduling.continue')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

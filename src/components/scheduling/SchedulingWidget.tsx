'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { ServiceSelector } from './ServiceSelector';
import { TeamMemberCard, TeamMemberList } from './TeamMemberCard';
import { AvailabilityPicker } from './AvailabilityPicker';
import { BookingForm } from './BookingForm';
import { useTranslations } from '@/i18n/utils';
import { BookingConfirmation } from './BookingConfirmation';
import { PendingConfirmation } from './PendingConfirmation';
import { cn } from '@/lib/utils';
import { trackConversion } from '@/lib/analytics';
import type {
  Service,
  TeamMember,
  TimeSlot,
  GuestInfo,
  SchedulingStep,
  BookingConfirmation as BookingConfirmationType,
  MeetingType,
} from '@/lib/nylas/types';

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
  /** Token of a previous booking to cancel when creating a new one (for "change time") */
  cancelToken?: string;
  onMeetingTypeChange?: (type: MeetingType) => void;
  lang?: 'en' | 'es';
  className?: string;
}

const STEPS: SchedulingStep[] = ['service', 'datetime', 'details', 'confirmation'];

export function SchedulingWidget({
  services,
  teamMembers,
  initialServiceId,
  initialTeamMemberId,
  cancelToken,
  className,
  lang = 'en',
}: SchedulingWidgetProps) {
  const t = useTranslations(lang);
  const [currentStep, setCurrentStep] = useState<SchedulingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMember | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booking, setBooking] = useState<BookingConfirmationType | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBookingInfo | null>(null);
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/New_York';
    }
  });
  const [meetingType, setMeetingType] = useState<MeetingType>(
    () => services.find((s) => s.id === initialServiceId)?.meetingTypes?.[0] ?? 'teams'
  );

  // Handle initial values
  useEffect(() => {
    if (initialServiceId) {
      const service = services.find((s) => s.id === initialServiceId);
      if (service) {
        setSelectedService(service);
        if (service.meetingTypes?.[0]) {
          setMeetingType(service.meetingTypes[0]);
        }
        // If there's only one team member for this service, auto-select them
        const eligibleMembers = teamMembers.filter((m) =>
          service.teamMembers.includes(m.id)
        );
        if (eligibleMembers.length === 1 || initialTeamMemberId) {
          const member = initialTeamMemberId
            ? teamMembers.find((m) => m.id === initialTeamMemberId)
            : eligibleMembers[0];
          if (member) {
            setSelectedTeamMember(member);
            setCurrentStep('datetime');
          }
        } else {
          setCurrentStep('datetime');
        }
      }
    }
  }, [initialServiceId, initialTeamMemberId, services, teamMembers]);

  const getStepIndex = (step: SchedulingStep): number => STEPS.indexOf(step);

  const canGoBack = (): boolean => {
    return getStepIndex(currentStep) > 0 && currentStep !== 'confirmation';
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'service':
        return !!selectedService;
      case 'datetime':
        return !!selectedSlot;
      case 'details':
        return false; // Handled by form submission
      case 'confirmation':
        return false;
    }
  };

  const goBack = useCallback(() => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex > 0) {
      const newStep = STEPS[currentIndex - 1];
      setCurrentStep(newStep);
      // Clear downstream selections
      if (newStep === 'service') {
        setSelectedSlot(null);
        setSelectedTeamMember(null);
      } else if (newStep === 'datetime') {
        setSelectedSlot(null);
      }
    }
  }, [currentStep]);

  const goNext = useCallback(() => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex < STEPS.length - 1 && canGoNext()) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  }, [currentStep, selectedService, selectedSlot]);

  const handleServiceSelect = (service: Service | null) => {
    setSelectedService(service);
    // Reset downstream selections
    setSelectedSlot(null);

    if (!service) {
      setSelectedTeamMember(null);
      return;
    }

    if (service.meetingTypes?.[0]) {
      setMeetingType(service.meetingTypes[0]);
    }

    // Pre-select team member if only one is available (for non-round-robin)
    const eligibleMembers = teamMembers.filter((m) =>
      service.teamMembers.includes(m.id)
    );

    if (!service.roundRobin && eligibleMembers.length === 1) {
      setSelectedTeamMember(eligibleMembers[0]);
    } else {
      setSelectedTeamMember(null);
    }
    // Don't auto-advance - user must click Continue
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    // Set the team member from the slot (for round-robin)
    const member = teamMembers.find((m) => m.id === slot.teamMemberId);
    if (member) {
      setSelectedTeamMember(member);
    }
  };

  const handleBookingSubmit = async (guestInfo: GuestInfo) => {
    if (!selectedService || !selectedTeamMember || !selectedSlot) {
      throw new Error('Missing required booking information');
    }

    const response = await fetch('/api/nylas/book/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService.id,
        teamMemberId: selectedTeamMember.id,
        startTime: selectedSlot.startTime,
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        notes: guestInfo.notes,
        timezone,
        meetingType,
        // If changing time from a previous booking, include token to cancel it
        ...(cancelToken && { cancelToken }),
      }),
    });

    const data = await response.json();

    if (!data.success) {
      // Provide a user-friendly message for rate limit errors
      if (response.status === 429) {
        throw new Error(
          data.error || 'Too many booking attempts. Please wait a few minutes and try again.'
        );
      }
      throw new Error(data.error || 'Failed to create booking');
    }

    // Check if booking requires email confirmation
    if (data.requiresConfirmation) {
      // Store pending booking info for display
      setPendingBooking({
        email: data.data.email,
        expiresAt: new Date(data.data.expiresAt),
        startTime: new Date(data.data.startTime),
      });
      setCurrentStep('confirmation');
      return;
    }

    // Immediate confirmation (fallback if confirmation not required)
    const confirmation: BookingConfirmationType = {
      id: data.data.id,
      service: selectedService,
      teamMember: selectedTeamMember,
      startTime: new Date(data.data.startTime),
      endTime: new Date(data.data.endTime),
      meetingLink: data.data.meetingLink,
      calendarLinks: data.data.calendarLinks,
    };

    setBooking(confirmation);
    setCurrentStep('confirmation');

    // Track the conversion — this is the most important event on the site
    trackConversion('strategy_call_booked', {
      service: selectedService.name,
      teamMember: selectedTeamMember.name,
    });
  };

  const handleBookAnother = () => {
    setCurrentStep('service');
    setSelectedService(null);
    setSelectedTeamMember(null);
    setSelectedSlot(null);
    setBooking(null);
    setPendingBooking(null);
  };

  // Render progress indicator
  const renderProgress = () => {
    if (currentStep === 'confirmation') return null;

    const steps = [
      { id: 'service', label: t('scheduling.progressService') },
      { id: 'datetime', label: t('scheduling.progressDateTime') },
      { id: 'details', label: t('scheduling.progressDetails') },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => {
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
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'mx-3 h-0.5 w-8 sm:w-12',
                      isComplete ? 'bg-brand' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render current step content
  const renderStep = () => {
    switch (currentStep) {
      case 'service':
        return (
          <ServiceSelector
            services={services}
            teamMembers={teamMembers}
            selectedService={selectedService}
            onSelect={handleServiceSelect}
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
            onSelectSlot={handleSlotSelect}
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
            onSubmit={handleBookingSubmit}
            onBack={goBack}
            selectedMeetingType={meetingType}
            onMeetingTypeChange={setMeetingType}
            lang={lang}
          />
        );

      case 'confirmation':
        // Show pending confirmation (check your email) or immediate confirmation
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
              onBookAnother={handleBookAnother}
              lang={lang}
            />
          );
        }

        if (booking) {
          return (
            <BookingConfirmation
              booking={booking}
              timezone={timezone}
              onBookAnother={handleBookAnother}
              lang={lang}
            />
          );
        }

        return null;
    }
  };

  return (
    <div className={cn('mx-auto max-w-6xl', className)}>
      {renderProgress()}

      {renderStep()}

      {/* Navigation buttons (except for details/confirmation which handle their own) */}
      {currentStep !== 'details' && currentStep !== 'confirmation' && (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={goBack} disabled={!canGoBack()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('nav.back')}
          </Button>
          <Button onClick={goNext} disabled={!canGoNext()}>
            {t('scheduling.continue')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export { ServiceSelector } from './ServiceSelector';
export { TeamMemberCard, TeamMemberList } from './TeamMemberCard';
export { AvailabilityPicker } from './AvailabilityPicker';
export { BookingForm } from './BookingForm';
export { BookingConfirmation } from './BookingConfirmation';
export { PendingConfirmation } from './PendingConfirmation';

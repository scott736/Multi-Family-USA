'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { AvailabilityPicker } from './AvailabilityPicker';
import { BookingForm } from './BookingForm';
import { useTranslations } from '@/i18n/utils';
import { PendingConfirmation } from './PendingConfirmation';
import { BookingConfirmation } from './BookingConfirmation';
import { cn } from '@/lib/utils';
import type {
  Service,
  TeamMember,
  TimeSlot,
  GuestInfo,
  BookingConfirmation as BookingConfirmationType,
  MeetingType,
} from '@/lib/nylas/types';

interface PendingBookingInfo {
  email: string;
  expiresAt: Date;
  startTime: Date;
}

type ProfileStep = 'datetime' | 'details' | 'confirmation';

interface ProfileSchedulerProps {
  teamMember: TeamMember;
  defaultService: Service;
  className?: string;
  /** Override the service duration (in minutes) for profile pages */
  duration?: number;
  lang?: 'en' | 'es';
}

/**
 * Simplified scheduling widget for profile pages
 * - Shows only the specified team member's availability
 * - Uses a default service (no service selection)
 * - Starts directly at datetime picker
 * - Uses 15 min duration by default (override from service's default)
 */
export function ProfileScheduler({
  teamMember,
  defaultService,
  className,
  duration = 15, // Profile pages default to 15 min calls
  lang = 'en',
}: ProfileSchedulerProps) {
  const t = useTranslations(lang);
  const [currentStep, setCurrentStep] = useState<ProfileStep>('datetime');
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
    defaultService.meetingTypes?.[0] || 'teams'
  );

  // Create modified service with profile-specific duration
  const service: Service = {
    ...defaultService,
    duration,
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const goBack = () => {
    if (currentStep === 'details') {
      setCurrentStep('datetime');
    }
  };

  const goNext = () => {
    if (currentStep === 'datetime' && selectedSlot) {
      setCurrentStep('details');
    }
  };

  const handleBookingSubmit = async (guestInfo: GuestInfo) => {
    if (!selectedSlot) {
      throw new Error('Please select a time slot');
    }

    const response = await fetch('/api/nylas/book/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        teamMemberId: teamMember.id,
        startTime: selectedSlot.startTime,
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        notes: guestInfo.notes,
        timezone,
        duration: service.duration,
        meetingType,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create booking');
    }

    // Check if booking requires email confirmation
    if (data.requiresConfirmation) {
      setPendingBooking({
        email: data.data.email,
        expiresAt: new Date(data.data.expiresAt),
        startTime: new Date(data.data.startTime),
      });
      setCurrentStep('confirmation');
      return;
    }

    // Immediate confirmation
    const confirmation: BookingConfirmationType = {
      id: data.data.id,
      service: service,
      teamMember: teamMember,
      startTime: new Date(data.data.startTime),
      endTime: new Date(data.data.endTime),
      meetingLink: data.data.meetingLink,
      calendarLinks: data.data.calendarLinks,
    };

    setBooking(confirmation);
    setCurrentStep('confirmation');
  };

  const handleBookAnother = () => {
    setCurrentStep('datetime');
    setSelectedSlot(null);
    setBooking(null);
    setPendingBooking(null);
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'datetime':
        return (
          <AvailabilityPicker
            service={service}
            teamMember={teamMember}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
            timezone={timezone}
          />
        );

      case 'details':
        if (!selectedSlot) return null;
        return (
          <BookingForm
            service={service}
            teamMember={teamMember}
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
        if (pendingBooking) {
          return (
            <PendingConfirmation
              email={pendingBooking.email}
              serviceName={service.name}
              teamMember={teamMember}
              startTime={pendingBooking.startTime}
              duration={service.duration}
              expiresAt={pendingBooking.expiresAt}
              timezone={timezone}
              onBookAnother={handleBookAnother}
            />
          );
        }

        if (booking) {
          return (
            <BookingConfirmation
              booking={booking}
              timezone={timezone}
              onBookAnother={handleBookAnother}
            />
          );
        }

        return null;
    }
  };

  return (
    <div className={cn('mx-auto w-full', className)}>
      {renderStep()}

      {/* Navigation buttons outside the cards */}
      {currentStep === 'datetime' && selectedSlot && (
        <div className="mt-6 flex justify-end max-w-5xl mx-auto">
          <Button onClick={goNext} size="lg" className="gap-2">
            {t('calc.results.view')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {currentStep === 'details' && (
        <div className="mt-6 flex justify-start max-w-5xl mx-auto">
          <Button onClick={goBack} variant="outline" size="lg" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('nav.back')}
          </Button>
        </div>
      )}
    </div>
  );
}

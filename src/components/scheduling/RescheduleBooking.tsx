import { useState, useEffect } from 'react';
import {
  XCircle,
  Loader2,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  RotateCcw,
} from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AvailabilityPicker } from './AvailabilityPicker';
import { useTranslations } from '@/i18n/utils';
import type { TimeSlot } from '@/lib/nylas/types';

interface BookingData {
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  service: { name: string; duration: number } | null;
  teamMember: { name: string; photo?: string } | null;
  startTime: string;
  guestName: string;
  guestEmail: string;
  timezone: string;
}

interface RescheduleBookingProps {
  token: string;
  lang?: 'en' | 'es';
}

type Status =
  | 'loading'
  | 'select_time'
  | 'confirming'
  | 'rescheduled'
  | 'error';

export function RescheduleBooking({ token, lang = 'en' }: RescheduleBookingProps) {
  const t = useTranslations(lang);
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const [status, setStatus] = useState<Status>('loading');
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduledData, setRescheduledData] = useState<{
    startTime: string;
    endTime: string;
    meetingLink?: string;
    calendarLinks?: { google: string; outlook: string; ical: string };
  } | null>(null);
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/New_York';
    }
  });

  // Identifiers stored from API response for the availability picker
  const [serviceId, setServiceId] = useState<string>('');
  const [teamMemberId, setTeamMemberId] = useState<string>('');

  const locale = lang === 'en' ? 'en-US' : 'es-ES';

  // Fetch booking details
  useEffect(() => {
    async function fetchBooking() {
      try {
        // Reuse the cancel-booking GET endpoint which returns the same data we need
        const response = await fetch(`/api/nylas/cancel-booking/?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || t('error.tryAgain'));
          setStatus('error');
          return;
        }

        const booking = data.data;

        setBookingData(booking);

        if (booking.status !== 'confirmed') {
          setError(t('scheduling.appointmentNotFound'));
          setStatus('error');
          return;
        }

        // Check if appointment is in the past
        if (new Date(booking.startTime) < new Date()) {
          setError(t('scheduling.appointmentNotFound'));
          setStatus('error');
          return;
        }

        // Store IDs for the availability picker
        if (booking.serviceId) setServiceId(booking.serviceId);
        if (booking.teamMemberId) setTeamMemberId(booking.teamMemberId);

        setStatus('select_time');
      } catch {
        setError(t('error.tryAgain'));
        setStatus('error');
      }
    }

    fetchBooking();
  }, [token, t]);


  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleConfirmReschedule = async () => {
    if (!selectedSlot) return;

    setStatus('confirming');
    setError(null);

    try {
      const response = await fetch('/api/nylas/reschedule-booking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newStartTime: selectedSlot.startTime,
          timezone,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || t('error.tryAgain'));
        setStatus('select_time');
        return;
      }

      setRescheduledData(data.data);
      setStatus('rescheduled');
    } catch {
      setError(t('error.tryAgain'));
      setStatus('select_time');
    }
  };

  const formatDateTime = (isoString: string, tz: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: tz,
      }),
      time: date.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
      }),
    };
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-brand" />
        <p className="mt-4 text-muted-foreground">{t('scheduling.loadingAppointment')}</p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-semibold">{t('scheduling.appointmentNotFound')}</h2>
            <p className="mt-2 text-muted-foreground">
              {error || t('scheduling.appointmentNotFoundNote')}{' '}
              <a href={lang === 'es' ? '/es/contact' : '/contact'} className="text-brand hover:underline">
                {t('scheduling.contactUs')}
              </a>
            </p>
            <Button asChild className="mt-6">
              <a href={bookCallHref}>{t('sched.bookNew')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rescheduled successfully
  if (status === 'rescheduled' && rescheduledData) {
    const { date, time } = formatDateTime(rescheduledData.startTime, timezone);

    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">{t('scheduling.rescheduleConfirmed')}</CardTitle>
          <CardDescription>
            {t('scheduling.rescheduleConfirmedNote') || t('scheduling.rescheduleNote')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* New Booking Details */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">{date}</p>
                <p className="text-sm text-muted-foreground">{time}</p>
              </div>
            </div>
            {bookingData?.service && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-brand" />
                <p>
                  {bookingData.service.name} ({bookingData.service.duration} {t('scheduling.minutes')})
                </p>
              </div>
            )}
            {bookingData?.teamMember && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-brand" />
                <p>{bookingData.teamMember.name}</p>
              </div>
            )}
          </div>

          {/* Meeting Link */}
          {rescheduledData.meetingLink && (
            <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
              <p className="text-sm font-medium mb-2">{t('scheduling.joinMeeting')}</p>
              <a
                href={rescheduledData.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline text-sm break-all"
              >
                {rescheduledData.meetingLink}
              </a>
            </div>
          )}

          {/* Add to Calendar */}
          {rescheduledData.calendarLinks && (
            <div>
              <p className="text-sm font-medium mb-2">{t('scheduling.addToCalendar')}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={rescheduledData.calendarLinks.google}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={rescheduledData.calendarLinks.outlook}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Outlook
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={rescheduledData.calendarLinks.ical} download>
                    {t('scheduling.downloadIcs')}
                  </a>
                </Button>
              </div>
            </div>
          )}

          <Button asChild className="w-full">
            <a href="/">{t('scheduling.returnHome')}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Select new time
  if ((status === 'select_time' || status === 'confirming') && bookingData) {
    const { date: currentDate, time: currentTime } = formatDateTime(
      bookingData.startTime,
      bookingData.timezone
    );

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Current appointment info */}
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <RotateCcw className="h-6 w-6 text-brand" />
            </div>
            <CardTitle className="text-xl">{t('scheduling.rescheduleAppointment')}</CardTitle>
            <CardDescription>
              {t('scheduling.reschedulingNote').replace('{date}', `${currentDate} ${currentTime}`)}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {currentDate} - {currentTime}
                </span>
              </div>
              {bookingData.service && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {bookingData.service.name} ({bookingData.service.duration} {t('scheduling.minutes')})
                  </span>
                </div>
              )}
              {bookingData.teamMember && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{bookingData.teamMember.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* New time selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('scheduling.selectNewTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingData.service && bookingData.teamMember ? (
              <AvailabilityPicker
                service={{
                  id: serviceId || 'strategy-call',
                  name: bookingData.service.name,
                  description: '',
                  duration: bookingData.service.duration,
                  teamMembers: [teamMemberId || ''],
                  roundRobin: false,
                }}
                teamMember={{
                  id: teamMemberId || '',
                  name: bookingData.teamMember.name,
                  email: '',
                  slug: '',
                  title: '',
                  services: [],
                  calendars: { primary: '' },
                }}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSlotSelect}
                timezone={timezone}
                lang={lang}
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t('scheduling.loadingAvailability')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Confirm reschedule */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline" size="lg">
            <a href="/">{t('scheduling.keepAppointment')}</a>
          </Button>
          <Button
            size="lg"
            onClick={handleConfirmReschedule}
            disabled={!selectedSlot || status === 'confirming'}
          >
            {status === 'confirming' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('scheduling.rescheduling')}
              </>
            ) : (
              t('scheduling.confirmReschedule')
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

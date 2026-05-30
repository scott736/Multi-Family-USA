import { useCallback, useMemo, useReducer, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  User,
  XCircle,
} from '@/components/ui/icons';
import { type TranslateFn, useTranslations } from '@/i18n/utils';
import type { TimeSlot } from '@/lib/nylas/types';

import { AvailabilityPicker } from './AvailabilityPicker';

interface BookingData {
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  service: { name: string; duration: number } | null;
  teamMember: { name: string; photo?: string } | null;
  startTime: string;
  guestName: string;
  guestEmail: string;
  timezone: string;
  serviceId?: string;
  teamMemberId?: string;
}

interface RescheduleData {
  startTime: string;
  endTime: string;
  meetingLink?: string;
  calendarLinks?: { google: string; outlook: string; ical: string };
}

interface RescheduleBookingProps {
  token: string;
  lang?: 'en' | 'es';
}

type Status = 'loading' | 'select_time' | 'confirming' | 'rescheduled' | 'error';

interface RescheduleBookingState {
  status: Status;
  bookingData: BookingData | null;
  selectedSlot: TimeSlot | null;
  error: string | null;
  rescheduledData: RescheduleData | null;
  serviceId: string;
  teamMemberId: string;
}

type RescheduleBookingAction =
  | { type: 'startLoading' }
  | {
      type: 'setBooking';
      payload: {
        bookingData: BookingData;
        serviceId: string;
        teamMemberId: string;
      };
    }
  | { type: 'setError'; payload: string }
  | { type: 'selectSlot'; payload: TimeSlot }
  | { type: 'startConfirming' }
  | { type: 'setRescheduled'; payload: RescheduleData }
  | { type: 'confirmFailed'; payload: string };

const initialState: RescheduleBookingState = {
  status: 'loading',
  bookingData: null,
  selectedSlot: null,
  error: null,
  rescheduledData: null,
  serviceId: '',
  teamMemberId: '',
};

function rescheduleBookingReducer(
  state: RescheduleBookingState,
  action: RescheduleBookingAction
): RescheduleBookingState {
  switch (action.type) {
    case 'startLoading':
      return {
        ...state,
        status: 'loading',
        error: null,
      };
    case 'setBooking':
      return {
        ...state,
        status: 'select_time',
        bookingData: action.payload.bookingData,
        serviceId: action.payload.serviceId,
        teamMemberId: action.payload.teamMemberId,
        error: null,
      };
    case 'setError':
      return {
        ...state,
        status: 'error',
        error: action.payload,
      };
    case 'selectSlot':
      return {
        ...state,
        selectedSlot: action.payload,
      };
    case 'startConfirming':
      return {
        ...state,
        status: 'confirming',
        error: null,
      };
    case 'setRescheduled':
      return {
        ...state,
        status: 'rescheduled',
        rescheduledData: action.payload,
        error: null,
      };
    case 'confirmFailed':
      return {
        ...state,
        status: 'select_time',
        error: action.payload,
      };
  }
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

function formatDateTime(isoString: string, tz: string, locale: string) {
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
}

function LoadingView({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-12 w-12 animate-spin text-brand" />
      <p className="mt-4 text-muted-foreground">{text}</p>
    </div>
  );
}

function ErrorView({
  title,
  message,
  contactHref,
  contactLabel,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  message: string;
  contactHref: string;
  contactLabel: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">
            {message}{' '}
            <a href={contactHref} className="text-brand hover:underline">
              {contactLabel}
            </a>
          </p>
          <Button asChild className="mt-6">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RescheduledView({
  rescheduledData,
  bookingData,
  timezone,
  locale,
  t,
  homeHref,
}: {
  rescheduledData: RescheduleData;
  bookingData: BookingData | null;
  timezone: string;
  locale: string;
  t: TranslateFn;
  homeHref: string;
}) {
  const { date, time } = formatDateTime(rescheduledData.startTime, timezone, locale);

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
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
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

        {rescheduledData.meetingLink && (
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
            <p className="mb-2 text-sm font-medium">{t('scheduling.joinMeeting')}</p>
            <a
              href={rescheduledData.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-brand hover:underline"
            >
              {rescheduledData.meetingLink}
            </a>
          </div>
        )}

        {rescheduledData.calendarLinks && (
          <div>
            <p className="mb-2 text-sm font-medium">{t('scheduling.addToCalendar')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={rescheduledData.calendarLinks.google} target="_blank" rel="noopener noreferrer">
                  Google
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={rescheduledData.calendarLinks.outlook} target="_blank" rel="noopener noreferrer">
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
          <a href={homeHref}>{t('scheduling.returnHome')}</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function SelectTimeView({
  bookingData,
  selectedSlot,
  status,
  error,
  serviceId,
  teamMemberId,
  timezone,
  lang,
  locale,
  t,
  onSlotSelect,
  onConfirm,
  homeHref,
}: {
  bookingData: BookingData;
  selectedSlot: TimeSlot | null;
  status: Status;
  error: string | null;
  serviceId: string;
  teamMemberId: string;
  timezone: string;
  lang: 'en' | 'es';
  locale: string;
  t: TranslateFn;
  onSlotSelect: (slot: TimeSlot) => void;
  onConfirm: () => void;
  homeHref: string;
}) {
  const { date: currentDate, time: currentTime } = formatDateTime(
    bookingData.startTime,
    bookingData.timezone,
    locale
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <RotateCcw className="h-6 w-6 text-brand" />
          </div>
          <CardTitle className="text-xl">{t('scheduling.rescheduleAppointment')}</CardTitle>
          <CardDescription>
            {t('scheduling.reschedulingNote').replace('{date}', `${currentDate} ${currentTime}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
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
              onSelectSlot={onSlotSelect}
              timezone={timezone}
              lang={lang}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">{t('scheduling.loadingAvailability')}</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</div>
      )}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg">
          <a href={homeHref}>{t('scheduling.keepAppointment')}</a>
        </Button>
        <Button size="lg" onClick={onConfirm} disabled={!selectedSlot || status === 'confirming'}>
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

export function RescheduleBooking({ token, lang = 'en' }: RescheduleBookingProps) {
  const t = useTranslations(lang);
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const contactHref = lang === 'es' ? '/es/contact' : '/contact';
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const [state, dispatch] = useReducer(rescheduleBookingReducer, initialState);
  const loadedTokenRef = useRef<string | null>(null);

  const loadBooking = useCallback(async () => {
    dispatch({ type: 'startLoading' });

    try {
      const response = await fetch(`/api/nylas/cancel-booking/?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!data.success) {
        dispatch({ type: 'setError', payload: data.error || t('error.tryAgain') });
        return;
      }

      const booking: BookingData = data.data;
      if (booking.status !== 'confirmed' || new Date(booking.startTime) < new Date()) {
        dispatch({ type: 'setError', payload: t('scheduling.appointmentNotFound') });
        return;
      }

      dispatch({
        type: 'setBooking',
        payload: {
          bookingData: booking,
          serviceId: booking.serviceId || '',
          teamMemberId: booking.teamMemberId || '',
        },
      });
    } catch {
      dispatch({ type: 'setError', payload: t('error.tryAgain') });
    }
  }, [token, t]);

  const handleContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const loadKey = `${token}:${lang}`;
      if (loadedTokenRef.current === loadKey) return;
      loadedTokenRef.current = loadKey;
      void loadBooking();
    },
    [lang, loadBooking, token]
  );

  const handleConfirmReschedule = async () => {
    if (!state.selectedSlot) return;

    dispatch({ type: 'startConfirming' });

    try {
      const response = await fetch('/api/nylas/reschedule-booking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newStartTime: state.selectedSlot.startTime,
          timezone,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        dispatch({ type: 'confirmFailed', payload: data.error || t('error.tryAgain') });
        return;
      }

      dispatch({ type: 'setRescheduled', payload: data.data });
    } catch {
      dispatch({ type: 'confirmFailed', payload: t('error.tryAgain') });
    }
  };

  if (state.status === 'loading') {
    return (
      <div ref={handleContainerRef}>
        <LoadingView text={t('scheduling.loadingAppointment')} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorView
        title={t('scheduling.appointmentNotFound')}
        message={state.error || t('scheduling.appointmentNotFoundNote')}
        contactHref={contactHref}
        contactLabel={t('scheduling.contactUs')}
        ctaHref={bookCallHref}
        ctaLabel={t('sched.bookNew')}
      />
    );
  }

  if (state.status === 'rescheduled' && state.rescheduledData) {
    return (
      <RescheduledView
        rescheduledData={state.rescheduledData}
        bookingData={state.bookingData}
        timezone={timezone}
        locale={locale}
        t={t}
        homeHref={homeHref}
      />
    );
  }

  if ((state.status === 'select_time' || state.status === 'confirming') && state.bookingData) {
    return (
      <SelectTimeView
        bookingData={state.bookingData}
        selectedSlot={state.selectedSlot}
        status={state.status}
        error={state.error}
        serviceId={state.serviceId}
        teamMemberId={state.teamMemberId}
        timezone={timezone}
        lang={lang}
        locale={locale}
        t={t}
        onSlotSelect={(slot) => dispatch({ type: 'selectSlot', payload: slot })}
        onConfirm={handleConfirmReschedule}
        homeHref={homeHref}
      />
    );
  }

  return null;
}

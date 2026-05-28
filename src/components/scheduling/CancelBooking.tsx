import { useCallback, useReducer, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  XCircle,
} from '@/components/ui/icons';
import { useTranslations } from '@/i18n/utils';

interface BookingData {
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  service: { name: string; duration: number } | null;
  teamMember: { name: string; photo?: string } | null;
  startTime: string;
  guestName: string;
  guestEmail: string;
  timezone: string;
}

interface CancelBookingProps {
  token: string;
  lang?: 'en' | 'es';
}

type Status = 'loading' | 'loaded' | 'confirming' | 'cancelled' | 'already_cancelled' | 'error';

interface CancelBookingState {
  status: Status;
  bookingData: BookingData | null;
  error: string | null;
  reason: string;
  showConfirm: boolean;
}

type CancelBookingAction =
  | { type: 'startLoading' }
  | { type: 'setLoaded'; payload: BookingData }
  | { type: 'setAlreadyCancelled'; payload: BookingData }
  | { type: 'setError'; payload: string }
  | { type: 'setReason'; payload: string }
  | { type: 'setShowConfirm'; payload: boolean }
  | { type: 'startConfirming' }
  | { type: 'cancelled' }
  | { type: 'cancelFailed'; payload: string };

function cancelBookingReducer(
  state: CancelBookingState,
  action: CancelBookingAction
): CancelBookingState {
  switch (action.type) {
    case 'startLoading':
      return {
        ...state,
        status: 'loading',
        error: null,
      };
    case 'setLoaded':
      return {
        ...state,
        status: 'loaded',
        bookingData: action.payload,
        error: null,
      };
    case 'setAlreadyCancelled':
      return {
        ...state,
        status: 'already_cancelled',
        bookingData: action.payload,
        error: null,
      };
    case 'setError':
      return {
        ...state,
        status: 'error',
        error: action.payload,
      };
    case 'setReason':
      return {
        ...state,
        reason: action.payload,
      };
    case 'setShowConfirm':
      return {
        ...state,
        showConfirm: action.payload,
      };
    case 'startConfirming':
      return {
        ...state,
        status: 'confirming',
        error: null,
      };
    case 'cancelled':
      return {
        ...state,
        status: 'cancelled',
        error: null,
      };
    case 'cancelFailed':
      return {
        ...state,
        status: 'loaded',
        error: action.payload,
      };
  }
}

const initialState: CancelBookingState = {
  status: 'loading',
  bookingData: null,
  error: null,
  reason: '',
  showConfirm: false,
};

function formatDateTime(isoString: string, timezone: string, locale: string) {
  const date = new Date(isoString);
  return {
    date: date.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    }),
    time: date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
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
  bookCallHref,
  cta,
  contactHref,
  contactLabel,
}: {
  title: string;
  message: string;
  bookCallHref: string;
  cta: string;
  contactHref: string;
  contactLabel: string;
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
            <a href={bookCallHref}>{cta}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlreadyCancelledView({
  title,
  note,
  href,
  cta,
}: {
  title: string;
  note: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <XCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{note}</p>
          <Button asChild variant="outline" className="mt-6">
            <a href={href}>{cta}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CancelledView({
  title,
  note,
  bookCallHref,
  bookAnotherText,
  homeText,
  homeHref,
}: {
  title: string;
  note: string;
  bookCallHref: string;
  bookAnotherText: string;
  homeText: string;
  homeHref: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg">
            <a href={bookCallHref}>{bookAnotherText}</a>
          </Button>
          <Button asChild size="lg">
            <a href={homeHref}>{homeText}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadedView({
  bookingData,
  locale,
  reason,
  showConfirm,
  status,
  error,
  onStartCancel,
  onKeepAppointment,
  onReasonChange,
  onHideConfirm,
  onConfirmCancel,
  t,
  homeHref,
}: {
  bookingData: BookingData;
  locale: string;
  reason: string;
  showConfirm: boolean;
  status: Status;
  error: string | null;
  onStartCancel: () => void;
  onKeepAppointment: () => void;
  onReasonChange: (value: string) => void;
  onHideConfirm: () => void;
  onConfirmCancel: () => void;
  t: ReturnType<typeof useTranslations>;
  homeHref: string;
}) {
  const { date, time } = formatDateTime(bookingData.startTime, bookingData.timezone, locale);

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">{t('scheduling.cancelAppointment')}</CardTitle>
        <CardDescription>{t('scheduling.yourAppointment')}</CardDescription>
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
          {bookingData.service && (
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-brand" />
              <p>
                {bookingData.service.name} ({bookingData.service.duration} {t('scheduling.minutes')})
              </p>
            </div>
          )}
          {bookingData.teamMember && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-brand" />
              <p>{bookingData.teamMember.name}</p>
            </div>
          )}
        </div>

        {!showConfirm ? (
          <div className="space-y-3">
            <Button variant="destructive" className="w-full" size="lg" onClick={onStartCancel}>
              {t('scheduling.cancelAppointment')}
            </Button>
            <Button asChild variant="outline" className="w-full" size="lg">
              <a href={homeHref} onClick={onKeepAppointment}>
                {t('scheduling.keepAppointment')}
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">{t('scheduling.confirmCancel')}</p>

            <div>
              <label htmlFor="cancel-reason" className="mb-1 block text-sm text-muted-foreground">
                {t('scheduling.cancelReason')}
              </label>
              <textarea
                id="cancel-reason"
                aria-label={t('scheduling.cancelReason')}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={t('scheduling.cancelReasonPlaceholder')}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                rows={3}
                maxLength={500}
              />
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onHideConfirm}
                disabled={status === 'confirming'}
              >
                {t('scheduling.keepAppointment')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onConfirmCancel}
                disabled={status === 'confirming'}
              >
                {status === 'confirming' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('scheduling.cancelling')}
                  </>
                ) : (
                  t('scheduling.confirmCancel')
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CancelBooking({ token, lang = 'en' }: CancelBookingProps) {
  const t = useTranslations(lang);
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const contactHref = lang === 'es' ? '/es/contact' : '/contact';
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const [state, dispatch] = useReducer(cancelBookingReducer, initialState);
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
      if (booking.status === 'cancelled') {
        dispatch({ type: 'setAlreadyCancelled', payload: booking });
        return;
      }
      if (booking.status !== 'confirmed') {
        dispatch({ type: 'setError', payload: t('scheduling.appointmentNotFound') });
        return;
      }

      dispatch({ type: 'setLoaded', payload: booking });
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

  const handleCancel = async () => {
    dispatch({ type: 'startConfirming' });

    try {
      const response = await fetch('/api/nylas/cancel-booking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: state.reason.trim() || undefined }),
      });

      const data = await response.json();
      if (!data.success) {
        dispatch({ type: 'cancelFailed', payload: data.error || t('error.tryAgain') });
        return;
      }

      dispatch({ type: 'cancelled' });
    } catch {
      dispatch({ type: 'cancelFailed', payload: t('error.tryAgain') });
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
        bookCallHref={bookCallHref}
        cta={t('sched.bookNew')}
      />
    );
  }

  if (state.status === 'already_cancelled') {
    return (
      <AlreadyCancelledView
        title={t('scheduling.cancellationConfirmed')}
        note={t('scheduling.cancellationNote')}
        href={bookCallHref}
        cta={t('scheduling.bookAnotherCall')}
      />
    );
  }

  if (state.status === 'cancelled') {
    return (
      <CancelledView
        title={t('scheduling.cancellationConfirmed')}
        note={t('scheduling.cancellationNote')}
        bookCallHref={bookCallHref}
        bookAnotherText={t('scheduling.bookAnotherCall')}
        homeText={t('scheduling.returnHome')}
        homeHref={homeHref}
      />
    );
  }

  if (state.bookingData) {
    return (
      <LoadedView
        bookingData={state.bookingData}
        locale={locale}
        reason={state.reason}
        showConfirm={state.showConfirm}
        status={state.status}
        error={state.error}
        onStartCancel={() => dispatch({ type: 'setShowConfirm', payload: true })}
        onKeepAppointment={() => dispatch({ type: 'setShowConfirm', payload: false })}
        onReasonChange={(value) => dispatch({ type: 'setReason', payload: value })}
        onHideConfirm={() => dispatch({ type: 'setShowConfirm', payload: false })}
        onConfirmCancel={handleCancel}
        t={t}
        homeHref={homeHref}
      />
    );
  }

  return null;
}

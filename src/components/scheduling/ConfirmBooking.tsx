import { useCallback, useReducer, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle2, Clock, Loader2, User, XCircle } from '@/components/ui/icons';
import { type TranslateFn, useTranslations } from '@/i18n/utils';
import { trackConversion } from '@/lib/analytics';

interface PendingBookingData {
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  service: { name: string; duration: number } | null;
  teamMember: { name: string } | null;
  startTime: string;
  guestName: string;
  guestEmail: string;
  timezone: string;
  expiresAt: string;
  confirmedAt?: string;
}

interface ConfirmedBookingData {
  id: string;
  service: { name: string; duration: number };
  teamMember: { name: string; email: string };
  startTime: string;
  endTime: string;
  meetingLink?: string;
  calendarLinks: {
    google: string;
    outlook: string;
    ical: string;
  };
}

interface ConfirmBookingProps {
  token: string;
  lang?: 'en' | 'es';
}

type Status = 'loading' | 'pending' | 'confirming' | 'confirmed' | 'already_confirmed' | 'error';

interface ConfirmBookingState {
  status: Status;
  pendingData: PendingBookingData | null;
  confirmedData: ConfirmedBookingData | null;
  error: string | null;
}

type ConfirmBookingAction =
  | { type: 'loadStarted' }
  | { type: 'setPending'; payload: PendingBookingData }
  | { type: 'setAlreadyConfirmed'; payload: PendingBookingData }
  | { type: 'setError'; payload: string }
  | { type: 'startConfirming' }
  | { type: 'setConfirmed'; payload: ConfirmedBookingData }
  | { type: 'confirmFailed'; payload: string };

const initialState: ConfirmBookingState = {
  status: 'loading',
  pendingData: null,
  confirmedData: null,
  error: null,
};

function confirmBookingReducer(
  state: ConfirmBookingState,
  action: ConfirmBookingAction
): ConfirmBookingState {
  switch (action.type) {
    case 'loadStarted':
      return {
        ...state,
        status: 'loading',
        error: null,
      };
    case 'setPending':
      return {
        ...state,
        status: 'pending',
        pendingData: action.payload,
        error: null,
      };
    case 'setAlreadyConfirmed':
      return {
        ...state,
        status: 'already_confirmed',
        pendingData: action.payload,
        error: null,
      };
    case 'setError':
      return {
        ...state,
        status: 'error',
        error: action.payload,
      };
    case 'startConfirming':
      return {
        ...state,
        status: 'confirming',
        error: null,
      };
    case 'setConfirmed':
      return {
        ...state,
        status: 'confirmed',
        confirmedData: action.payload,
        error: null,
      };
    case 'confirmFailed':
      return {
        ...state,
        status: 'pending',
        error: action.payload,
      };
  }
}

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
  ctaLabel,
  ctaHref,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{message}</p>
          <Button asChild className="mt-6">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlreadyConfirmedView({
  pendingData,
  locale,
  title,
  description,
  returnText,
  returnHref,
  atLabel,
  withLabel,
}: {
  pendingData: PendingBookingData;
  locale: string;
  title: string;
  description: string;
  returnText: string;
  returnHref: string;
  atLabel: string;
  withLabel: string;
}) {
  const { date, time } = formatDateTime(pendingData.startTime, pendingData.timezone, locale);

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{description}</p>
          <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
            <p>
              <strong>{pendingData.service?.name}</strong>
            </p>
            <p className="text-muted-foreground">
              {date} {atLabel} {time}
            </p>
            <p className="text-muted-foreground">
              {withLabel} {pendingData.teamMember?.name}
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6">
            <a href={returnHref}>{returnText}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmedView({
  confirmedData,
  timezone,
  locale,
  token,
  t,
  homeHref,
}: {
  confirmedData: ConfirmedBookingData;
  timezone: string;
  locale: string;
  token: string;
  t: TranslateFn;
  homeHref: string;
}) {
  const { date, time } = formatDateTime(confirmedData.startTime, timezone, locale);

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">{t('sched.confirmedTitle')}</CardTitle>
        <CardDescription>{t('sched.successNote')}</CardDescription>
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
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-brand" />
            <p>
              {confirmedData.service.duration} {t('sched.minutes')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-brand" />
            <p>{confirmedData.teamMember.name}</p>
          </div>
        </div>

        {confirmedData.meetingLink && (
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
            <p className="mb-2 text-sm font-medium">{t('sched.videoLink')}</p>
            <a
              href={confirmedData.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-brand hover:underline"
            >
              {confirmedData.meetingLink}
            </a>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">{t('sched.addToCalendar')}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={confirmedData.calendarLinks.google} target="_blank" rel="noopener noreferrer">
                Google
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={confirmedData.calendarLinks.outlook} target="_blank" rel="noopener noreferrer">
                Outlook
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={confirmedData.calendarLinks.ical} download>
                {t('sched.downloadIcs')}
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">{t('scheduling.rescheduleNote')} </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/booking/reschedule?token=${encodeURIComponent(token)}`}>
                {t('scheduling.rescheduleAppointment')}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/booking/cancel?token=${encodeURIComponent(token)}`}>
                {t('scheduling.cancelAppointment')}
              </a>
            </Button>
          </div>
        </div>

        <Button asChild className="w-full">
          <a href={homeHref}>{t('sched.returnHome')}</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function ExpiredView({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{description}</p>
          <Button asChild className="mt-6">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingView({
  pendingData,
  status,
  error,
  locale,
  token,
  bookCallHref,
  t,
  onConfirm,
}: {
  pendingData: PendingBookingData;
  status: Status;
  error: string | null;
  locale: string;
  token: string;
  bookCallHref: string;
  t: TranslateFn;
  onConfirm: () => void;
}) {
  const { date, time } = formatDateTime(pendingData.startTime, pendingData.timezone, locale);
  const expiresAt = new Date(pendingData.expiresAt);
  const isExpired = expiresAt < new Date(Date.now() - 60 * 60 * 1000);

  if (isExpired) {
    return (
      <ExpiredView
        title={t('sched.linkExpired')}
        description={t('sched.linkExpiredDesc')}
        ctaLabel={t('sched.bookNew')}
        ctaHref={bookCallHref}
      />
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('sched.confirmTitle')}</CardTitle>
        <CardDescription>{t('sched.confirmDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sched.service')}</span>
            <span className="font-medium">{pendingData.service?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sched.duration')}</span>
            <span className="font-medium">
              {pendingData.service?.duration} {t('sched.minutes')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sched.staff')}</span>
            <span className="font-medium">{pendingData.teamMember?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sched.date')}</span>
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sched.time')}</span>
            <span className="font-medium">{time}</span>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            {t('sched.bookingFor')} <span className="text-foreground">{pendingData.guestName}</span>
          </p>
          <p>
            {t('sched.emailLabel')} <span className="text-foreground">{pendingData.guestEmail}</span>
          </p>
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <Button onClick={onConfirm} disabled={status === 'confirming'} className="w-full" size="lg">
          {status === 'confirming' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('sched.confirming')}
            </>
          ) : (
            t('sched.confirmButton')
          )}
        </Button>

        <div className="text-center">
          <a
            href={`${bookCallHref}?cancelToken=${encodeURIComponent(token)}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            {t('sched.changeTime')}
          </a>
        </div>

        <p className="text-center text-xs text-muted-foreground">{t('sched.agreeNote')}</p>
      </CardContent>
    </Card>
  );
}

export function ConfirmBooking({ token, lang = 'en' }: ConfirmBookingProps) {
  const t = useTranslations(lang);
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const [state, dispatch] = useReducer(confirmBookingReducer, initialState);
  const loadedTokenRef = useRef<string | null>(null);

  const loadPendingBooking = useCallback(async () => {
    dispatch({ type: 'loadStarted' });

    try {
      const response = await fetch(`/api/nylas/confirm/?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!data.success) {
        dispatch({ type: 'setError', payload: data.error || t('error.tryAgain') });
        return;
      }

      const pendingData: PendingBookingData = data.data;
      if (pendingData.status === 'confirmed') {
        dispatch({ type: 'setAlreadyConfirmed', payload: pendingData });
        return;
      }
      if (pendingData.status === 'expired' || pendingData.status === 'cancelled') {
        dispatch({ type: 'setError', payload: t('sched.linkExpiredDesc') });
        return;
      }

      dispatch({ type: 'setPending', payload: pendingData });
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
      void loadPendingBooking();
    },
    [lang, loadPendingBooking, token]
  );

  const handleConfirm = async () => {
    dispatch({ type: 'startConfirming' });

    try {
      const response = await fetch('/api/nylas/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!data.success) {
        dispatch({ type: 'confirmFailed', payload: data.error || t('error.tryAgain') });
        return;
      }

      dispatch({ type: 'setConfirmed', payload: data.data });

      trackConversion('strategy_call_booked', {
        service: data.data.service?.name,
        teamMember: data.data.teamMember?.name,
      });
    } catch {
      dispatch({ type: 'confirmFailed', payload: t('error.tryAgain') });
    }
  };

  if (state.status === 'loading') {
    return (
      <div ref={handleContainerRef}>
        <LoadingView text={t('sched.loading')} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorView
        title={t('sched.errorTitle')}
        message={state.error || t('error.tryAgain')}
        ctaLabel={t('sched.bookNew')}
        ctaHref={bookCallHref}
      />
    );
  }

  if (state.status === 'already_confirmed' && state.pendingData) {
    return (
      <AlreadyConfirmedView
        pendingData={state.pendingData}
        locale={locale}
        title={t('sched.alreadyConfirmed')}
        description={t('sched.alreadyConfirmedDesc')}
        returnText={t('sched.returnHome')}
        returnHref={homeHref}
        atLabel={t('sched.at')}
        withLabel={t('sched.with')}
      />
    );
  }

  if (state.status === 'confirmed' && state.confirmedData) {
    return (
      <ConfirmedView
        confirmedData={state.confirmedData}
        timezone={state.pendingData?.timezone || 'America/New_York'}
        locale={locale}
        token={token}
        t={t}
        homeHref={homeHref}
      />
    );
  }

  if (state.pendingData) {
    return (
      <PendingView
        pendingData={state.pendingData}
        status={state.status}
        error={state.error}
        locale={locale}
        token={token}
        bookCallHref={bookCallHref}
        t={t}
        onConfirm={handleConfirm}
      />
    );
  }

  return null;
}

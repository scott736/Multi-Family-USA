import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, User } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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

import { useTranslations } from '@/i18n/utils';

interface ConfirmBookingProps {
  token: string;
  lang?: 'en' | 'es';
}

type Status = 'loading' | 'pending' | 'confirming' | 'confirmed' | 'already_confirmed' | 'error';

export function ConfirmBooking({ token, lang = 'en' }: ConfirmBookingProps) {
  const t = useTranslations(lang);
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const [status, setStatus] = useState<Status>('loading');
  const [pendingData, setPendingData] = useState<PendingBookingData | null>(null);
  const [confirmedData, setConfirmedData] = useState<ConfirmedBookingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch pending booking details
  useEffect(() => {
    async function fetchPendingBooking() {
      try {
        const response = await fetch(`/api/nylas/confirm/?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || t('error.tryAgain'));
          setStatus('error');
          return;
        }

        setPendingData(data.data);

        if (data.data.status === 'confirmed') {
          setStatus('already_confirmed');
        } else if (data.data.status === 'expired' || data.data.status === 'cancelled') {
          setError(t('sched.linkExpiredDesc'));
          setStatus('error');
        } else {
          setStatus('pending');
        }
      } catch {
        setError(t('error.tryAgain'));
        setStatus('error');
      }
    }

    fetchPendingBooking();
  }, [token, t]);

  const handleConfirm = async () => {
    setStatus('confirming');
    setError(null);

    try {
      const response = await fetch('/api/nylas/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || t('error.tryAgain'));
        setStatus('pending');
        return;
      }

      setConfirmedData(data.data);
      setStatus('confirmed');

      // Track the conversion — this is the most important event on the site
      trackConversion('strategy_call_booked', {
        service: data.data.service?.name,
        teamMember: data.data.teamMember?.name,
      });
    } catch {
      setError(t('error.tryAgain'));
      setStatus('pending');
    }
  };

  const formatDateTime = (isoString: string, timezone: string) => {
    const date = new Date(isoString);
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
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
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-brand" />
        <p className="mt-4 text-muted-foreground">{t('sched.loading')}</p>
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
            <h2 className="text-xl font-semibold">{t('sched.errorTitle')}</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <Button asChild className="mt-6">
              <a href={bookCallHref}>{t('sched.bookNew')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Already confirmed state
  if (status === 'already_confirmed' && pendingData) {
    const { date, time } = formatDateTime(pendingData.startTime, pendingData.timezone);
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-semibold">{t('sched.alreadyConfirmed')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('sched.alreadyConfirmedDesc')}
            </p>
            <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
              <p><strong>{pendingData.service?.name}</strong></p>
              <p className="text-muted-foreground">{date} {t('sched.at')} {time}</p>
              <p className="text-muted-foreground">{t('sched.with')} {pendingData.teamMember?.name}</p>
            </div>
            <Button asChild variant="outline" className="mt-6">
              <a href={homeHref}>{t('sched.returnHome')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Confirmed state (just confirmed)
  if (status === 'confirmed' && confirmedData) {
    const { date, time } = formatDateTime(confirmedData.startTime, pendingData?.timezone || 'America/New_York');
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">{t('sched.confirmedTitle')}</CardTitle>
          <CardDescription>
            {t('sched.successNote')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Booking Details */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">{date}</p>
                <p className="text-sm text-muted-foreground">{time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-brand" />
              <p>{confirmedData.service.duration} {t('sched.minutes')}</p>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-brand" />
              <p>{confirmedData.teamMember.name}</p>
            </div>
          </div>

          {/* Meeting Link */}
          {confirmedData.meetingLink && (
            <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
              <p className="text-sm font-medium mb-2">{t('sched.videoLink')}</p>
              <a
                href={confirmedData.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline text-sm break-all"
              >
                {confirmedData.meetingLink}
              </a>
            </div>
          )}

          {/* Add to Calendar */}
          <div>
            <p className="text-sm font-medium mb-2">{t('sched.addToCalendar')}</p>
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

          {/* Manage Booking Links */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('scheduling.rescheduleNote')}{' '}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild variant="outline" size="sm">
                <a href={`/book/reschedule?token=${encodeURIComponent(token)}`}>
                  {t('scheduling.rescheduleAppointment')}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/book/cancel?token=${encodeURIComponent(token)}`}>
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

  // Pending state - show confirm button
  if (pendingData) {
    const { date, time } = formatDateTime(pendingData.startTime, pendingData.timezone);
    const expiresAt = new Date(pendingData.expiresAt);
    const isExpired = expiresAt < new Date(Date.now() - 60 * 60 * 1000);

    if (isExpired) {
      return (
        <Card className="mx-auto max-w-lg">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-semibold">{t('sched.linkExpired')}</h2>
              <p className="mt-2 text-muted-foreground">
                {t('sched.linkExpiredDesc')}
              </p>
              <Button asChild className="mt-6">
                <a href={bookCallHref}>{t('sched.bookNew')}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('sched.confirmTitle')}</CardTitle>
          <CardDescription>
            {t('sched.confirmDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Booking Details */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('sched.service')}</span>
              <span className="font-medium">{pendingData.service?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('sched.duration')}</span>
              <span className="font-medium">{pendingData.service?.duration} {t('sched.minutes')}</span>
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

          {/* Guest Info */}
          <div className="text-sm text-muted-foreground">
            <p>{t('sched.bookingFor')} <span className="text-foreground">{pendingData.guestName}</span></p>
            <p>{t('sched.emailLabel')} <span className="text-foreground">{pendingData.guestEmail}</span></p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={status === 'confirming'}
            className="w-full"
            size="lg"
          >
            {status === 'confirming' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('sched.confirming')}
              </>
            ) : (
              t('sched.confirmButton')
            )}
          </Button>

          {/* Change time option - passes token so old booking gets cancelled */}
          <div className="text-center">
            <a
              href={`${bookCallHref}?cancelToken=${encodeURIComponent(token)}`}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t('sched.changeTime')}
            </a>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t('sched.agreeNote')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}

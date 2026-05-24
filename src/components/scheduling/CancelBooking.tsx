import { useState, useEffect } from 'react';
import { XCircle, Loader2, Calendar, Clock, User, CheckCircle2, AlertTriangle } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export function CancelBooking({ token, lang = 'en' }: CancelBookingProps) {
  const t = useTranslations(lang);
  const bookCallHref = lang === 'es' ? '/es/book-strategy-call' : '/book-strategy-call';
  const homeHref = lang === 'es' ? '/es' : '/';
  const [status, setStatus] = useState<Status>('loading');
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const locale = lang === 'en' ? 'en-US' : 'es-ES';

  // Fetch booking details
  useEffect(() => {
    async function fetchBooking() {
      try {
        const response = await fetch(`/api/nylas/cancel-booking/?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || t('error.tryAgain'));
          setStatus('error');
          return;
        }

        setBookingData(data.data);

        if (data.data.status === 'cancelled') {
          setStatus('already_cancelled');
        } else if (data.data.status !== 'confirmed') {
          setError(t('scheduling.appointmentNotFound'));
          setStatus('error');
        } else {
          setStatus('loaded');
        }
      } catch {
        setError(t('error.tryAgain'));
        setStatus('error');
      }
    }

    fetchBooking();
  }, [token, t]);

  const handleCancel = async () => {
    setStatus('confirming');
    setError(null);

    try {
      const response = await fetch('/api/nylas/cancel-booking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || t('error.tryAgain'));
        setStatus('loaded');
        return;
      }

      setStatus('cancelled');
    } catch {
      setError(t('error.tryAgain'));
      setStatus('loaded');
    }
  };

  const formatDateTime = (isoString: string, timezone: string) => {
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

  // Already cancelled
  if (status === 'already_cancelled') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-semibold">{t('scheduling.cancellationConfirmed')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('scheduling.cancellationNote')}
            </p>
            <Button asChild variant="outline" className="mt-6">
              <a href={bookCallHref}>{t('scheduling.bookAnotherCall')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Successfully cancelled
  if (status === 'cancelled') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">{t('scheduling.cancellationConfirmed')}</CardTitle>
          <CardDescription>
            {t('scheduling.cancellationNote')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" size="lg">
              <a href={bookCallHref}>{t('scheduling.bookAnotherCall')}</a>
            </Button>
            <Button asChild size="lg">
              <a href="/">{t('scheduling.returnHome')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loaded — show booking details with cancel option
  if (bookingData) {
    const { date, time } = formatDateTime(bookingData.startTime, bookingData.timezone);

    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">{t('scheduling.cancelAppointment')}</CardTitle>
          <CardDescription>
            {t('scheduling.yourAppointment')}
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
            {bookingData.service && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-brand" />
                <p>{bookingData.service.name} ({bookingData.service.duration} {t('scheduling.minutes')})</p>
              </div>
            )}
            {bookingData.teamMember && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-brand" />
                <p>{bookingData.teamMember.name}</p>
              </div>
            )}
          </div>

          {/* Cancel confirmation dialog */}
          {!showConfirm ? (
            <div className="space-y-3">
              <Button
                variant="destructive"
                className="w-full"
                size="lg"
                onClick={() => setShowConfirm(true)}
              >
                {t('scheduling.cancelAppointment')}
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <a href="/">{t('scheduling.keepAppointment')}</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                {t('scheduling.confirmCancel')}
              </p>

              {/* Optional reason */}
              <div>
                <label
                  htmlFor="cancel-reason"
                  className="block text-sm text-muted-foreground mb-1"
                >
                  {t('scheduling.cancelReason')}
                </label>
                <textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('scheduling.cancelReasonPlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirm(false)}
                  disabled={status === 'confirming'}
                >
                  {t('scheduling.keepAppointment')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
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

  return null;
}

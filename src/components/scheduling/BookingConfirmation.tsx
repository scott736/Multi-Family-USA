'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, Clock, Download, ExternalLink,Video } from '@/components/ui/icons';
import { useTranslations } from '@/i18n/utils';
import { trackConversion } from '@/lib/analytics';
import type { BookingConfirmation as BookingConfirmationType } from '@/lib/nylas/types';
import { cn } from '@/lib/utils';

interface BookingConfirmationProps {
  booking: BookingConfirmationType;
  timezone: string;
  onBookAnother?: () => void;
  lang?: 'en' | 'es';
  className?: string;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX' };

export function BookingConfirmation({
  booking,
  timezone,
  onBookAnother,
  lang = 'en',
  className,
}: BookingConfirmationProps) {
  const t = useTranslations(lang);
  const locale = LOCALE_MAP[lang] || 'en-CA';

  useEffect(() => {
    trackConversion('strategy_call_booked', {
      service: booking.service.name,
      team_member: booking.teamMember.name,
    });
  }, [booking.service.name, booking.teamMember.name]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  };

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden shadow-sm max-w-5xl mx-auto', className)}>
      <div className="flex flex-col lg:flex-row lg:divide-x divide-y lg:divide-y-0">
        {/* Left Panel - Booking Summary */}
        <div className="p-5 lg:p-8 lg:w-[320px] lg:shrink-0 bg-gradient-to-b from-muted/30 to-transparent flex flex-col">
          {/* Team Member */}
          <div className="flex items-center gap-4">
            {booking.teamMember.photo && (
              <img
                src={booking.teamMember.photo}
                alt={booking.teamMember.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-background shadow-md"
                loading="lazy"
                decoding="async"
              />
            )}
            <div>
              <p className="font-semibold text-lg">{booking.teamMember.name}</p>
              <p className="text-sm text-muted-foreground">{booking.teamMember.title}</p>
            </div>
          </div>

          {/* Booking Details */}
          <div className="flex-1 flex flex-col justify-center py-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <Calendar className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{formatDate(booking.startTime)}</p>
                  <p className="text-xs text-muted-foreground">{t('scheduling.dateLabel')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <Clock className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{formatTime(booking.startTime)} · {booking.service.duration} min</p>
                  <p className="text-xs text-muted-foreground">{t('scheduling.timeDuration')}</p>
                </div>
              </div>
              {booking.meetingLink && (
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                    <Video className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <a
                      href={booking.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand hover:underline flex items-center gap-1"
                    >
                      {t('scheduling.joinMeeting')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-xs text-muted-foreground">{t('scheduling.videoCall')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Name */}
          <div className="pt-6 border-t">
            <p className="text-sm text-muted-foreground">{t('scheduling.serviceLabel')}</p>
            <p className="font-medium">{booking.service.name}</p>
          </div>
        </div>

        {/* Right Panel - Confirmation */}
        <div className="p-5 lg:p-8 lg:flex-1 flex flex-col">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
              <CheckCircle2 className="h-10 w-10 text-brand" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{t('scheduling.bookingConfirmed')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('scheduling.confirmationEmailNote')}
            </p>
          </div>

          {/* Add to Calendar */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-4 text-center">{t('scheduling.addToCalendar')}</h3>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline" size="lg">
                <a
                  href={booking.calendarLinks.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 22h-15A2.503 2.503 0 012 19.5v-15A2.503 2.503 0 014.5 2h15A2.503 2.503 0 0122 4.5v15a2.503 2.503 0 01-2.5 2.5zM9.5 6.5A1.502 1.502 0 008 8v8c0 .827.673 1.5 1.5 1.5h5c.827 0 1.5-.673 1.5-1.5v-3h-1v3a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5V8a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v3h1V8c0-.827-.673-1.5-1.5-1.5h-5z"/>
                  </svg>
                  Google
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href={booking.calendarLinks.outlook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V5.8l-.02.04v6.16z"/>
                  </svg>
                  Outlook
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href={booking.calendarLinks.ical}
                  download={`${booking.service.name.replace(/\s+/g, '-')}.ics`}
                  className="gap-2"
                >
                  <Download className="h-5 w-5" />
                  {t('scheduling.icsFile')}
                </a>
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onBookAnother && (
                <Button variant="outline" size="lg" onClick={onBookAnother}>
                  {t('scheduling.bookAnother')}
                </Button>
              )}
              <Button asChild size="lg">
                <a href="/">{t('scheduling.returnHome')}</a>
              </Button>
            </div>

            {/* Help Note */}
            <p className="text-muted-foreground text-center text-sm">
              {t('scheduling.rescheduleNote')}{' '}
              <a href={lang === 'es' ? '/es/contact' : '/contact'} className="text-brand hover:underline">
                {t('scheduling.contactUs')}
              </a>
              . {t('scheduling.confirmationEmailNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

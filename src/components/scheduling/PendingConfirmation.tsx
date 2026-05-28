'use client';

import { Mail, Clock, Calendar, User, CheckCircle2 } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n/utils';
import type { TeamMember } from '@/lib/nylas/types';

interface PendingConfirmationProps {
  email: string;
  serviceName: string;
  teamMember: TeamMember;
  startTime: Date;
  duration: number;
  expiresAt: Date;
  timezone: string;
  onBookAnother?: () => void;
  lang?: 'en' | 'es';
  className?: string;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX' };

export function PendingConfirmation({
  email,
  serviceName,
  teamMember,
  startTime,
  duration,
  expiresAt,
  timezone,
  onBookAnother,
  lang = 'en',
  className,
}: PendingConfirmationProps) {
  const t = useTranslations(lang);
  const locale = LOCALE_MAP[lang] || 'en-CA';

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

  const formatExpiry = (date: Date): string => {
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
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
            {teamMember.photo && (
              <img
                src={teamMember.photo}
                alt={teamMember.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-background shadow-md"
                loading="lazy"
                decoding="async"
              />
            )}
            <div>
              <p className="font-semibold text-lg">{teamMember.name}</p>
              <p className="text-sm text-muted-foreground">{teamMember.title}</p>
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
                  <p className="font-medium">{formatDate(startTime)}</p>
                  <p className="text-xs text-muted-foreground">{t('scheduling.dateLabel')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <Clock className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{formatTime(startTime)} · {duration} min</p>
                  <p className="text-xs text-muted-foreground">{t('scheduling.timeDuration')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Name */}
          <div className="pt-6 border-t">
            <p className="text-sm text-muted-foreground">{t('scheduling.serviceLabel')}</p>
            <p className="font-medium">{serviceName}</p>
          </div>
        </div>

        {/* Right Panel - Email Confirmation */}
        <div className="p-5 lg:p-8 lg:flex-1 flex flex-col">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
              <Mail className="h-10 w-10 text-brand" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{t('scheduling.checkYourEmail')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('scheduling.sentConfirmationTo')} <strong className="text-foreground">{email}</strong>
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex gap-4 p-4 rounded-xl bg-muted/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-semibold">{t('scheduling.checkInbox')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('scheduling.checkInboxDesc').replace('{serviceName}', serviceName)}
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-4 rounded-xl bg-muted/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-semibold">{t('scheduling.clickConfirmLink')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('scheduling.clickConfirmLinkDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Expiry Warning */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 mb-8">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{t('scheduling.important')}</strong> {t('scheduling.linkExpiresOn').replace('{expiry}', formatExpiry(expiresAt))}{' '}
              {t('scheduling.needToBookAgain')}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-auto space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {t('scheduling.didntReceiveEmail')}
                {onBookAnother && (
                  <>
                    {' '}{t('scheduling.or')}{' '}
                    <button
                      type="button"
                      onClick={onBookAnother}
                      className="text-brand hover:underline font-medium"
                    >
                      {t('scheduling.tryBookingAgain')}
                    </button>
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-center">
              <Button asChild variant="outline" size="lg">
                <a href="/">{t('scheduling.returnHome')}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

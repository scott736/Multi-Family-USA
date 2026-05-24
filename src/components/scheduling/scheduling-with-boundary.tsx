import * as React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SchedulingWidget } from '@/components/scheduling/SchedulingWidget';
import { ProfileScheduler } from '@/components/scheduling/ProfileScheduler';
import type { Service, TeamMember } from '@/lib/nylas/types';
import { useTranslations } from '@/i18n/utils';

interface SchedulingWidgetWithBoundaryProps {
  services: Service[];
  teamMembers: TeamMember[];
  initialServiceId?: string;
  initialTeamMemberId?: string;
  cancelToken?: string;
  className?: string;
  lang?: 'en' | 'es';
}

export function SchedulingWidgetWithBoundary({ lang = 'en', ...props }: SchedulingWidgetWithBoundaryProps) {
  const t = useTranslations(lang);
  const contactHref = lang === 'es' ? '/es/contact' : '/contact';

  const fallback = (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <p className="font-semibold text-destructive mb-2">{t('error.title')}</p>
      <p className="text-sm text-muted-foreground mb-4">
        {t('error.message')}{' '}
        <a href={contactHref} className="text-brand-text hover:underline">{t('error.contact')}</a>
        {t('error.help')}
      </p>
      <a href={contactHref} className="text-sm text-brand-text hover:underline">
        {t('nav.contact')}
      </a>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <SchedulingWidget lang={lang} {...props} />
    </ErrorBoundary>
  );
}

interface ProfileSchedulerWithBoundaryProps {
  teamMember: TeamMember;
  defaultService: Service;
  className?: string;
  duration?: number;
  lang?: 'en' | 'es';
}

export function ProfileSchedulerWithBoundary({ lang = 'en', ...props }: ProfileSchedulerWithBoundaryProps) {
  const t = useTranslations(lang);
  const contactHref = lang === 'es' ? '/es/contact' : '/contact';

  const fallback = (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <p className="font-semibold text-destructive mb-2">{t('error.title')}</p>
      <p className="text-sm text-muted-foreground mb-4">
        {t('error.message')}{' '}
        <a href={contactHref} className="text-brand-text hover:underline">{t('error.contact')}</a>
        {t('error.help')}
      </p>
      <a href={contactHref} className="text-sm text-brand-text hover:underline">
        {t('nav.contact')}
      </a>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <ProfileScheduler lang={lang} {...props} />
    </ErrorBoundary>
  );
}

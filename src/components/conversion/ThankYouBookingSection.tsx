'use client';

import { SchedulingWidgetWithBoundary } from '@/components/scheduling/scheduling-with-boundary';
import type { Service, TeamMember } from '@/lib/nylas/types';

interface ThankYouBookingSectionProps {
  services: Service[];
  teamMembers: TeamMember[];
  assignedOfficerId?: string;
  guestName?: string;
  lang?: 'en' | 'es';
}

export function ThankYouBookingSection({
  services,
  teamMembers,
  assignedOfficerId,
  guestName,
  lang = 'en',
}: ThankYouBookingSectionProps) {
  const isEs = lang === 'es';
  const firstName = guestName?.split(' ')[0] ?? (isEs ? 'inversor' : 'there');

  return (
    <div className="mt-8 rounded-xl border border-accent/30 bg-card p-6 md:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-accent">
        {isEs ? 'Siguiente paso recomendado' : 'Recommended next step'}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">
        {isEs
          ? `${firstName}, reserve 30 minutos mientras preparamos su lectura`
          : `${firstName}, lock in 30 minutes while we prepare your read`}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isEs
          ? 'Su revisión está en cola. Una llamada en vivo acelera decisiones de estructura, timing y encaje con prestamistas.'
          : 'Your review is in queue. A live call speeds up structure, timing, and lender-fit decisions.'}
      </p>
      <div className="mt-6">
        <SchedulingWidgetWithBoundary
          services={services}
          teamMembers={teamMembers}
          initialServiceId="strategy-call"
          initialTeamMemberId={assignedOfficerId}
          lang={lang}
        />
      </div>
    </div>
  );
}

'use client';

import { CheckCircle2, Clock, Globe, Lock } from '@/components/ui/icons';
import { useTranslations } from '@/i18n/utils';
import type { Service, TeamMember } from '@/lib/nylas/types';
import { cn } from '@/lib/utils';

interface ServiceSelectorProps {
  services: Service[];
  teamMembers: TeamMember[];
  selectedService: Service | null;
  onSelect: (service: Service | null) => void;
  timezone?: string;
  lang?: 'en' | 'es';
  className?: string;
}

export function ServiceSelector({
  services,
  teamMembers,
  selectedService,
  onSelect,
  timezone = 'America/New_York',
  lang = 'en',
  className,
}: ServiceSelectorProps) {
  const t = useTranslations(lang);

  const BENEFITS = [
    { title: t('scheduling.benefit100Free'), desc: t('scheduling.benefitNoObligation') },
    { title: t('scheduling.benefitExpertAdvice'), desc: t('scheduling.benefitInvestmentSpecialists') },
    { title: t('scheduling.benefitPersonalized'), desc: t('scheduling.benefitTailoredStrategy') },
    { title: t('scheduling.benefitFastApproval'), desc: t('scheduling.benefitFastApprovalDesc') },
  ];
  const filteredServices = services.filter((s) => s.region === 'usa');
  const isOtherServiceSelected = selectedService && selectedService.id !== 'strategy-call';

  const getTeamMembersForService = (service: Service): TeamMember[] => {
    return teamMembers.filter((member) => service.teamMembers.includes(member.id));
  };

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden shadow-sm max-w-6xl mx-auto', className)}>
      {/* Main Content */}
      <div className="grid lg:grid-cols-[280px_1px_1fr]">
        {/* Left Panel - Service Info */}
        <div className="p-5 lg:p-8 bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight">{t('scheduling.freeStrategyCall')}</h3>

              {isOtherServiceSelected && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand">{selectedService.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedService.description}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedService ? `${selectedService.duration}m` : '15-60m'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{timezone.replace('_', '/')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4">
              <Lock className="h-3 w-3" />
              <span>{t('scheduling.securePrivate')}</span>
            </div>
          </div>
        </div>

        {/* Divider - horizontal on mobile, vertical on desktop */}
        <div className="h-px lg:h-full bg-border" />

        {/* Right Panel - Services */}
        <div className="p-5 lg:p-8 overflow-y-auto">
          {/* Services 2-Column Grid */}
          {filteredServices.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                {t('scheduling.noServicesAvailable')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredServices.map((service) => {
                const members = getTeamMembersForService(service);
                const isSelected = selectedService?.id === service.id;

                return (
                  <button
                    key={service.id}
                    className={cn(
                      'p-4 rounded-md border-2 text-left h-full',
                      isSelected
                        ? 'border-brand bg-brand/10'
                        : 'border-border hover:border-brand/50 hover:bg-muted/30'
                    )}
                    onClick={() => onSelect(service)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "font-semibold text-sm",
                          isSelected && "text-brand"
                        )}>{service.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {service.duration}m
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-foreground shrink-0">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Banner - Benefits */}
      <div className="border-t bg-muted/20 px-4 py-2.5">
        <div className="flex items-center justify-center gap-x-3 whitespace-nowrap overflow-x-auto">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-brand shrink-0" />
              <span className="text-[11px]">
                <span className="font-medium">{benefit.title}</span>
                <span className="text-muted-foreground hidden sm:inline"> – {benefit.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

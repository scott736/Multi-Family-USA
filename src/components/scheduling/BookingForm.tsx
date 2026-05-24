'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Calendar, Clock, Loader2, Phone, User, Video } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { GuestInfo, Service, TeamMember, TimeSlot, MeetingType } from '@/lib/nylas/types';

import { useTranslations } from '@/i18n/utils';

const MEETING_TYPE_OPTIONS = (t: any): { type: MeetingType; label: string; description: string }[] => [
  { type: 'phone', label: t('sched.phoneCall'), description: t('sched.phoneCallDesc') },
  { type: 'teams', label: t('sched.teams'), description: t('sched.teamsDesc') },
];

const formSchema = (t: any) => z.object({
  name: z.string().min(2, t('calc.lead.error.name')).max(100),
  email: z.string().email(t('calc.lead.error.email')),
  phone: z.string().min(7, t('sched.phoneError') || 'Please enter a valid phone number'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  website: z.string().optional(), // Honeypot
});

type FormData = z.infer<ReturnType<typeof formSchema>>;

interface BookingFormProps {
  service: Service;
  teamMember: TeamMember;
  selectedSlot: TimeSlot;
  timezone: string;
  onSubmit: (guestInfo: GuestInfo) => Promise<void>;
  onBack: () => void;
  className?: string;
  selectedMeetingType?: MeetingType;
  onMeetingTypeChange?: (type: MeetingType) => void;
  lang?: 'en' | 'es';
}

export function BookingForm({
  service,
  teamMember,
  selectedSlot,
  timezone,
  onSubmit,
  onBack,
  className,
  selectedMeetingType,
  onMeetingTypeChange,
  lang = 'en',
}: BookingFormProps) {
  const t = useTranslations(lang);
  const options = MEETING_TYPE_OPTIONS(t);
  const schema = formSchema(t);

  // Filter available meeting types based on service config
  const availableMeetingTypes = service.meetingTypes
    ? options.filter(opt => service.meetingTypes?.includes(opt.type))
    : [];
  const showMeetingTypeSelector = availableMeetingTypes.length > 1 && onMeetingTypeChange;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES' };
  const locale = LOCALE_MAP[lang] || 'en-US';

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).toLowerCase();
  };

  const handleFormSubmit = async (data: FormData) => {
    // Honeypot check
    if (data.website) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit({
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('error.tryAgain'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden shadow-sm max-w-6xl mx-auto', className)}>
      <div className="flex flex-col lg:flex-row lg:divide-x divide-y lg:divide-y-0">
        {/* Left Panel - Booking Summary */}
        <div className="p-5 lg:p-8 lg:w-[320px] lg:shrink-0 bg-gradient-to-b from-muted/30 to-transparent flex flex-col">
          {/* Team Member - fixed at top */}
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

          {/* Booking Details - centered in remaining space */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <Calendar className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{formatDate(selectedSlot.startTime)}</p>
                  <p className="text-xs text-muted-foreground">{t('sched.date')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <Clock className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{formatTime(selectedSlot.startTime)} · {service.duration} {t('sched.minutes')}</p>
                  <p className="text-xs text-muted-foreground">{t('sched.duration')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Meeting Type Selector (if multiple options) - at bottom */}
          {showMeetingTypeSelector && (
            <div className="space-y-3 pt-6 mt-6 border-t">
              <p className="text-sm font-medium">{t('sched.meetingFormat')}</p>
              <div className="grid grid-cols-2 gap-2">
                {availableMeetingTypes.map((option) => {
                  const isSelected = selectedMeetingType === option.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => onMeetingTypeChange?.(option.type)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-md border-2   text-center',
                        isSelected
                          ? 'border-brand bg-brand/5'
                          : 'border-border hover:border-brand/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {option.type === 'phone' ? (
                          <Phone className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Video className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{option.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Form */}
        <div className="p-5 lg:p-8 lg:flex-1">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{t('sched.yourInfo')}</h2>
            <p className="text-muted-foreground mt-1">{t('sched.infoDesc')}</p>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
            {/* Honeypot field - hidden from users */}
            <input
              type="text"
              {...register('website' as any)}
              className="absolute left-[-9999px]"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {t('sched.fullName')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="John Doe"
                  className="pl-10"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                />
              </div>
              {errors.name && (
                <p className="text-destructive text-sm">{errors.name.message as string}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t('sched.email')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  className="pl-10"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email.message as string}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                {t('sched.phone')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="pl-10"
                  {...register('phone')}
                  aria-invalid={!!errors.phone}
                />
              </div>
              {errors.phone && (
                <p className="text-destructive text-sm">{errors.phone.message as string}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                {t('sched.notes')} <span className="text-muted-foreground font-normal text-xs">({t('sched.optional') || 'optional'})</span>
              </Label>
              <Textarea
                id="notes"
                placeholder={t('sched.notesPlaceholder')}
                rows={3}
                className="resize-none"
                {...register('notes')}
                aria-invalid={!!errors.notes}
              />
              {errors.notes && (
                <p className="text-destructive text-sm">{errors.notes.message as string}</p>
              )}
            </div>

            {submitError && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                {submitError}
              </div>
            )}

            <div className="pt-4">
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('sched.booking')}
                  </>
                ) : (
                  t('sched.confirm')
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                {t('sched.successNote')}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

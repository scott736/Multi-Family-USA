'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Globe, CalendarDays } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n/utils';
import type { TimeSlot, DayAvailability, Service, TeamMember } from '@/lib/nylas/types';

interface AvailabilityPickerProps {
  service: Service;
  teamMember?: TeamMember;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  timezone: string;
  lang?: 'en' | 'es';
  className?: string;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES' };

export function AvailabilityPicker({
  service,
  teamMember,
  selectedSlot,
  onSelectSlot,
  timezone,
  lang = 'en',
  className,
}: AvailabilityPickerProps) {
  const t = useTranslations(lang);
  const locale = LOCALE_MAP[lang] || 'en-CA';

  const WEEKDAYS = [
    t('scheduling.weekdaySun'),
    t('scheduling.weekdayMon'),
    t('scheduling.weekdayTue'),
    t('scheduling.weekdayWed'),
    t('scheduling.weekdayThu'),
    t('scheduling.weekdayFri'),
    t('scheduling.weekdaySat'),
  ];
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DayAvailability>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Calculate the calendar grid for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  const fetchAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const startDate = calendarDays[0];
      const endDate = calendarDays[calendarDays.length - 1];
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      let data;

      // Check for prefetched data (from inline script)
      const prefetch = (window as { __availabilityPrefetch?: Promise<unknown> }).__availabilityPrefetch;
      if (prefetch) {
        // Use prefetched data and clear it
        data = await prefetch;
        delete (window as { __availabilityPrefetch?: Promise<unknown> }).__availabilityPrefetch;
      }

      // If no prefetch or it failed, fetch normally
      if (!data) {
        const response = await fetch('/api/nylas/availability/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: service.id,
            teamMemberId: teamMember?.id,
            startDate: startDateStr,
            endDate: endDateStr,
            timezone,
            duration: service.duration,
          }),
        });
        data = await response.json();

        if (response.status === 429) {
          throw new Error('Please wait a moment before refreshing the calendar.');
        }
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to load availability');
      }

      const newMap = new Map<string, DayAvailability>();
      for (const day of data.data.days) {
        newMap.set(day.date, day);
      }
      setAvailabilityMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability');
    } finally {
      setIsLoading(false);
    }
  }, [service.id, teamMember?.id, timezone, calendarDays]);

  // Fetch availability when month changes
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Auto-select first available date when data loads (only if no date selected)
  useEffect(() => {
    if (!selectedDate && availabilityMap.size > 0) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
      const days = Array.from(availabilityMap.values());
      const firstAvailable = days.find(d => d.hasAvailability && d.date >= today);
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date);
      }
    }
  }, [availabilityMap, selectedDate]);

  const formatSelectedDate = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
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

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const isPreviousMonthDisabled = currentMonth <= new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const selectedDayData = selectedDate ? availabilityMap.get(selectedDate) : null;
  const selectedDaySlots = selectedDayData?.slots || [];

  if (error) {
    return (
      <div className={cn('rounded-2xl border bg-card p-10 text-center shadow-sm', className)}>
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchAvailability} variant="outline">
          {t('scheduling.tryAgain')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden shadow-sm max-w-6xl mx-auto', className)}>
      <div className="flex flex-col lg:flex-row lg:divide-x divide-y lg:divide-y-0">
        {/* Left Panel - Meeting Info */}
        <div className="p-5 lg:p-8 space-y-4 lg:space-y-8 lg:w-[320px] lg:shrink-0 bg-gradient-to-b from-muted/30 to-transparent">
          {teamMember && (
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
          )}

          <div className="space-y-3">
            <h3 className="text-2xl font-bold tracking-tight">{service.name}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {teamMember
                ? t('scheduling.discussGoals').replace('{name}', teamMember.name.split(' ')[0])
                : service.description}
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{service.duration} {t('scheduling.minutes')}</p>
                <p className="text-xs text-muted-foreground">{t('scheduling.duration')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{timezone.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">{t('scheduling.timezone')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Calendar */}
        <div className="p-5 lg:p-8 lg:flex-1 min-w-0 lg:min-w-[380px]">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xl font-bold">
              {currentMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </h4>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={goToPreviousMonth}
                disabled={isPreviousMonthDisabled || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={goToNextMonth}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center py-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{day}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid - Always visible, availability loads in background */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dateStr = day.toLocaleDateString('en-CA', { timeZone: timezone });
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = dateStr === today;
              const isPast = dateStr < today;
              const isSelected = selectedDate === dateStr;
              const dayData = availabilityMap.get(dateStr);

              // During initial load, show current month dates as potentially clickable
              const hasAvailability = isLoading && availabilityMap.size === 0
                ? (isCurrentMonth && !isPast) // Assume available while loading
                : (dayData?.hasAvailability && !isPast);

              return (
                <button
                  key={dateStr}
                  onClick={() => hasAvailability && !isLoading && setSelectedDate(dateStr)}
                  disabled={!hasAvailability || isLoading}
                  className={cn(
                    'relative aspect-square flex items-center justify-center text-sm font-medium rounded-md  ',
                    !isCurrentMonth && 'text-muted-foreground/25',
                    // During loading, show neutral styling for current month dates
                    isLoading && availabilityMap.size === 0 && isCurrentMonth && !isPast && 'text-foreground',
                    // After loaded, apply availability styling
                    !isLoading && isCurrentMonth && !hasAvailability && 'text-muted-foreground/40',
                    !isLoading && hasAvailability && !isSelected && 'text-foreground hover:bg-brand/10 hover:text-brand',
                    isSelected && 'bg-brand text-black shadow-md scale-105',
                    !hasAvailability && 'cursor-default',
                    isToday && !isSelected && 'ring-2 ring-brand/30 font-bold'
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Time Slots */}
        <div className="p-5 lg:p-8 lg:w-[320px] lg:shrink-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h4 className="text-lg font-bold">
                {selectedDate ? formatShortDate(selectedDate) : t('scheduling.availableTimes')}
              </h4>
            </div>
            {isLoading && availabilityMap.size === 0 ? (
              <p className="text-sm text-muted-foreground">{t('scheduling.loadingAvailability')}</p>
            ) : selectedDate ? (
              <p className="text-sm text-muted-foreground">
                {t('scheduling.timesAvailable').replace('{count}', String(selectedDaySlots.length))}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('scheduling.selectDate')}</p>
            )}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {/* Show skeleton time slots during initial load */}
            {isLoading && availabilityMap.size === 0 ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="w-full px-4 py-3.5 rounded-md border-2 border-border bg-muted/30 animate-pulse"
                  >
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : !selectedDate ? (
              <div className="text-center py-12">
                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {t('scheduling.chooseDatePrompt')}
                </p>
              </div>
            ) : selectedDaySlots.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {t('scheduling.noTimesAvailable')}
                </p>
              </div>
            ) : (
              selectedDaySlots.map((slot, index) => {
                const isSelected =
                  selectedSlot?.startTime === slot.startTime &&
                  selectedSlot?.teamMemberId === slot.teamMemberId;

                return (
                  <button
                    key={`${slot.startTime}-${slot.teamMemberId}-${index}`}
                    onClick={() => onSelectSlot(slot)}
                    className={cn(
                      'w-full px-4 py-3.5 rounded-md border-2 text-sm font-semibold  ',
                      isSelected
                        ? 'border-brand bg-brand text-black shadow-md hover:bg-brand/90'
                        : 'border-border bg-background hover:border-brand hover:bg-brand/5'
                    )}
                  >
                    {formatTime(slot.startTime)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected Time Footer */}
      {selectedSlot && (
        <div className="border-t bg-gradient-to-r from-primary/5 to-muted/30 px-5 py-4 lg:px-8 lg:py-6">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3 lg:gap-5">
              <div className="flex h-10 w-10 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/10 shrink-0">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base lg:text-lg truncate">
                  {formatSelectedDate(selectedSlot.startTime.split('T')[0])}
                </p>
                <p className="text-muted-foreground">
                  {formatTime(selectedSlot.startTime)} · {service.duration} {t('scheduling.minutes')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

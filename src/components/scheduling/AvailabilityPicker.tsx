'use client';

import { useCallback, useMemo, useReducer, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Globe } from '@/components/ui/icons';
import { useTranslations } from '@/i18n/utils';
import type { DayAvailability, Service, TeamMember, TimeSlot } from '@/lib/nylas/types';
import { cn } from '@/lib/utils';

interface AvailabilityPickerProps {
  service: Service;
  teamMember?: TeamMember;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  timezone: string;
  lang?: 'en' | 'es';
  className?: string;
}

interface AvailabilityState {
  availabilityMap: Map<string, DayAvailability>;
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
  currentMonth: Date;
  pendingRequestKey: string | null;
}

type AvailabilityAction =
  | { type: 'setMonth'; payload: Date }
  | { type: 'setSelectedDate'; payload: string }
  | { type: 'fetchStarted'; payload: string }
  | { type: 'fetchSucceeded'; payload: { requestKey: string; map: Map<string, DayAvailability> } }
  | { type: 'fetchFailed'; payload: { requestKey: string; message: string } };

interface AvailabilityApiResponse {
  success: boolean;
  error?: string;
  data: {
    days: DayAvailability[];
  };
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES' };

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getCalendarDaysForMonth(month: Date): Date[] {
  const year = month.getFullYear();
  const monthNumber = month.getMonth();
  const firstDay = new Date(year, monthNumber, 1);
  const lastDay = new Date(year, monthNumber + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(lastDay);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }

  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function toDateKey(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

function getRangeForMonth(month: Date, timezone: string) {
  const calendarDays = getCalendarDaysForMonth(month);
  const startDateStr = toDateKey(calendarDays[0], timezone);
  const endDateStr = toDateKey(calendarDays[calendarDays.length - 1], timezone);
  return { calendarDays, startDateStr, endDateStr };
}

function buildRequestKey({
  serviceId,
  serviceDuration,
  teamMemberId,
  timezone,
  month,
}: {
  serviceId: string;
  serviceDuration: number;
  teamMemberId: string | null;
  timezone: string;
  month: Date;
}) {
  return [
    serviceId,
    serviceDuration,
    teamMemberId ?? 'none',
    timezone,
    month.getFullYear(),
    month.getMonth(),
  ].join(':');
}

function createInitialState(): AvailabilityState {
  return {
    availabilityMap: new Map(),
    selectedDate: null,
    isLoading: true,
    error: null,
    currentMonth: getMonthStart(new Date()),
    pendingRequestKey: null,
  };
}

function availabilityReducer(state: AvailabilityState, action: AvailabilityAction): AvailabilityState {
  switch (action.type) {
    case 'setMonth':
      return {
        ...state,
        currentMonth: action.payload,
        selectedDate: null,
      };
    case 'setSelectedDate':
      return {
        ...state,
        selectedDate: action.payload,
      };
    case 'fetchStarted':
      return {
        ...state,
        isLoading: true,
        error: null,
        pendingRequestKey: action.payload,
      };
    case 'fetchSucceeded':
      if (state.pendingRequestKey !== action.payload.requestKey) {
        return state;
      }
      return {
        ...state,
        isLoading: false,
        error: null,
        availabilityMap: action.payload.map,
      };
    case 'fetchFailed':
      if (state.pendingRequestKey !== action.payload.requestKey) {
        return state;
      }
      return {
        ...state,
        isLoading: false,
        error: action.payload.message,
      };
  }
}

function MeetingInfoPanel({
  teamMember,
  service,
  timezone,
  discussionText,
  durationLabel,
  durationCaption,
  timezoneCaption,
}: {
  teamMember?: TeamMember;
  service: Service;
  timezone: string;
  discussionText: string;
  durationLabel: string;
  durationCaption: string;
  timezoneCaption: string;
}) {
  return (
    <div className="space-y-4 bg-gradient-to-b from-muted/30 to-transparent p-5 lg:w-[320px] lg:shrink-0 lg:space-y-8 lg:p-8">
      {teamMember && (
        <div className="flex items-center gap-4">
          {teamMember.photo && (
            <img
              src={teamMember.photo}
              alt={teamMember.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-background shadow-md"
              loading="lazy"
              decoding="async"
            />
          )}
          <div>
            <p className="text-lg font-semibold">{teamMember.name}</p>
            <p className="text-sm text-muted-foreground">{teamMember.title}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-2xl font-bold tracking-tight">{service.name}</h3>
        <p className="leading-relaxed text-muted-foreground">{discussionText}</p>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{durationLabel}</p>
            <p className="text-xs text-muted-foreground">{durationCaption}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{timezone.replace('_', ' ')}</p>
            <p className="text-xs text-muted-foreground">{timezoneCaption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarPanel({
  locale,
  weekdays,
  currentMonth,
  calendarDays,
  availabilityMap,
  timezone,
  today,
  selectedDate,
  isLoading,
  isPreviousMonthDisabled,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
}: {
  locale: string;
  weekdays: string[];
  currentMonth: Date;
  calendarDays: Date[];
  availabilityMap: Map<string, DayAvailability>;
  timezone: string;
  today: string;
  selectedDate: string | null;
  isLoading: boolean;
  isPreviousMonthDisabled: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateStr: string) => void;
}) {
  return (
    <div className="min-w-0 p-5 lg:min-w-[380px] lg:flex-1 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <h4 className="text-xl font-bold">
          {currentMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </h4>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onPreviousMonth}
            disabled={isPreviousMonthDisabled || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onNextMonth}
            disabled={isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7">
        {weekdays.map((day) => (
          <div key={day} className="py-3 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateStr = day.toLocaleDateString('en-CA', { timeZone: timezone });
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          const isSelected = selectedDate === dateStr;
          const dayData = availabilityMap.get(dateStr);
          const hasAvailability =
            isLoading && availabilityMap.size === 0
              ? isCurrentMonth && !isPast
              : !!dayData?.hasAvailability && !isPast;

          return (
            <button
              type="button"
              key={dateStr}
              onClick={() => {
                if (hasAvailability && !isLoading) {
                  onSelectDate(dateStr);
                }
              }}
              disabled={!hasAvailability || isLoading}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-md text-sm font-medium',
                !isCurrentMonth && 'text-foreground/25',
                isLoading && availabilityMap.size === 0 && isCurrentMonth && !isPast && 'text-foreground',
                !isLoading && isCurrentMonth && !hasAvailability && 'text-foreground/35',
                !isLoading &&
                  hasAvailability &&
                  !isSelected &&
                  'text-foreground hover:bg-brand/10 hover:text-brand',
                isSelected && 'scale-105 bg-brand text-white shadow-md',
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
  );
}

function TimeSlotsPanel({
  selectedDate,
  selectedSlot,
  selectedDaySlots,
  isLoading,
  availabilityMap,
  formatShortDate,
  formatTime,
  onSelectSlot,
  labels,
}: {
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  selectedDaySlots: TimeSlot[];
  isLoading: boolean;
  availabilityMap: Map<string, DayAvailability>;
  formatShortDate: (dateString: string) => string;
  formatTime: (iso: string) => string;
  onSelectSlot: (slot: TimeSlot) => void;
  labels: {
    availableTimes: string;
    loadingAvailability: string;
    timesAvailable: (count: number) => string;
    selectDate: string;
    chooseDatePrompt: string;
    noTimesAvailable: string;
  };
}) {
  return (
    <div className="p-5 lg:w-[320px] lg:shrink-0 lg:p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h4 className="text-lg font-bold">
            {selectedDate ? formatShortDate(selectedDate) : labels.availableTimes}
          </h4>
        </div>
        {isLoading && availabilityMap.size === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.loadingAvailability}</p>
        ) : selectedDate ? (
          <p className="text-sm text-muted-foreground">{labels.timesAvailable(selectedDaySlots.length)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.selectDate}</p>
        )}
      </div>

      <div className="max-h-[300px] space-y-2 overflow-y-auto">
        {isLoading && availabilityMap.size === 0 ? (
          <div className="space-y-2">
            {[...Array.from({ length: 6 })].map((_, index) => (
              <div
                key={`slot-skeleton-${index}`}
                className="w-full rounded-md border-2 border-border bg-muted/30 px-4 py-3.5 animate-pulse"
              >
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : !selectedDate ? (
          <div className="py-12 text-center">
            <CalendarDays className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{labels.chooseDatePrompt}</p>
          </div>
        ) : selectedDaySlots.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{labels.noTimesAvailable}</p>
          </div>
        ) : (
          selectedDaySlots.map((slot, index) => {
            const isCurrentSlot =
              selectedSlot?.startTime === slot.startTime &&
              selectedSlot?.teamMemberId === slot.teamMemberId;

            return (
              <button
                type="button"
                key={`${slot.startTime}-${slot.teamMemberId}-${index}`}
                onClick={() => onSelectSlot(slot)}
                className={cn(
                  'w-full rounded-md border-2 px-4 py-3.5 text-sm font-semibold',
                  isCurrentSlot
                    ? 'border-brand bg-brand text-white shadow-md hover:bg-brand/90'
                    : 'border-border bg-background text-foreground hover:border-brand hover:bg-brand/5'
                )}
              >
                {formatTime(slot.startTime)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function SelectedSlotFooter({
  selectedSlot,
  serviceDuration,
  formatSelectedDate,
  formatTime,
  minutesLabel,
}: {
  selectedSlot: TimeSlot;
  serviceDuration: number;
  formatSelectedDate: (dateString: string) => string;
  formatTime: (iso: string) => string;
  minutesLabel: string;
}) {
  return (
    <div className="border-t bg-gradient-to-r from-primary/5 to-muted/30 px-5 py-4 lg:px-8 lg:py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/10 lg:h-14 lg:w-14">
            <Clock className="h-5 w-5 text-primary lg:h-6 lg:w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold lg:text-lg">
              {formatSelectedDate(selectedSlot.startTime.split('T')[0])}
            </p>
            <p className="text-muted-foreground">
              {formatTime(selectedSlot.startTime)} · {serviceDuration} {minutesLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [state, dispatch] = useReducer(availabilityReducer, undefined, createInitialState);
  const loadKeyRef = useRef<string | null>(null);

  const weekdays = useMemo(
    () => [
      t('scheduling.weekdaySun'),
      t('scheduling.weekdayMon'),
      t('scheduling.weekdayTue'),
      t('scheduling.weekdayWed'),
      t('scheduling.weekdayThu'),
      t('scheduling.weekdayFri'),
      t('scheduling.weekdaySat'),
    ],
    [t]
  );

  const today = useMemo(() => toDateKey(new Date(), timezone), [timezone]);
  const calendarDays = useMemo(() => getCalendarDaysForMonth(state.currentMonth), [state.currentMonth]);
  const firstAvailableDate = useMemo(() => {
    const sortedDays = Array.from(state.availabilityMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const firstAvailableDay = sortedDays.find((day) => day.hasAvailability && day.date >= today);
    return firstAvailableDay?.date ?? null;
  }, [state.availabilityMap, today]);

  const effectiveSelectedDate = useMemo(() => {
    if (state.selectedDate) {
      const explicitDay = state.availabilityMap.get(state.selectedDate);
      if (explicitDay?.hasAvailability && state.selectedDate >= today) {
        return state.selectedDate;
      }
    }
    return firstAvailableDate;
  }, [state.selectedDate, state.availabilityMap, firstAvailableDate, today]);

  const selectedDaySlots = useMemo(
    () => (effectiveSelectedDate ? state.availabilityMap.get(effectiveSelectedDate)?.slots ?? [] : []),
    [effectiveSelectedDate, state.availabilityMap]
  );

  const runAvailabilityFetch = useCallback(
    async (month: Date) => {
      const requestKey = buildRequestKey({
        serviceId: service.id,
        serviceDuration: service.duration,
        teamMemberId: teamMember?.id ?? null,
        timezone,
        month,
      });
      const { startDateStr, endDateStr } = getRangeForMonth(month, timezone);

      dispatch({ type: 'fetchStarted', payload: requestKey });

      try {
        let data: AvailabilityApiResponse | null = null;
        const prefetch = (window as { __availabilityPrefetch?: Promise<unknown> }).__availabilityPrefetch;
        if (prefetch) {
          data = (await prefetch) as AvailabilityApiResponse;
          delete (window as { __availabilityPrefetch?: Promise<unknown> }).__availabilityPrefetch;
        }

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
          data = (await response.json()) as AvailabilityApiResponse;

          if (response.status === 429) {
            throw new Error('Please wait a moment before refreshing the calendar.');
          }
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to load availability');
        }

        const map = new Map<string, DayAvailability>();
        for (const day of data.data.days) {
          map.set(day.date, day);
        }

        dispatch({ type: 'fetchSucceeded', payload: { requestKey, map } });
      } catch (error) {
        dispatch({
          type: 'fetchFailed',
          payload: {
            requestKey,
            message: error instanceof Error ? error.message : 'Failed to load availability',
          },
        });
      }
    },
    [service.id, service.duration, teamMember?.id, timezone]
  );

  const buildLoadKey = useCallback(
    (month: Date) =>
      buildRequestKey({
        serviceId: service.id,
        serviceDuration: service.duration,
        teamMemberId: teamMember?.id ?? null,
        timezone,
        month,
      }),
    [service.id, service.duration, teamMember?.id, timezone]
  );

  const handleContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const loadKey = buildLoadKey(state.currentMonth);
      if (loadKeyRef.current === loadKey) return;
      loadKeyRef.current = loadKey;
      void runAvailabilityFetch(state.currentMonth);
    },
    [buildLoadKey, runAvailabilityFetch, state.currentMonth]
  );

  const goToPreviousMonth = useCallback(() => {
    const nextMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
    loadKeyRef.current = buildLoadKey(nextMonth);
    dispatch({ type: 'setMonth', payload: nextMonth });
    void runAvailabilityFetch(nextMonth);
  }, [buildLoadKey, runAvailabilityFetch, state.currentMonth]);

  const goToNextMonth = useCallback(() => {
    const nextMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
    loadKeyRef.current = buildLoadKey(nextMonth);
    dispatch({ type: 'setMonth', payload: nextMonth });
    void runAvailabilityFetch(nextMonth);
  }, [buildLoadKey, runAvailabilityFetch, state.currentMonth]);

  const retryFetch = useCallback(() => {
    loadKeyRef.current = buildLoadKey(state.currentMonth);
    void runAvailabilityFetch(state.currentMonth);
  }, [buildLoadKey, runAvailabilityFetch, state.currentMonth]);

  const formatSelectedDate = useCallback(
    (dateString: string) => {
      const date = new Date(`${dateString}T12:00:00`);
      return date.toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    },
    [locale]
  );

  const formatShortDate = useCallback(
    (dateString: string) => {
      const date = new Date(`${dateString}T12:00:00`);
      return date.toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    },
    [locale]
  );

  const formatTime = useCallback(
    (isoString: string) => {
      const date = new Date(isoString);
      return date
        .toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone,
        })
        .toLowerCase();
    },
    [locale, timezone]
  );

  const discussionText = teamMember
    ? t('scheduling.discussGoals').replace('{name}', teamMember.name.split(' ')[0])
    : service.description;

  const isPreviousMonthDisabled = state.currentMonth <= getMonthStart(new Date());

  if (state.error) {
    return (
      <div ref={handleContainerRef} className={cn('rounded-2xl border bg-card p-10 text-center shadow-sm', className)}>
        <p className="mb-4 text-destructive">{state.error}</p>
        <Button onClick={retryFetch} variant="outline">
          {t('scheduling.tryAgain')}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={handleContainerRef}
      className={cn('mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-sm', className)}
    >
      <div className="flex flex-col divide-y lg:flex-row lg:divide-x lg:divide-y-0">
        <MeetingInfoPanel
          teamMember={teamMember}
          service={service}
          timezone={timezone}
          discussionText={discussionText}
          durationLabel={`${service.duration} ${t('scheduling.minutes')}`}
          durationCaption={t('scheduling.duration')}
          timezoneCaption={t('scheduling.timezone')}
        />

        <CalendarPanel
          locale={locale}
          weekdays={weekdays}
          currentMonth={state.currentMonth}
          calendarDays={calendarDays}
          availabilityMap={state.availabilityMap}
          timezone={timezone}
          today={today}
          selectedDate={effectiveSelectedDate}
          isLoading={state.isLoading}
          isPreviousMonthDisabled={isPreviousMonthDisabled}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onSelectDate={(dateStr) => dispatch({ type: 'setSelectedDate', payload: dateStr })}
        />

        <TimeSlotsPanel
          selectedDate={effectiveSelectedDate}
          selectedSlot={selectedSlot}
          selectedDaySlots={selectedDaySlots}
          isLoading={state.isLoading}
          availabilityMap={state.availabilityMap}
          formatShortDate={formatShortDate}
          formatTime={formatTime}
          onSelectSlot={onSelectSlot}
          labels={{
            availableTimes: t('scheduling.availableTimes'),
            loadingAvailability: t('scheduling.loadingAvailability'),
            timesAvailable: (count) => t('scheduling.timesAvailable').replace('{count}', String(count)),
            selectDate: t('scheduling.selectDate'),
            chooseDatePrompt: t('scheduling.chooseDatePrompt'),
            noTimesAvailable: t('scheduling.noTimesAvailable'),
          }}
        />
      </div>

      {selectedSlot && (
        <SelectedSlotFooter
          selectedSlot={selectedSlot}
          serviceDuration={service.duration}
          formatSelectedDate={formatSelectedDate}
          formatTime={formatTime}
          minutesLabel={t('scheduling.minutes')}
        />
      )}
    </div>
  );
}

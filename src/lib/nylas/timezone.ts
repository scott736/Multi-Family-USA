interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    weekday: weekdayMap[lookup.weekday] ?? 0,
  };
}

/** Convert a local date/time in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const desiredDayKey = year * 10000 + month * 100 + day;
    const actualDayKey = parts.year * 10000 + parts.month * 100 + parts.day;
    const dayDiff = desiredDayKey - actualDayKey;
    const minuteDiff = dayDiff * 24 * 60 + (hour * 60 + minute - (parts.hour * 60 + parts.minute));
    if (minuteDiff === 0) break;
    utcMs -= minuteDiff * 60 * 1000;
  }

  return new Date(utcMs);
}

export function getDateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getDayOfWeekInTimezone(dateStr: string, timeZone: string): number {
  const noonUtc = zonedLocalToUtc(dateStr, '12:00', timeZone);
  return getZonedParts(noonUtc, timeZone).weekday;
}

export function addDaysToDateKey(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function enumerateDateKeys(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return dates;
}

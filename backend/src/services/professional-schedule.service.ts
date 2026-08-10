export type ScheduleBreak = { start: string; end: string };
export type ScheduleDay = { enabled: boolean; start: string; end: string; breaks?: ScheduleBreak[] };
export type WeeklySchedule = Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', ScheduleDay>;
export type TimeBlock = {
  id: string;
  type: 'VACATION' | 'TIME_OFF' | 'BLOCK';
  startTime: string;
  endTime: string;
  reason?: string;
};

export type ProfessionalScheduleRecord = {
  id: string;
  workScheduleConfigured?: boolean;
  weeklySchedule?: unknown;
  timeBlocks?: unknown;
};

export type DateInterval = { start: Date; end: Date };

const DAY_KEYS: Array<keyof WeeklySchedule> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function timezone() {
  return process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';
}

function offset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function toDate(date: string, time: string) {
  return new Date(`${date}T${time}:00${offset()}`);
}

function businessDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone(),
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function salonOpeningWindow(openingHours: string) {
  const matches = [...String(openingHours || '').matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*h?\b/gi)]
    .map((match) => `${String(Number(match[1])).padStart(2, '0')}:${String(Number(match[2] || 0)).padStart(2, '0')}`);
  if (matches.length >= 2 && minutes(matches[0]) < minutes(matches[1])) return { start: matches[0], end: matches[1] };
  return { start: '09:00', end: '19:00' };
}

export function defaultWeeklySchedule(openingHours: string): WeeklySchedule {
  const opening = salonOpeningWindow(openingHours);
  const working = () => ({ enabled: true, start: opening.start, end: opening.end, breaks: [] });
  return {
    sun: { enabled: false, start: opening.start, end: opening.end, breaks: [] },
    mon: working(), tue: working(), wed: working(), thu: working(), fri: working(), sat: working()
  };
}

function parseDay(value: unknown, fallback: ScheduleDay): ScheduleDay {
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Record<string, unknown>;
  const start = validTime(source.start) ? source.start : fallback.start;
  const end = validTime(source.end) ? source.end : fallback.end;
  const breaks = Array.isArray(source.breaks)
    ? source.breaks.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        if (!validTime(row.start) || !validTime(row.end) || minutes(row.start) >= minutes(row.end)) return [];
        return [{ start: row.start, end: row.end }];
      })
    : [];
  return { enabled: source.enabled !== false, start, end, breaks };
}

export function normalizedWeeklySchedule(professional: ProfessionalScheduleRecord, openingHours: string): WeeklySchedule {
  const fallback = defaultWeeklySchedule(openingHours);
  if (!professional.workScheduleConfigured || !professional.weeklySchedule || typeof professional.weeklySchedule !== 'object') return fallback;
  const raw = professional.weeklySchedule as Record<string, unknown>;
  return DAY_KEYS.reduce((result, key) => {
    result[key] = parseDay(raw[key], fallback[key]);
    return result;
  }, {} as WeeklySchedule);
}

export function parseTimeBlocks(professional: ProfessionalScheduleRecord): TimeBlock[] {
  if (!Array.isArray(professional.timeBlocks)) return [];
  return professional.timeBlocks.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const start = new Date(String(row.startTime || ''));
    const end = new Date(String(row.endTime || ''));
    if (!String(row.id || '') || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return [];
    const type = ['VACATION', 'TIME_OFF', 'BLOCK'].includes(String(row.type)) ? String(row.type) as TimeBlock['type'] : 'BLOCK';
    return [{ id: String(row.id), type, startTime: start.toISOString(), endTime: end.toISOString(), reason: String(row.reason || '') }];
  });
}

function subtractIntervals(base: DateInterval[], busy: DateInterval[]) {
  let result = [...base];
  for (const interval of busy.sort((a, b) => a.start.getTime() - b.start.getTime())) {
    result = result.flatMap((window) => {
      if (interval.end <= window.start || interval.start >= window.end) return [window];
      const pieces: DateInterval[] = [];
      if (interval.start > window.start) pieces.push({ start: window.start, end: new Date(Math.min(interval.start.getTime(), window.end.getTime())) });
      if (interval.end < window.end) pieces.push({ start: new Date(Math.max(interval.end.getTime(), window.start.getTime())), end: window.end });
      return pieces.filter((piece) => piece.start < piece.end);
    });
  }
  return result;
}

export function professionalWorkWindows(professional: ProfessionalScheduleRecord, openingHours: string, date: string): DateInterval[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const key = DAY_KEYS[weekday];
  const day = normalizedWeeklySchedule(professional, openingHours)[key];
  if (!day.enabled || !validTime(day.start) || !validTime(day.end) || minutes(day.start) >= minutes(day.end)) return [];

  const main = [{ start: toDate(date, day.start), end: toDate(date, day.end) }];
  const recurringBreaks = (day.breaks || []).map((item) => ({ start: toDate(date, item.start), end: toDate(date, item.end) }));
  const exceptionBlocks = parseTimeBlocks(professional).map((item) => ({ start: new Date(item.startTime), end: new Date(item.endTime) }));
  return subtractIntervals(main, [...recurringBreaks, ...exceptionBlocks]);
}

export function subtractBusyFromWindows(windows: DateInterval[], busy: DateInterval[]) {
  return subtractIntervals(windows, busy);
}

export function bookingFitsProfessionalSchedule(input: {
  professional: ProfessionalScheduleRecord;
  openingHours: string;
  start: Date;
  end: Date;
}) {
  if (!Number.isFinite(input.start.getTime()) || !Number.isFinite(input.end.getTime()) || input.start >= input.end) return false;
  const date = businessDate(input.start);
  const windows = professionalWorkWindows(input.professional, input.openingHours, date);
  return windows.some((window) => input.start >= window.start && input.end <= window.end);
}

function localOffset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

export function parseOpeningHours(text: string) {
  const hours = [...String(text || '').matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*h?\b/gi)].map((match) => Number(match[1]));
  return hours.length >= 2 && hours[0] < hours[1] ? { startHour: hours[0], endHour: hours[1] } : { startHour: 9, endHour: 19 };
}

export function asBusinessDate(date: string, hour: number, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00${localOffset()}`);
}

export function formatBusinessDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

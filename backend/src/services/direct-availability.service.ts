import { prisma } from '../lib/prisma';
import { publicBookingAvailability } from './public-booking-availability.service';

type AvailabilitySalon = {
  id: string;
  name: string;
  openingHours: string;
};

type ServiceRecord = {
  id: string;
  name: string;
  durationMin: number;
};

function normalize(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(`${date}T12:00:00Z`));
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || 0),
    month: Number(parts.find((part) => part.type === 'month')?.value || 0),
    day: Number(parts.find((part) => part.type === 'day')?.value || 0)
  };
}

function addCalendarDays(date: { year: number; month: number; day: number }, days: number) {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return value.toISOString().slice(0, 10);
}

function resolveDateFromText(text: string): string | null {
  const value = normalize(text);
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const today = currentBusinessDate();
  if (/\bdepois de amanha\b/.test(value)) return addCalendarDays(today, 2);
  if (/\bamanha\b/.test(value)) return addCalendarDays(today, 1);
  if (/\bhoje\b/.test(value)) return addCalendarDays(today, 0);

  const shortDate = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (shortDate) {
    const day = Number(shortDate[1]);
    const month = Number(shortDate[2]);
    let year = shortDate[3] ? Number(shortDate[3]) : today.year;
    if (year < 100) year += 2000;
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));
    if (parsed.getUTCDate() === day && parsed.getUTCMonth() === month - 1) return parsed.toISOString().slice(0, 10);
  }

  const weekdays: Array<[RegExp, number]> = [
    [/\bdomingo\b/, 0], [/\bsegunda(?:-feira)?\b/, 1], [/\bterca(?:-feira)?\b/, 2],
    [/\bquarta(?:-feira)?\b/, 3], [/\bquinta(?:-feira)?\b/, 4], [/\bsexta(?:-feira)?\b/, 5], [/\bsabado\b/, 6]
  ];
  const current = new Date(Date.UTC(today.year, today.month - 1, today.day, 12));
  for (const [pattern, weekday] of weekdays) {
    if (!pattern.test(value)) continue;
    const delta = (weekday - current.getUTCDay() + 7) % 7 || 7;
    return addCalendarDays(today, delta);
  }

  return null;
}

const GENERIC_SERVICE_WORDS = new Set(['feminino', 'masculino', 'global', 'profunda', 'iluminadas', 'premium']);

function serviceMatchesText(serviceName: string, text: string) {
  const service = normalize(serviceName);
  const value = normalize(text);
  if (!service || !value) return false;
  if (value.includes(service)) return true;

  const serviceWords = service.split(' ').filter((word) => word.length >= 4 && !GENERIC_SERVICE_WORDS.has(word));
  const textWords = value.split(' ').filter((word) => word.length >= 4);
  const stemMatch = serviceWords.some((serviceWord) =>
    textWords.some((textWord) => serviceWord.slice(0, 4) === textWord.slice(0, 4))
  );
  if (stemMatch) return true;

  if (/\bcorte\b/.test(service) && /\b(corte|cortar|cabelo)\b/.test(value)) return true;
  if (/\bcolor/.test(service) && /\b(coloracao|colorir|pintar|pintura)\b/.test(value)) return true;
  if (/\bhidrat/.test(service) && /\b(hidratacao|hidratar)\b/.test(value)) return true;
  if (/\bmecha|\bluz/.test(service) && /\b(mecha|mechas|luzes)\b/.test(value)) return true;
  if (/\bescova/.test(service) && /\b(escova|escovar)\b/.test(value)) return true;
  if (/\bprogressiva|\balis/.test(service) && /\b(progressiva|alisar|alisamento)\b/.test(value)) return true;

  return false;
}

async function slotsForService(input: {
  salon: AvailabilitySalon;
  service: ServiceRecord;
  date: string;
}) {
  const availability = await publicBookingAvailability({
    salon: input.salon,
    serviceId: input.service.id,
    date: input.date
  });

  if (!availability || availability.mode !== 'day') {
    return { service: input.service.name, slots: [] as Array<{ professional: string; displayTime: string; fitScore: number; recommended: boolean }> };
  }

  const slots = availability.professionals
    .flatMap((professional) => professional.slots.map((slot) => ({
      professional: professional.name,
      displayTime: `${dateLabel(input.date).slice(0, 5)}, ${slot.label}`,
      fitScore: slot.fitScore || 0,
      recommended: Boolean(slot.recommended)
    })))
    .sort((a, b) => b.fitScore - a.fitScore || a.displayTime.localeCompare(b.displayTime))
    .slice(0, 8)
    .map((slot, index) => ({ ...slot, recommended: index < 3 }));

  return { service: input.service.name, slots };
}

async function formatAvailability(salon: AvailabilitySalon, services: ServiceRecord[], date: string) {
  const results = await Promise.all(services.slice(0, 3).map((service) => slotsForService({ salon, service, date })));
  const blocks = results.map((result) => {
    if (!result.slots.length) {
      return `Para ${result.service} em ${dateLabel(date)}, não encontrei profissionais habilitados com tempo livre suficiente na jornada.`;
    }

    const lines = result.slots.map((slot) => `${slot.recommended ? '★' : '•'} ${slot.displayTime} — ${slot.professional}${slot.recommended ? ' · melhor encaixe' : ''}`).join('\n');
    return `Para ${result.service} em ${dateLabel(date)}, encontrei estes horários:\n${lines}`;
  });

  return `${blocks.join('\n\n')}\n\nOs horários marcados com ★ aproveitam melhor a agenda sem criar pequenos intervalos ociosos. Se algum servir para você, me diga qual prefere e eu continuo o agendamento.`;
}

/** Consulta diretamente a mesma agenda usada pelo site público, incluindo jornada, intervalos, ausências e encaixe inteligente. */
export async function directAvailabilityFromText(input: {
  salon: AvailabilitySalon;
  text: string;
}): Promise<string | null> {
  const date = resolveDateFromText(input.text);
  if (!date) return null;

  const services = await prisma.service.findMany({
    where: { salonId: input.salon.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, durationMin: true }
  });
  const targetServices = services.filter((service) => serviceMatchesText(service.name, input.text));
  if (!targetServices.length) return null;

  return formatAvailability(input.salon, targetServices, date);
}

export async function directAvailabilityFromDecision(input: {
  salon: AvailabilitySalon;
  decisionText: string;
}) {
  const date = String(input.decisionText || '').match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || '';
  if (!date) return null;

  const services = await prisma.service.findMany({
    where: { salonId: input.salon.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, durationMin: true }
  });
  const normalizedDecision = normalize(input.decisionText);
  const targetServices = services.filter((service) => normalizedDecision.includes(normalize(service.name)));
  if (!targetServices.length) return null;

  return formatAvailability(input.salon, targetServices, date);
}

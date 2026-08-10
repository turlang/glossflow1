import { prisma } from '../lib/prisma';

type AvailabilitySalon = {
  id: string;
  name: string;
  openingHours: string;
};

function normalize(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function localOffset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

function parseOpeningHours(text: string) {
  const hourMatches = [...String(text || '').matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*h?\b/gi)]
    .map((match) => Number(match[1]));
  if (hourMatches.length >= 2 && hourMatches[0] < hourMatches[1]) {
    return { startHour: hourMatches[0], endHour: hourMatches[1] };
  }
  return { startHour: 9, endHour: 19 };
}

function asDate(date: string, hour: number, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00${localOffset()}`);
}

function formatLocal(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(`${date}T12:00:00Z`));
}

async function slotsForService(input: {
  salon: AvailabilitySalon;
  service: { id: string; name: string; durationMin: number };
  date: string;
}) {
  const professionals = await prisma.professional.findMany({
    where: { salonId: input.salon.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  });

  if (!professionals.length) {
    return { service: input.service.name, slots: [] as Array<{ professional: string; displayTime: string }> };
  }

  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) {
    return { service: input.service.name, slots: [] as Array<{ professional: string; displayTime: string }> };
  }

  const { startHour, endHour } = parseOpeningHours(input.salon.openingHours);
  const configuredInterval = Number(process.env.BOOKING_SLOT_INTERVAL_MINUTES || 30);
  const intervalMin = Number.isFinite(configuredInterval) && configuredInterval >= 10 ? configuredInterval : 30;
  const dayStart = asDate(input.date, 0, 0);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      salonId: input.salon.id,
      status: 'CONFIRMED',
      startTime: { gte: dayStart, lt: nextDay },
      professionalId: { in: professionals.map((professional) => professional.id) }
    },
    select: { professionalId: true, startTime: true, endTime: true }
  });

  const slots: Array<{ professional: string; displayTime: string }> = [];
  for (const professional of professionals) {
    for (let minutes = startHour * 60; minutes + input.service.durationMin <= endHour * 60; minutes += intervalMin) {
      const start = asDate(input.date, Math.floor(minutes / 60), minutes % 60);
      const end = new Date(start.getTime() + input.service.durationMin * 60_000);
      if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) continue;

      const conflict = appointments.some((appointment) =>
        appointment.professionalId === professional.id
        && appointment.startTime < end
        && appointment.endTime > start
      );

      if (!conflict) {
        slots.push({ professional: professional.name, displayTime: formatLocal(start) });
      }
      if (slots.length >= 8) break;
    }
    if (slots.length >= 8) break;
  }

  return { service: input.service.name, slots };
}

/**
 * Executa a consulta crítica de agenda sem depender de uma segunda rodada do LLM.
 * O decisionText é gerado pela camada de intenção e contém os nomes reais dos
 * serviços válidos e a data ISO já resolvida.
 */
export async function directAvailabilityFromDecision(input: {
  salon: AvailabilitySalon;
  decisionText: string;
}) {
  const date = String(input.decisionText || '').match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || '';
  if (!date) {
    return 'Já identifiquei o serviço, mas não consegui determinar a data para consultar a agenda. Pode me informar o dia novamente?';
  }

  const services = await prisma.service.findMany({
    where: { salonId: input.salon.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, durationMin: true }
  });

  const normalizedDecision = normalize(input.decisionText);
  const targetServices = services.filter((service) => normalizedDecision.includes(normalize(service.name)));

  if (!targetServices.length) {
    return 'Já identifiquei a data, mas não consegui relacionar com segurança o serviço cadastrado. Me diga qual serviço da lista você quer agendar.';
  }

  const results = await Promise.all(
    targetServices.slice(0, 3).map((service) => slotsForService({ salon: input.salon, service, date }))
  );

  const blocks = results.map((result) => {
    if (!result.slots.length) {
      return `Para ${result.service} em ${dateLabel(date)}, não encontrei horários livres no momento.`;
    }

    const lines = result.slots.map((slot) => `• ${slot.displayTime} — ${slot.professional}`).join('\n');
    return `Para ${result.service} em ${dateLabel(date)}, encontrei estes horários:\n${lines}`;
  });

  return `${blocks.join('\n\n')}\n\nSe algum desses horários servir para você, me diga qual prefere e eu continuo o agendamento.`;
}

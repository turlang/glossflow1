import { prisma } from '../lib/prisma';
import { filterProfessionalsForService } from './professional-capability.service';
import { professionalWorkWindows, salonOpeningWindow, subtractBusyFromWindows } from './professional-schedule.service';

type SalonWindow = {
  id: string;
  openingHours: string;
};

type AvailabilityInput = {
  salon: SalonWindow;
  serviceId: string;
  professionalId?: string;
  month?: string;
  date?: string;
};

type BusyInterval = { startTime: Date; endTime: Date; professionalId: string };
type FreeBlock = { start: Date; end: Date };
type PublicProfessionalInput = { id: string; name: string; specialty: string; photoUrl: string | null };

export type RankedSlot = {
  startTime: string;
  label: string;
  fitScore: number;
  recommended: boolean;
  fitReason: string;
  freeBeforeMin: number;
  freeAfterMin: number;
};

function businessTimeZone() {
  return process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';
}

function localOffset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

function intervalMinutes() {
  const value = Number(process.env.BOOKING_SLOT_INTERVAL_MINUTES || 30);
  return Number.isFinite(value) && value >= 10 && value <= 120 ? value : 30;
}

function asDate(date: string, minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minute = String(minutes % 60).padStart(2, '0');
  return new Date(`${date}T${hour}:${minute}:00${localOffset()}`);
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function todayBusinessDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone(),
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1, 12));
  const nextMonth = next.toISOString().slice(0, 7);
  const endExclusive = `${nextMonth}-01`;
  return { start, endExclusive };
}

function datesInMonth(month: string) {
  const { start, endExclusive } = monthBounds(month);
  const dates: string[] = [];
  for (let date = start; date < endExclusive; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function capacityForBlocks(blocks: FreeBlock[], durationMin: number) {
  const durationMs = durationMin * 60_000;
  return blocks.reduce((total, block) => total + Math.floor((block.end.getTime() - block.start.getTime()) / durationMs), 0);
}

function fitForCandidate(input: {
  block: FreeBlock;
  candidate: Date;
  end: Date;
  minUsefulDuration: number;
}) {
  const before = Math.max(0, Math.round((input.candidate.getTime() - input.block.start.getTime()) / 60_000));
  const after = Math.max(0, Math.round((input.block.end.getTime() - input.end.getTime()) / 60_000));
  const minUseful = Math.max(intervalMinutes(), input.minUsefulDuration);

  const orphanPenalty = [before, after].reduce((sum, value) => {
    if (value <= 0 || value >= minUseful) return sum;
    return sum + (minUseful - value);
  }, 0);

  const splitPenalty = before > 0 && after > 0 ? 16 : 0;
  const edgeBonus = before === 0 || after === 0 ? 14 : 0;
  const exactBonus = before === 0 && after === 0 ? 16 : 0;
  const slackPenalty = Math.min(24, Math.round((before + after) / 30));
  const score = Math.max(1, Math.min(100, Math.round(100 - orphanPenalty * 1.25 - splitPenalty - slackPenalty + edgeBonus + exactBonus)));

  let reason = 'Preserva melhor os espaços restantes da agenda.';
  if (before === 0 && after === 0) reason = 'Preenche exatamente um bloco livre, sem deixar espaço ocioso.';
  else if (before === 0 || after === 0) reason = 'Encosta no início ou fim de um bloco livre e evita dividir a agenda.';
  else if (orphanPenalty > 0) reason = 'Horário disponível, mas pode deixar um pequeno intervalo difícil de aproveitar.';

  return { score, reason, before, after };
}

function slotOptions(date: string, blocks: FreeBlock[], durationMin: number, minUsefulDuration: number) {
  const interval = intervalMinutes();
  const durationMs = durationMin * 60_000;
  const options: Omit<RankedSlot, 'recommended'>[] = [];

  const format = new Intl.DateTimeFormat('pt-BR', {
    timeZone: businessTimeZone(),
    hour: '2-digit', minute: '2-digit'
  });

  for (const block of blocks) {
    const localStart = new Intl.DateTimeFormat('en-US', {
      timeZone: businessTimeZone(), hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(block.start);
    const startHour = Number(localStart.find((part) => part.type === 'hour')?.value || 0);
    const startMinute = Number(localStart.find((part) => part.type === 'minute')?.value || 0);
    const startOfBlockMin = startHour * 60 + startMinute;
    let candidateMin = Math.ceil(startOfBlockMin / interval) * interval;

    while (candidateMin < 24 * 60) {
      const candidate = asDate(date, candidateMin);
      const end = new Date(candidate.getTime() + durationMs);
      if (candidate < block.start) {
        candidateMin += interval;
        continue;
      }
      if (end > block.end) break;
      if (candidate > new Date()) {
        const fit = fitForCandidate({ block, candidate, end, minUsefulDuration });
        options.push({
          startTime: candidate.toISOString(),
          label: format.format(candidate),
          fitScore: fit.score,
          fitReason: fit.reason,
          freeBeforeMin: fit.before,
          freeAfterMin: fit.after
        });
      }
      candidateMin += interval;
    }
  }

  return options
    .sort((a, b) => b.fitScore - a.fitScore || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((slot, index) => ({ ...slot, recommended: index < 2 }));
}

function busyForProfessional(appointments: BusyInterval[], professionalId: string, date: string) {
  const dayStart = asDate(date, 0);
  const dayEnd = asDate(addDays(date, 1), 0);
  return appointments
    .filter((appointment) => appointment.professionalId === professionalId && appointment.startTime < dayEnd && appointment.endTime > dayStart)
    .map((appointment) => ({ start: appointment.startTime, end: appointment.endTime }));
}

function publicProfessional(professional: PublicProfessionalInput) {
  return {
    id: professional.id,
    name: professional.name,
    specialty: professional.specialty,
    photoUrl: professional.photoUrl
  };
}

export async function publicBookingAvailability(input: AvailabilityInput) {
  const [service, activeDurations] = await Promise.all([
    prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salon.id, active: true },
      select: { id: true, name: true, price: true, durationMin: true }
    }),
    prisma.service.findMany({
      where: { salonId: input.salon.id, active: true },
      select: { durationMin: true }
    })
  ]);
  if (!service) return null;

  const validDurations = activeDurations.map((item) => Number(item.durationMin)).filter((value) => Number.isFinite(value) && value > 0);
  const minUsefulDuration = validDurations.length ? Math.min(...validDurations) : intervalMinutes();

  const allProfessionals = await prisma.professional.findMany({
    where: { salonId: input.salon.id, active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialty: true,
      photoUrl: true,
      servicesConfigured: true,
      serviceIds: true,
      workScheduleConfigured: true,
      weeklySchedule: true,
      timeBlocks: true
    }
  });

  const professionals = filterProfessionalsForService(allProfessionals, service.id)
    .filter((professional) => !input.professionalId || professional.id === input.professionalId);

  const referenceMonth = input.month || input.date?.slice(0, 7) || todayBusinessDate().slice(0, 7);
  const { start, endExclusive } = monthBounds(referenceMonth);
  const appointments = professionals.length
    ? await prisma.appointment.findMany({
        where: {
          salonId: input.salon.id,
          professionalId: { in: professionals.map((professional) => professional.id) },
          status: 'CONFIRMED',
          startTime: { lt: asDate(endExclusive, 0) },
          endTime: { gt: asDate(start, 0) }
        },
        select: { professionalId: true, startTime: true, endTime: true }
      })
    : [];

  const today = todayBusinessDate();
  const freeFor = (professional: typeof professionals[number], date: string) => {
    if (date < today) return [];
    const workWindows = professionalWorkWindows(professional, input.salon.openingHours, date);
    return subtractBusyFromWindows(workWindows, busyForProfessional(appointments, professional.id, date));
  };

  if (input.date) {
    const date = input.date;
    const detail = professionals.map((professional) => {
      const blocks = freeFor(professional, date);
      const capacity = capacityForBlocks(blocks, service.durationMin);
      return {
        ...publicProfessional(professional),
        capacity,
        slots: slotOptions(date, blocks, service.durationMin, minUsefulDuration)
      };
    });

    const recommendedSlots = detail
      .flatMap((professional) => professional.slots.map((slot) => ({
        ...slot,
        professionalId: professional.id,
        professionalName: professional.name
      })))
      .sort((a, b) => b.fitScore - a.fitScore || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 8)
      .map((slot, index) => ({ ...slot, recommended: index < 3 }));

    return {
      mode: 'day' as const,
      date,
      service,
      intervalMin: intervalMinutes(),
      professionals: detail,
      totalCapacity: detail.reduce((sum, professional) => sum + professional.capacity, 0),
      smartFit: {
        strategy: 'BEST_FIT' as const,
        minUsefulDuration,
        recommendedSlots
      }
    };
  }

  const days = datesInMonth(referenceMonth).map((date) => {
    const professionalCapacity = professionals.map((professional) => {
      const blocks = freeFor(professional, date);
      const bestSlot = slotOptions(date, blocks, service.durationMin, minUsefulDuration)[0];
      return {
        professionalId: professional.id,
        professionalName: professional.name,
        capacity: capacityForBlocks(blocks, service.durationMin),
        bestFitScore: bestSlot?.fitScore || 0
      };
    });

    return {
      date,
      totalCapacity: professionalCapacity.reduce((sum, professional) => sum + professional.capacity, 0),
      bestFitScore: Math.max(0, ...professionalCapacity.map((professional) => professional.bestFitScore)),
      professionals: professionalCapacity
    };
  });

  return {
    mode: 'month' as const,
    month: referenceMonth,
    service,
    intervalMin: intervalMinutes(),
    professionals: professionals.map(publicProfessional),
    days
  };
}

export function bookingFitsBusinessWindow(openingHours: string, start: Date, durationMin: number) {
  if (!Number.isFinite(start.getTime()) || start <= new Date()) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimeZone(),
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(start);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || '';
  if (weekday === 'Sun') return false;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const startMin = hour * 60 + minute;
  const opening = salonOpeningWindow(openingHours);
  const [openingHour, openingMinute] = opening.start.split(':').map(Number);
  const [closingHour, closingMinute] = opening.end.split(':').map(Number);
  const openingMin = openingHour * 60 + openingMinute;
  const closingMin = closingHour * 60 + closingMinute;
  return startMin >= openingMin && startMin + durationMin <= closingMin;
}

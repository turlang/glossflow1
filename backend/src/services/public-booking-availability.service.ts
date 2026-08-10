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

function capacityForBlocks(blocks: Array<{ start: Date; end: Date }>, durationMin: number) {
  const durationMs = durationMin * 60_000;
  return blocks.reduce((total, block) => total + Math.floor((block.end.getTime() - block.start.getTime()) / durationMs), 0);
}

function slotOptions(date: string, blocks: Array<{ start: Date; end: Date }>, durationMin: number) {
  const interval = intervalMinutes();
  const durationMs = durationMin * 60_000;
  const options: Array<{ startTime: string; label: string }> = [];

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
      if (candidate > new Date()) options.push({ startTime: candidate.toISOString(), label: format.format(candidate) });
      candidateMin += interval;
    }
  }

  return options;
}

function busyForProfessional(appointments: BusyInterval[], professionalId: string, date: string) {
  const dayStart = asDate(date, 0);
  const dayEnd = asDate(addDays(date, 1), 0);
  return appointments
    .filter((appointment) => appointment.professionalId === professionalId && appointment.startTime < dayEnd && appointment.endTime > dayStart)
    .map((appointment) => ({ start: appointment.startTime, end: appointment.endTime }));
}

function publicProfessional(professional: any) {
  return {
    id: professional.id,
    name: professional.name,
    specialty: professional.specialty,
    photoUrl: professional.photoUrl
  };
}

export async function publicBookingAvailability(input: AvailabilityInput) {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, salonId: input.salon.id, active: true },
    select: { id: true, name: true, price: true, durationMin: true }
  });
  if (!service) return null;

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
        slots: slotOptions(date, blocks, service.durationMin)
      };
    });

    return {
      mode: 'day' as const,
      date,
      service,
      intervalMin: intervalMinutes(),
      professionals: detail,
      totalCapacity: detail.reduce((sum, professional) => sum + professional.capacity, 0)
    };
  }

  const days = datesInMonth(referenceMonth).map((date) => {
    const professionalCapacity = professionals.map((professional) => {
      const blocks = freeFor(professional, date);
      return {
        professionalId: professional.id,
        professionalName: professional.name,
        capacity: capacityForBlocks(blocks, service.durationMin)
      };
    });

    return {
      date,
      totalCapacity: professionalCapacity.reduce((sum, professional) => sum + professional.capacity, 0),
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

import { prisma } from '../../lib/prisma';
import { buildAppointmentConflictWhere } from '../appointment-reschedule.service';
import { bookingFitsBusinessWindow } from '../public-booking-availability.service';
import { bookingFitsProfessionalSchedule } from '../professional-schedule.service';
import { professionalCanPerform } from '../professional-capability.service';
import { AgentSalon, normalizePhone } from './contracts';
import { asBusinessDate, formatBusinessDate, parseOpeningHours } from './time';

export async function listServices(salonId: string) {
  return prisma.service.findMany({ where: { salonId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, price: true, durationMin: true } });
}

export async function listProfessionals(salonId: string) {
  return prisma.professional.findMany({ where: { salonId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, specialty: true } });
}

export async function listClientAppointments(salonId: string, phone: string) {
  const items = await prisma.appointment.findMany({
    where: { salonId, clientPhone: normalizePhone(phone), status: 'CONFIRMED', startTime: { gte: new Date() } },
    include: { service: true, professional: true },
    orderBy: { startTime: 'asc' },
    take: 10
  });
  return items.map((appointment) => ({ id: appointment.id, service: appointment.service.name, professional: appointment.professional.name, startTime: appointment.startTime.toISOString(), displayTime: formatBusinessDate(appointment.startTime) }));
}

export async function availableSlots(input: { salon: AgentSalon; serviceId: string; professionalId?: string | null; date: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, message: 'Data inválida. Use YYYY-MM-DD.' };

  const service = await prisma.service.findFirst({ where: { id: input.serviceId, salonId: input.salon.id, active: true } });
  if (!service) return { ok: false, message: 'Serviço não encontrado neste salão.' };

  const professionals = input.professionalId
    ? await prisma.professional.findMany({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
    : await prisma.professional.findMany({ where: { salonId: input.salon.id, active: true }, orderBy: { name: 'asc' } });
  if (!professionals.length) return { ok: false, message: 'Nenhum profissional disponível para consulta.' };

  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return { ok: true, slots: [], message: 'Domingo não está habilitado na configuração padrão.' };

  const { startHour, endHour } = parseOpeningHours(input.salon.openingHours);
  const intervalMin = Number(process.env.BOOKING_SLOT_INTERVAL_MINUTES || 30);
  const dayStart = asBusinessDate(input.date, 0, 0);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: { salonId: input.salon.id, status: 'CONFIRMED', startTime: { gte: dayStart, lt: nextDay }, professionalId: { in: professionals.map((professional) => professional.id) } },
    select: { professionalId: true, startTime: true, endTime: true }
  });

  const result: Array<{ professionalId: string; professional: string; startTime: string; displayTime: string }> = [];
  for (const professional of professionals) {
    if (!professionalCanPerform(professional, service.id)) continue;
    for (let minutes = startHour * 60; minutes + service.durationMin <= endHour * 60; minutes += intervalMin) {
      const start = asBusinessDate(input.date, Math.floor(minutes / 60), minutes % 60);
      const end = new Date(start.getTime() + service.durationMin * 60_000);
      if (start.getTime() <= Date.now()) continue;
      if (!bookingFitsProfessionalSchedule({ professional, openingHours: input.salon.openingHours, start, end })) continue;
      const conflict = appointments.some((appointment) => appointment.professionalId === professional.id && appointment.startTime < end && appointment.endTime > start);
      if (!conflict) result.push({ professionalId: professional.id, professional: professional.name, startTime: start.toISOString(), displayTime: formatBusinessDate(start) });
      if (result.length >= 12) break;
    }
    if (result.length >= 12) break;
  }
  return { ok: true, service: service.name, slots: result };
}

export async function createAppointment(input: { salon: AgentSalon; phone: string; serviceId: string; professionalId: string; startTime: string; clientName: string; confirmed: boolean }) {
  if (!input.confirmed) return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita do cliente antes de criar o agendamento.' };
  const [service, professional] = await Promise.all([
    prisma.service.findFirst({ where: { id: input.serviceId, salonId: input.salon.id, active: true } }),
    prisma.professional.findFirst({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
  ]);
  if (!service || !professional) return { ok: false, message: 'Serviço ou profissional inválido para este salão.' };
  if (!professionalCanPerform(professional, service.id)) return { ok: false, message: `${professional.name} não executa ${service.name}.` };

  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false, message: 'Horário inválido ou já passou.' };
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  if (!bookingFitsBusinessWindow(input.salon.openingHours, start, service.durationMin)
    || !bookingFitsProfessionalSchedule({ professional, openingHours: input.salon.openingHours, start, end })) {
    return { ok: false, message: 'O horário solicitado não cabe na jornada disponível.' };
  }

  const conflict = await prisma.appointment.findFirst({ where: buildAppointmentConflictWhere({ salonId: input.salon.id, professionalId: professional.id, start, end }) });
  if (conflict) return { ok: false, message: 'O horário acabou de ficar indisponível. Consulte novos horários.' };

  const phone = normalizePhone(input.phone);
  const existingClient = await prisma.client.findFirst({ where: { salonId: input.salon.id, phone } });
  const client = existingClient || await prisma.client.create({ data: { name: input.clientName, phone, notes: 'Criado automaticamente pelo agente de WhatsApp.', salonId: input.salon.id } });
  const appointment = await prisma.appointment.create({
    data: { clientName: input.clientName, clientPhone: phone, clientId: client.id, startTime: start, endTime: end, notes: 'Agendado pelo agente de WhatsApp.', salonId: input.salon.id, serviceId: service.id, professionalId: professional.id }
  });
  return { ok: true, appointmentId: appointment.id, service: service.name, professional: professional.name, startTime: start.toISOString(), displayTime: formatBusinessDate(start) };
}

export async function cancelAppointment(salonId: string, phone: string, appointmentId: string, confirmed: boolean) {
  if (!confirmed) return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita antes de cancelar.' };
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, salonId, clientPhone: normalizePhone(phone), status: 'CONFIRMED' } });
  if (!appointment) return { ok: false, message: 'Agendamento ativo não encontrado para este cliente.' };
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELED' } });
  return { ok: true, appointmentId, message: 'Agendamento cancelado.' };
}

export async function rescheduleAppointment(input: { salonId: string; phone: string; appointmentId: string; startTime: string; professionalId?: string | null; confirmed: boolean }) {
  if (!input.confirmed) return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita antes de reagendar.' };
  const appointment = await prisma.appointment.findFirst({ where: { id: input.appointmentId, salonId: input.salonId, clientPhone: normalizePhone(input.phone), status: 'CONFIRMED' }, include: { service: true } });
  if (!appointment) return { ok: false, message: 'Agendamento ativo não encontrado para este cliente.' };

  const professionalId = input.professionalId || appointment.professionalId;
  const professional = await prisma.professional.findFirst({ where: { id: professionalId, salonId: input.salonId, active: true } });
  if (!professional) return { ok: false, message: 'Profissional inválido.' };
  if (!professionalCanPerform(professional, appointment.service.id)) return { ok: false, message: `${professional.name} não executa ${appointment.service.name}.` };

  const salon = await prisma.salon.findUnique({ where: { id: input.salonId }, select: { openingHours: true } });
  if (!salon) return { ok: false, message: 'Salão não encontrado.' };
  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false, message: 'Novo horário inválido.' };
  const end = new Date(start.getTime() + appointment.service.durationMin * 60_000);
  if (!bookingFitsBusinessWindow(salon.openingHours, start, appointment.service.durationMin)
    || !bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start, end })) return { ok: false, message: 'O novo horário fica fora da jornada disponível.' };

  const conflict = await prisma.appointment.findFirst({ where: buildAppointmentConflictWhere({ appointmentId: appointment.id, salonId: input.salonId, professionalId, start, end }) });
  if (conflict) return { ok: false, message: 'O novo horário não está mais disponível.' };

  await prisma.appointment.update({ where: { id: appointment.id }, data: { startTime: start, endTime: end, professionalId } });
  return { ok: true, appointmentId: appointment.id, professional: professional.name, displayTime: formatBusinessDate(start) };
}

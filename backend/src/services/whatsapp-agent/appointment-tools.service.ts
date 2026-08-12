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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false as const, message: 'Data inválida. Use YYYY-MM-DD.' };

  const service = await prisma.service.findFirst({ where: { id: input.serviceId, salonId: input.salon.id, active: true } });
  if (!service) return { ok: false as const, message: 'Serviço não encontrado neste salão.' };

  const professionals = input.professionalId
    ? await prisma.professional.findMany({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
    : await prisma.professional.findMany({ where: { salonId: input.salon.id, active: true }, orderBy: { name: 'asc' } });
  if (!professionals.length) return { ok: false as const, message: 'Nenhum profissional disponível para consulta.' };

  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return { ok: true as const, slots: [], message: 'Domingo não está habilitado na configuração padrão.' };

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
  return { ok: true as const, service: service.name, slots: result };
}

type CreateInput = { salon: AgentSalon; phone: string; serviceId: string; professionalId: string; startTime: string; clientName: string };

async function validateCreateAppointment(input: CreateInput) {
  const [service, professional] = await Promise.all([
    prisma.service.findFirst({ where: { id: input.serviceId, salonId: input.salon.id, active: true } }),
    prisma.professional.findFirst({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
  ]);
  if (!service || !professional) return { ok: false as const, message: 'Serviço ou profissional inválido para este salão.' };
  if (!professionalCanPerform(professional, service.id)) return { ok: false as const, message: `${professional.name} não executa ${service.name}.` };

  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false as const, message: 'Horário inválido ou já passou.' };
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  if (!bookingFitsBusinessWindow(input.salon.openingHours, start, service.durationMin)
    || !bookingFitsProfessionalSchedule({ professional, openingHours: input.salon.openingHours, start, end })) {
    return { ok: false as const, message: 'O horário solicitado não cabe na jornada disponível.' };
  }

  const conflict = await prisma.appointment.findFirst({ where: buildAppointmentConflictWhere({ salonId: input.salon.id, professionalId: professional.id, start, end }) });
  if (conflict) return { ok: false as const, message: 'O horário acabou de ficar indisponível. Consulte novos horários.' };

  return { ok: true as const, service, professional, start, end, phone: normalizePhone(input.phone) };
}

export async function previewCreateAppointment(input: CreateInput) {
  const checked = await validateCreateAppointment(input);
  if (!checked.ok) return checked;
  return {
    ok: true as const,
    service: checked.service.name,
    professional: checked.professional.name,
    startTime: checked.start.toISOString(),
    displayTime: formatBusinessDate(checked.start),
    message: `Agendar ${checked.service.name} com ${checked.professional.name} em ${formatBusinessDate(checked.start)}.`
  };
}

export async function createAppointment(input: CreateInput & { confirmed: boolean }) {
  if (!input.confirmed) return { ok: false as const, requiresConfirmation: true, message: 'A confirmação deve ser validada pelo servidor antes de criar o agendamento.' };
  const checked = await validateCreateAppointment(input);
  if (!checked.ok) return checked;

  const existingClient = await prisma.client.findFirst({ where: { salonId: input.salon.id, phone: checked.phone } });
  const client = existingClient || await prisma.client.create({ data: { name: input.clientName, phone: checked.phone, notes: 'Criado automaticamente pelo agente de WhatsApp.', salonId: input.salon.id } });
  const appointment = await prisma.appointment.create({
    data: { clientName: input.clientName, clientPhone: checked.phone, clientId: client.id, startTime: checked.start, endTime: checked.end, notes: 'Agendado pelo agente de WhatsApp após confirmação explícita.', salonId: input.salon.id, serviceId: checked.service.id, professionalId: checked.professional.id }
  });
  return {
    ok: true as const,
    appointmentId: appointment.id,
    service: checked.service.name,
    professional: checked.professional.name,
    startTime: checked.start.toISOString(),
    displayTime: formatBusinessDate(checked.start),
    message: `Agendamento confirmado: ${checked.service.name} com ${checked.professional.name} em ${formatBusinessDate(checked.start)}.`
  };
}

async function findCancelableAppointment(salonId: string, phone: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, salonId, clientPhone: normalizePhone(phone), status: 'CONFIRMED' },
    include: { service: true, professional: true }
  });
}

export async function previewCancelAppointment(salonId: string, phone: string, appointmentId: string) {
  const appointment = await findCancelableAppointment(salonId, phone, appointmentId);
  if (!appointment) return { ok: false as const, message: 'Agendamento ativo não encontrado para este cliente.' };
  return {
    ok: true as const,
    appointmentId: appointment.id,
    service: appointment.service.name,
    professional: appointment.professional.name,
    displayTime: formatBusinessDate(appointment.startTime),
    message: `Cancelar ${appointment.service.name} com ${appointment.professional.name} em ${formatBusinessDate(appointment.startTime)}.`
  };
}

export async function cancelAppointment(salonId: string, phone: string, appointmentId: string, confirmed: boolean) {
  if (!confirmed) return { ok: false as const, requiresConfirmation: true, message: 'A confirmação deve ser validada pelo servidor antes de cancelar.' };
  const appointment = await findCancelableAppointment(salonId, phone, appointmentId);
  if (!appointment) return { ok: false as const, message: 'Agendamento ativo não encontrado para este cliente.' };
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELED' } });
  return { ok: true as const, appointmentId, message: `Agendamento de ${appointment.service.name} em ${formatBusinessDate(appointment.startTime)} cancelado.` };
}

type RescheduleInput = { salonId: string; phone: string; appointmentId: string; startTime: string; professionalId?: string | null };

async function validateRescheduleAppointment(input: RescheduleInput) {
  const appointment = await prisma.appointment.findFirst({ where: { id: input.appointmentId, salonId: input.salonId, clientPhone: normalizePhone(input.phone), status: 'CONFIRMED' }, include: { service: true } });
  if (!appointment) return { ok: false as const, message: 'Agendamento ativo não encontrado para este cliente.' };

  const professionalId = input.professionalId || appointment.professionalId;
  const [professional, salon] = await Promise.all([
    prisma.professional.findFirst({ where: { id: professionalId, salonId: input.salonId, active: true } }),
    prisma.salon.findUnique({ where: { id: input.salonId }, select: { openingHours: true } })
  ]);
  if (!professional) return { ok: false as const, message: 'Profissional inválido.' };
  if (!salon) return { ok: false as const, message: 'Salão não encontrado.' };
  if (!professionalCanPerform(professional, appointment.service.id)) return { ok: false as const, message: `${professional.name} não executa ${appointment.service.name}.` };

  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false as const, message: 'Novo horário inválido.' };
  const end = new Date(start.getTime() + appointment.service.durationMin * 60_000);
  if (!bookingFitsBusinessWindow(salon.openingHours, start, appointment.service.durationMin)
    || !bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start, end })) {
    return { ok: false as const, message: 'O novo horário fica fora da jornada disponível.' };
  }

  const conflict = await prisma.appointment.findFirst({ where: buildAppointmentConflictWhere({ appointmentId: appointment.id, salonId: input.salonId, professionalId, start, end }) });
  if (conflict) return { ok: false as const, message: 'O novo horário não está mais disponível.' };

  return { ok: true as const, appointment, professional, professionalId, start, end };
}

export async function previewRescheduleAppointment(input: RescheduleInput) {
  const checked = await validateRescheduleAppointment(input);
  if (!checked.ok) return checked;
  return {
    ok: true as const,
    appointmentId: checked.appointment.id,
    service: checked.appointment.service.name,
    professional: checked.professional.name,
    startTime: checked.start.toISOString(),
    displayTime: formatBusinessDate(checked.start),
    message: `Reagendar ${checked.appointment.service.name} para ${formatBusinessDate(checked.start)} com ${checked.professional.name}.`
  };
}

export async function rescheduleAppointment(input: RescheduleInput & { confirmed: boolean }) {
  if (!input.confirmed) return { ok: false as const, requiresConfirmation: true, message: 'A confirmação deve ser validada pelo servidor antes de reagendar.' };
  const checked = await validateRescheduleAppointment(input);
  if (!checked.ok) return checked;

  await prisma.appointment.update({ where: { id: checked.appointment.id }, data: { startTime: checked.start, endTime: checked.end, professionalId: checked.professionalId } });
  return {
    ok: true as const,
    appointmentId: checked.appointment.id,
    professional: checked.professional.name,
    displayTime: formatBusinessDate(checked.start),
    message: `Agendamento reagendado para ${formatBusinessDate(checked.start)} com ${checked.professional.name}.`
  };
}

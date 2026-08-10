import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';
import { enforceSalonModuleAccess, hasSalonModule } from '../services/module-access.service';
import { professionalCanPerform } from '../services/professional-capability.service';
import { bookingFitsProfessionalSchedule } from '../services/professional-schedule.service';
import { bookingFitsBusinessWindow, publicBookingAvailability } from '../services/public-booking-availability.service';
import { expireWaitlistOffers, matchWaitlistAfterAppointmentChange, matchWaitlistForDate } from '../services/waitlist.service';
import { appointmentSchema, appointmentUpdateSchema, objectIdSchema } from './schemas';
import { getPublicSalon, getTenant } from './helpers';

const adminAgendaAccess = {
  preHandler: [ensureAuthenticated, requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']), enforceSalonModuleAccess]
};

const availabilityQuerySchema = z.object({
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido. Use YYYY-MM.').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.').optional()
}).refine((value) => Boolean(value.month || value.date), {
  message: 'Informe month ou date para consultar a disponibilidade.'
});

const smartFitQuerySchema = z.object({
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.')
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');
const waitlistCreateSchema = z.object({
  clientName: z.string().trim().min(3),
  clientPhone: z.string().min(10),
  clientEmail: z.string().email().optional().or(z.literal('')),
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional().or(z.literal('')).transform((value) => value || undefined),
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.'),
  earliestTime: timeSchema.optional().default('00:00'),
  latestTime: timeSchema.optional().default('23:59'),
  notes: z.string().max(500).optional().default('')
}).refine((value) => value.earliestTime <= value.latestTime, {
  path: ['latestTime'], message: 'O horário final deve ser posterior ao horário inicial.'
});

const waitlistUpdateSchema = z.object({
  status: z.enum(['WAITING', 'OFFERED', 'BOOKED', 'CANCELLED']).optional(),
  priority: z.coerce.number().int().min(-5).max(10).optional()
}).refine((value) => value.status !== undefined || value.priority !== undefined, { message: 'Informe status ou prioridade.' });

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function slotInWindow(label: string, earliest: string, latest: string) {
  return label >= earliest && label <= latest;
}

/** Rotas de agenda. A rota POST pública permite ao cliente criar reserva. */
export async function appointmentRoutes(app: FastifyInstance) {
  app.get('/appointments/availability', async (request, reply) => {
    const query = availabilityQuerySchema.parse(request.query);
    const salon = await getPublicSalon(request);
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }

    const availability = await publicBookingAvailability({
      salon,
      serviceId: query.serviceId,
      professionalId: query.professionalId,
      month: query.month,
      date: query.date
    });

    if (!availability) return reply.status(404).send({ message: 'Serviço não encontrado para este salão.' });
    return availability;
  });

  app.get('/appointments', async (request, reply) => {
    const salon = await getPublicSalon(request);
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }
    return prisma.appointment.findMany({
      where: { salonId: salon.id, status: 'CONFIRMED', endTime: { gte: new Date() } },
      select: { professionalId: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' }
    });
  });

  app.post('/appointments/waitlist', async (request, reply) => {
    const data = waitlistCreateSchema.parse(request.body);
    const salon = await getPublicSalon(request);
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'A lista de espera depende do módulo Agenda.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }

    const endOfDesiredDay = new Date(`${data.desiredDate}T23:59:59`);
    if (!Number.isFinite(endOfDesiredDay.getTime()) || endOfDesiredDay < new Date()) {
      return reply.status(400).send({ message: 'Escolha uma data futura para entrar na lista de espera.' });
    }

    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, salonId: salon.id, active: true } }),
      data.professionalId ? prisma.professional.findFirst({ where: { id: data.professionalId, salonId: salon.id, active: true } }) : Promise.resolve(null)
    ]);
    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (data.professionalId && !professional) return reply.status(404).send({ message: 'Profissional não encontrado.' });
    if (professional && !professionalCanPerform(professional, service.id)) {
      return reply.status(409).send({ message: `${professional.name} não executa ${service.name}.` });
    }

    const availability = await publicBookingAvailability({
      salon,
      serviceId: service.id,
      professionalId: professional?.id,
      date: data.desiredDate
    });
    if (availability?.mode === 'day') {
      const compatibleSlot = availability.professionals.some((item) => item.slots.some((slot) => slotInWindow(slot.label, data.earliestTime, data.latestTime)));
      if (compatibleSlot) {
        return reply.status(409).send({ message: 'Já existe um horário disponível dentro dessa preferência. Escolha diretamente no calendário.', code: 'SLOT_AVAILABLE' });
      }
    }

    const phone = normalizePhone(data.clientPhone);
    const duplicate = await prisma.waitlistEntry.findFirst({
      where: {
        salonId: salon.id,
        serviceId: service.id,
        clientPhone: phone,
        desiredDate: data.desiredDate,
        status: { in: ['WAITING', 'OFFERED'] }
      }
    });
    if (duplicate) return reply.status(409).send({ message: 'Você já está na lista de espera para esse serviço e essa data.' });

    const existingClient = await prisma.client.findFirst({ where: { salonId: salon.id, phone } });
    const client = existingClient || await prisma.client.create({
      data: {
        name: data.clientName,
        phone,
        email: data.clientEmail || null,
        notes: 'Criado automaticamente pela lista de espera.',
        salonId: salon.id
      }
    });

    const entry = await prisma.waitlistEntry.create({
      data: {
        clientName: data.clientName,
        clientPhone: phone,
        clientEmail: data.clientEmail || null,
        desiredDate: data.desiredDate,
        earliestTime: data.earliestTime,
        latestTime: data.latestTime,
        notes: data.notes,
        salonId: salon.id,
        serviceId: service.id,
        professionalId: professional?.id || null,
        clientId: client.id
      },
      include: { service: true, professional: true }
    });

    return reply.status(201).send({
      ...entry,
      message: 'Você entrou na lista de espera. Se surgir uma vaga compatível, o GlossFlow poderá avisar pelo WhatsApp.'
    });
  });

  app.get('/admin/appointments', adminAgendaAccess, async (request) => {
    const tenant = getTenant(request);
    return prisma.appointment.findMany({
      where: { salonId: tenant.salonId },
      include: { service: true, professional: true },
      orderBy: { startTime: 'asc' }
    });
  });

  app.get('/admin/appointments/waitlist', adminAgendaAccess, async (request) => {
    const tenant = getTenant(request);
    await expireWaitlistOffers(tenant.salonId);
    return prisma.waitlistEntry.findMany({
      where: { salonId: tenant.salonId },
      include: { service: true, professional: true },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }]
    });
  });

  app.post('/admin/appointments/waitlist/scan', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.body);
    const result = await matchWaitlistForDate({ salonId: tenant.salonId, date });
    if (!result) return { matched: false, message: 'Nenhum cliente da fila possui encaixe compatível neste momento.' };
    if ('offered' in result && result.offered === false) {
      return reply.status(502).send({ ...result, message: 'Encontrei um cliente compatível, mas não consegui enviar a oferta pelo WhatsApp.' });
    }
    return result;
  });

  app.put('/admin/appointments/waitlist/:id', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = waitlistUpdateSchema.parse(request.body);
    const current = await prisma.waitlistEntry.findFirst({ where: { id, salonId: tenant.salonId } });
    if (!current) return reply.status(404).send({ message: 'Entrada da lista de espera não encontrada.' });
    return prisma.waitlistEntry.update({ where: { id }, data, include: { service: true, professional: true } });
  });

  app.get('/admin/appointments/smart-fit', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const query = smartFitQuerySchema.parse(request.query);
    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { id: true, openingHours: true } });
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const availability = await publicBookingAvailability({
      salon,
      serviceId: query.serviceId,
      professionalId: query.professionalId,
      date: query.date
    });
    if (!availability) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (availability.mode !== 'day') return reply.status(400).send({ message: 'Não foi possível calcular o encaixe para este dia.' });

    return {
      date: query.date,
      service: availability.service,
      totalCapacity: availability.totalCapacity,
      strategy: availability.smartFit?.strategy || 'BEST_FIT',
      suggestions: availability.smartFit?.recommendedSlots || []
    };
  });

  app.post('/appointments', async (request, reply) => {
    const data = appointmentSchema.parse(request.body);
    const salon = await getPublicSalon(request);
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }

    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, salonId: salon.id, active: true } }),
      prisma.professional.findFirst({ where: { id: data.professionalId, salonId: salon.id, active: true } })
    ]);

    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    if (!professionalCanPerform(professional, service.id)) {
      return reply.status(409).send({ message: `${professional.name} não está configurado para executar ${service.name}. Escolha outro profissional.` });
    }

    const start = new Date(data.startTime);
    if (start.getTime() <= Date.now()) return reply.status(400).send({ message: 'Escolha um horário futuro para o agendamento.' });
    if (!bookingFitsBusinessWindow(salon.openingHours, start, service.durationMin)) {
      return reply.status(400).send({ message: 'Este serviço não cabe integralmente dentro do horário de funcionamento escolhido. Selecione outro horário.' });
    }

    const end = new Date(start.getTime() + service.durationMin * 60_000);
    if (!bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start, end })) {
      return reply.status(409).send({ message: `${professional.name} não está disponível durante todo o período necessário para este serviço. Escolha outro horário.` });
    }

    const conflict = await prisma.appointment.findFirst({
      where: { salonId: salon.id, professionalId: professional.id, status: 'CONFIRMED', OR: [{ startTime: { lt: end }, endTime: { gt: start } }] }
    });
    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento que ocupa parte deste período. Escolha outro horário.' });

    const existingClient = await prisma.client.findFirst({ where: { salonId: salon.id, phone: data.clientPhone } });
    const client = existingClient || await prisma.client.create({
      data: { name: data.clientName, phone: data.clientPhone, email: data.clientEmail || null, notes: 'Criado automaticamente pelo agendamento público.', salonId: salon.id }
    });

    const appointment = await prisma.appointment.create({
      data: {
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || null,
        clientId: client.id,
        startTime: start,
        endTime: end,
        notes: data.notes,
        salonId: salon.id,
        serviceId: service.id,
        professionalId: professional.id
      }
    });

    return reply.status(201).send(appointment);
  });

  app.put('/admin/appointments/:id', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = appointmentUpdateSchema.parse(request.body);

    const current = await prisma.appointment.findFirst({
      where: { id, salonId: tenant.salonId },
      include: { service: true, professional: true }
    });
    if (!current) return reply.status(404).send({ message: 'Agendamento não encontrado.' });

    const changesSchedule = Boolean(data.startTime || data.professionalId);
    if (!changesSchedule) {
      if (!data.status) return current;
      const updated = await prisma.appointment.update({
        where: { id }, data: { status: data.status }, include: { service: true, professional: true }
      });
      if (current.status === 'CONFIRMED' && data.status === 'CANCELED') {
        setImmediate(() => {
          void matchWaitlistAfterAppointmentChange({ salonId: tenant.salonId, previousStartTime: current.startTime })
            .catch((error) => app.log.error(error, 'Falha ao processar lista de espera após cancelamento.'));
        });
      }
      return updated;
    }

    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { openingHours: true } });
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const professionalId = data.professionalId || current.professionalId;
    const professional = await prisma.professional.findFirst({ where: { id: professionalId, salonId: tenant.salonId, active: true } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    if (!professionalCanPerform(professional, current.service.id)) {
      return reply.status(409).send({ message: `${professional.name} não está configurado para executar ${current.service.name}.` });
    }

    const start = data.startTime ? new Date(data.startTime) : current.startTime;
    const end = new Date(start.getTime() + current.service.durationMin * 60_000);
    if (!bookingFitsBusinessWindow(salon.openingHours, start, current.service.durationMin)
      || !bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start, end })) {
      return reply.status(409).send({ message: 'O novo horário fica fora da jornada disponível deste profissional.' });
    }

    const conflict = await prisma.appointment.findFirst({
      where: { id: { not: id }, salonId: tenant.salonId, professionalId, status: 'CONFIRMED', OR: [{ startTime: { lt: end }, endTime: { gt: start } }] }
    });
    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento neste horário.' });

    const updated = await prisma.appointment.update({
      where: { id },
      data: { startTime: start, endTime: end, professionalId, ...(data.status ? { status: data.status } : {}) },
      include: { service: true, professional: true }
    });

    const freedPreviousSpace = current.status === 'CONFIRMED'
      && (current.startTime.getTime() !== start.getTime() || current.professionalId !== professionalId || data.status === 'CANCELED');
    if (freedPreviousSpace) {
      setImmediate(() => {
        void matchWaitlistAfterAppointmentChange({ salonId: tenant.salonId, previousStartTime: current.startTime })
          .catch((error) => app.log.error(error, 'Falha ao processar lista de espera após reagendamento.'));
      });
    }
    return updated;
  });
}

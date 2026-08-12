import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { appointmentSchema } from '../schemas';
import { getPublicSalon } from '../helpers';
import { hasSalonModule } from '../../services/module-access.service';
import { getTenantSubscriptionAccess } from '../../services/saas-lifecycle.service';
import { professionalCanPerform } from '../../services/professional-capability.service';
import { bookingFitsProfessionalSchedule } from '../../services/professional-schedule.service';
import { bookingFitsBusinessWindow, publicBookingAvailability } from '../../services/public-booking-availability.service';
import { cancellationMinHours, createAppointmentManagementAccess, notifyAppointmentCreated } from '../../services/appointment-notification.service';
import { buildAppointmentConflictWhere } from '../../services/appointment-reschedule.service';
import { availabilityQuerySchema, normalizePhone } from './contracts';

async function ensureBookingContract(salonId: string, reply: FastifyReply) {
  const access = await getTenantSubscriptionAccess(salonId);
  if (access.allowed) return true;
  reply.status(403).send({
    message: 'Agendamento online temporariamente indisponível para este salão.',
    code: access.code,
    subscriptionStatus: access.status
  });
  return false;
}

export async function publicAppointmentRoutes(app: FastifyInstance) {
  app.get('/appointments/availability', async (request, reply) => {
    const query = availabilityQuerySchema.parse(request.query);
    const salon = await getPublicSalon(request);
    if (!await ensureBookingContract(salon.id, reply)) return;
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }
    const availability = await publicBookingAvailability({ salon, serviceId: query.serviceId, professionalId: query.professionalId, month: query.month, date: query.date });
    if (!availability) return reply.status(404).send({ message: 'Serviço não encontrado para este salão.' });
    return availability;
  });

  app.get('/appointments', async (request, reply) => {
    const salon = await getPublicSalon(request);
    if (!await ensureBookingContract(salon.id, reply)) return;
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }
    return prisma.appointment.findMany({
      where: { salonId: salon.id, status: 'CONFIRMED', endTime: { gte: new Date() } },
      select: { professionalId: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' }
    });
  });

  app.post('/appointments', async (request, reply) => {
    const data = appointmentSchema.parse(request.body);
    const salon = await getPublicSalon(request);
    if (!await ensureBookingContract(salon.id, reply)) return;
    if (!hasSalonModule(salon, 'AGENDA')) {
      return reply.status(403).send({ message: 'Agendamento online não está habilitado para este salão.', code: 'MODULE_DISABLED', module: 'AGENDA' });
    }

    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, salonId: salon.id, active: true } }),
      prisma.professional.findFirst({ where: { id: data.professionalId, salonId: salon.id, active: true } })
    ]);
    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    if (!professionalCanPerform(professional, service.id)) return reply.status(409).send({ message: `${professional.name} não está configurado para executar ${service.name}. Escolha outro profissional.` });

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
      where: buildAppointmentConflictWhere({ salonId: salon.id, professionalId: professional.id, start, end })
    });
    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento que ocupa parte deste período. Escolha outro horário.' });

    const clientPhone = normalizePhone(data.clientPhone);
    const existingClient = await prisma.client.findFirst({ where: { salonId: salon.id, phone: clientPhone } });
    const client = existingClient || await prisma.client.create({
      data: { name: data.clientName, phone: clientPhone, email: data.clientEmail || null, notes: 'Criado automaticamente pelo agendamento público.', salonId: salon.id }
    });

    const appointment = await prisma.appointment.create({
      data: {
        clientName: data.clientName,
        clientPhone,
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

    const management = await createAppointmentManagementAccess({ salonId: salon.id, salonSlug: salon.slug, customDomain: salon.customDomain, appointmentId: appointment.id });
    const clientNotification = await notifyAppointmentCreated({
      salonId: salon.id,
      salonName: salon.name,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      appointmentId: appointment.id,
      serviceName: service.name,
      professionalId: professional.id,
      professionalName: professional.name,
      startTime: appointment.startTime,
      managementUrl: management.url
    });

    return reply.status(201).send({
      ...appointment,
      confirmation: {
        confirmed: true,
        protocol: appointment.id.slice(-8).toUpperCase(),
        cancellationMinHours: cancellationMinHours(),
        managementUrl: management.url,
        managementToken: management.token,
        clientNotification: clientNotification.ok ? 'SENT' : 'FAILED'
      }
    });
  });
}

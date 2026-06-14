import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { appointmentSchema, appointmentUpdateSchema, objectIdSchema } from './schemas';
import { getMainSalon, getTenant } from './helpers';

/** Rotas de agenda. A rota POST pública permite ao cliente criar reserva. */
export async function appointmentRoutes(app: FastifyInstance) {
  app.get('/appointments', async () => {
    const salon = await getMainSalon();
    return prisma.appointment.findMany({
      where: { salonId: salon.id },
      include: { service: true, professional: true },
      orderBy: { startTime: 'asc' }
    });
  });

  app.post('/appointments', async (request, reply) => {
    const data = appointmentSchema.parse(request.body);
    const salon = await getMainSalon();
    const service = await prisma.service.findFirst({ where: { id: data.serviceId, salonId: salon.id, active: true } });

    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });

    const start = new Date(data.startTime);
    const end = new Date(start.getTime() + service.durationMin * 60_000);

    const conflict = await prisma.appointment.findFirst({
      where: { professionalId: data.professionalId, status: 'CONFIRMED', OR: [{ startTime: { lt: end }, endTime: { gt: start } }] }
    });

    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento neste horário.' });

    // CRM automático: todo cliente que agenda entra na base de relacionamento.
    const existingClient = await prisma.client.findFirst({ where: { salonId: salon.id, phone: data.clientPhone } });
    const client = existingClient || await prisma.client.create({
      data: { name: data.clientName, phone: data.clientPhone, email: data.clientEmail || null, notes: 'Criado automaticamente pelo agendamento público.', salonId: salon.id }
    });

    const appointment = await prisma.appointment.create({
      data: { clientName: data.clientName, clientPhone: data.clientPhone, clientEmail: data.clientEmail || null, clientId: client.id, startTime: start, endTime: end, notes: data.notes, salonId: salon.id, serviceId: data.serviceId, professionalId: data.professionalId }
    });

    return reply.status(201).send(appointment);
  });

  app.get('/admin/appointments', async (request) => {
    const tenant = getTenant(request);
    return prisma.appointment.findMany({ where: { salonId: tenant.salonId }, include: { service: true, professional: true }, orderBy: { startTime: 'asc' } });
  });

  /**
   * Reagendamento visual da Agenda Enterprise.
   * Permite mover um atendimento por drag and drop no frontend com validação
   * contra conflitos de horário do mesmo profissional.
   */
  app.put('/admin/appointments/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = appointmentUpdateSchema.parse(request.body);

    const current = await prisma.appointment.findFirst({ where: { id, salonId: tenant.salonId }, include: { service: true } });
    if (!current) return reply.status(404).send({ message: 'Agendamento não encontrado.' });

    const professionalId = data.professionalId || current.professionalId;
    const start = data.startTime ? new Date(data.startTime) : current.startTime;
    const end = new Date(start.getTime() + current.service.durationMin * 60_000);

    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        salonId: tenant.salonId,
        professionalId,
        status: 'CONFIRMED',
        OR: [{ startTime: { lt: end }, endTime: { gt: start } }]
      }
    });

    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento neste horário.' });

    return prisma.appointment.update({
      where: { id },
      data: { startTime: start, endTime: end, professionalId, ...(data.status ? { status: data.status } : {}) },
      include: { service: true, professional: true }
    });
  });
}


import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  cancellationMinHours,
  createAppointmentManagementAccess,
  notifyAppointmentCreated
} from '../services/appointment-notification.service';
import { professionalCanPerform } from '../services/professional-capability.service';
import { bookingFitsProfessionalSchedule } from '../services/professional-schedule.service';
import { bookingFitsBusinessWindow } from '../services/public-booking-availability.service';
import { appointmentSchema, objectIdSchema } from './schemas';
import { getTenant } from './helpers';

const ATTENDANCE_RESOURCE = 'AppointmentAttendance';
const attendanceSchema = z.object({
  status: z.enum(['SCHEDULED', 'ARRIVED', 'IN_SERVICE'])
});

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function ensureManager(role: string, reply: FastifyReply) {
  if (['ADMIN', 'RECEPTION'].includes(role)) return true;
  reply.status(403).send({ message: 'Somente administração ou recepção podem criar horários e bloqueios pela agenda operacional.' });
  return false;
}

/**
 * Ações específicas da mesa de trabalho da recepção.
 * As regras de jornada, capacidade e conflitos continuam centralizadas nos mesmos
 * serviços usados pelo agendamento público e pelo WhatsApp.
 */
export async function operationalAgendaRoutes(app: FastifyInstance) {
  app.get('/admin/appointments/operational-options', async (request) => {
    const tenant = getTenant(request);
    const [services, attendanceLogs] = await Promise.all([
      prisma.service.findMany({
        where: { salonId: tenant.salonId, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMin: true, price: true }
      }),
      prisma.auditLog.findMany({
        where: {
          salonId: tenant.salonId,
          resource: ATTENDANCE_RESOURCE,
          action: 'ATTENDANCE_STATUS_SET'
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { resourceId: true, metadata: true }
      })
    ]);

    const attendanceByAppointment: Record<string, string> = {};
    for (const item of attendanceLogs) {
      if (!item.resourceId || attendanceByAppointment[item.resourceId]) continue;
      const metadata = (item.metadata || {}) as Record<string, unknown>;
      attendanceByAppointment[item.resourceId] = String(metadata.status || 'SCHEDULED');
    }

    return {
      role: tenant.role,
      services,
      attendanceByAppointment
    };
  });

  app.post('/admin/appointments/quick-create', async (request, reply) => {
    const tenant = getTenant(request);
    if (!ensureManager(tenant.role, reply)) return;
    const data = appointmentSchema.parse(request.body);

    const [salon, service, professional] = await Promise.all([
      prisma.salon.findUnique({
        where: { id: tenant.salonId },
        select: { id: true, slug: true, name: true, openingHours: true, customDomain: true }
      }),
      prisma.service.findFirst({ where: { id: data.serviceId, salonId: tenant.salonId, active: true } }),
      prisma.professional.findFirst({ where: { id: data.professionalId, salonId: tenant.salonId, active: true } })
    ]);

    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });
    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    if (!professionalCanPerform(professional, service.id)) {
      return reply.status(409).send({ message: `${professional.name} não está configurado para executar ${service.name}.` });
    }

    const start = new Date(data.startTime);
    if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
      return reply.status(400).send({ message: 'Escolha um horário futuro para o agendamento.' });
    }
    const end = new Date(start.getTime() + service.durationMin * 60_000);

    if (!bookingFitsBusinessWindow(salon.openingHours, start, service.durationMin)
      || !bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start, end })) {
      return reply.status(409).send({ message: 'O serviço não cabe integralmente na jornada disponível deste profissional.' });
    }

    const conflict = await prisma.appointment.findFirst({
      where: {
        salonId: tenant.salonId,
        professionalId: professional.id,
        status: 'CONFIRMED',
        OR: [{ startTime: { lt: end }, endTime: { gt: start } }]
      },
      select: { id: true }
    });
    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui atendimento ocupando parte desse período.' });

    const clientPhone = normalizePhone(data.clientPhone);
    const existingClient = await prisma.client.findFirst({ where: { salonId: tenant.salonId, phone: clientPhone } });
    const client = existingClient || await prisma.client.create({
      data: {
        name: data.clientName,
        phone: clientPhone,
        email: data.clientEmail || null,
        notes: 'Criado automaticamente pela Agenda Operacional.',
        salonId: tenant.salonId
      }
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
        salonId: tenant.salonId,
        serviceId: service.id,
        professionalId: professional.id
      },
      include: { service: true, professional: true }
    });

    const management = await createAppointmentManagementAccess({
      salonId: salon.id,
      salonSlug: salon.slug,
      customDomain: salon.customDomain,
      appointmentId: appointment.id
    });

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
        clientNotification: clientNotification.ok ? 'SENT' : 'FAILED'
      }
    });
  });

  app.put('/admin/appointments/:id/attendance', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = attendanceSchema.parse(request.body);

    const appointment = await prisma.appointment.findFirst({
      where: { id, salonId: tenant.salonId },
      select: { id: true, status: true, clientName: true }
    });
    if (!appointment) return reply.status(404).send({ message: 'Agendamento não encontrado.' });
    if (appointment.status !== 'CONFIRMED') {
      return reply.status(409).send({ message: 'O estado operacional só pode ser alterado em um atendimento confirmado.' });
    }

    await prisma.auditLog.create({
      data: {
        action: 'ATTENDANCE_STATUS_SET',
        resource: ATTENDANCE_RESOURCE,
        resourceId: appointment.id,
        method: 'USER',
        path: `/admin/appointments/${appointment.id}/attendance`,
        userId: tenant.id,
        salonId: tenant.salonId,
        metadata: { status: data.status, clientName: appointment.clientName }
      }
    });

    return { appointmentId: appointment.id, attendanceStatus: data.status };
  });
}

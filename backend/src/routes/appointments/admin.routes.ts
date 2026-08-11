import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { professionalCanPerform } from '../../services/professional-capability.service';
import { bookingFitsProfessionalSchedule } from '../../services/professional-schedule.service';
import { bookingFitsBusinessWindow, publicBookingAvailability } from '../../services/public-booking-availability.service';
import {
  createOperationalNotification,
  listOperationalNotifications,
  markAllOperationalNotificationsRead,
  markOperationalNotificationRead,
  notifyAppointmentCancelled
} from '../../services/appointment-notification.service';
import { matchWaitlistAfterAppointmentChange } from '../../services/waitlist.service';
import { buildAppointmentConflictWhere, changesAppointmentSchedule, resolveAppointmentSchedule } from '../../services/appointment-reschedule.service';
import { adminAgendaAccess } from './access';
import { appointmentUpdateSchema, idParamSchema, smartFitQuerySchema } from './contracts';

export async function adminAppointmentRoutes(app: FastifyInstance) {
  app.get('/admin/appointments', adminAgendaAccess, async (request) => {
    const tenant = getTenant(request);
    return prisma.appointment.findMany({ where: { salonId: tenant.salonId }, include: { service: true, professional: true }, orderBy: { startTime: 'asc' } });
  });

  app.get('/admin/appointments/notifications', adminAgendaAccess, async (request) => {
    const tenant = getTenant(request);
    const notifications = await listOperationalNotifications({ salonId: tenant.salonId, userId: tenant.id, limit: 50 });
    return { notifications, unread: notifications.filter((item) => !item.read).length };
  });

  app.put('/admin/appointments/notifications/read-all', adminAgendaAccess, async (request) => {
    const tenant = getTenant(request);
    return markAllOperationalNotificationsRead({ salonId: tenant.salonId, userId: tenant.id });
  });

  app.put('/admin/appointments/notifications/:id/read', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = idParamSchema.parse(request.params);
    const marked = await markOperationalNotificationRead({ salonId: tenant.salonId, userId: tenant.id, notificationId: id });
    if (!marked) return reply.status(404).send({ message: 'Notificação não encontrada.' });
    return { read: true };
  });

  app.get('/admin/appointments/smart-fit', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const query = smartFitQuerySchema.parse(request.query);
    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { id: true, openingHours: true } });
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });
    const availability = await publicBookingAvailability({ salon, serviceId: query.serviceId, professionalId: query.professionalId, date: query.date });
    if (!availability) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (availability.mode !== 'day') return reply.status(400).send({ message: 'Não foi possível calcular o encaixe para este dia.' });
    return { date: query.date, service: availability.service, totalCapacity: availability.totalCapacity, strategy: availability.smartFit?.strategy || 'BEST_FIT', suggestions: availability.smartFit?.recommendedSlots || [] };
  });

  app.put('/admin/appointments/:id', adminAgendaAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = idParamSchema.parse(request.params);
    const data = appointmentUpdateSchema.parse(request.body);
    const current = await prisma.appointment.findFirst({ where: { id, salonId: tenant.salonId }, include: { service: true, professional: true } });
    if (!current) return reply.status(404).send({ message: 'Agendamento não encontrado.' });

    if (!changesAppointmentSchedule(data)) {
      if (!data.status) return current;
      const updated = await prisma.appointment.update({ where: { id }, data: { status: data.status }, include: { service: true, professional: true } });
      if (current.status === 'CONFIRMED' && data.status === 'CANCELED') {
        const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { name: true } });
        await notifyAppointmentCancelled({
          salonId: tenant.salonId,
          salonName: salon?.name || 'salão',
          clientName: current.clientName,
          clientPhone: current.clientPhone,
          appointmentId: current.id,
          serviceName: current.service.name,
          professionalId: current.professional.id,
          professionalName: current.professional.name,
          startTime: current.startTime,
          cancelledBy: 'TEAM'
        });
        setImmediate(() => { void matchWaitlistAfterAppointmentChange({ salonId: tenant.salonId, previousStartTime: current.startTime }).catch((error) => app.log.error(error, 'Falha ao processar lista de espera após cancelamento.')); });
      }
      return updated;
    }

    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { openingHours: true } });
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const schedule = resolveAppointmentSchedule({ current, data, durationMin: current.service.durationMin });
    const professional = await prisma.professional.findFirst({ where: { id: schedule.professionalId, salonId: tenant.salonId, active: true } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    if (!professionalCanPerform(professional, current.service.id)) return reply.status(409).send({ message: `${professional.name} não está configurado para executar ${current.service.name}.` });

    if (!bookingFitsBusinessWindow(salon.openingHours, schedule.start, current.service.durationMin)
      || !bookingFitsProfessionalSchedule({ professional, openingHours: salon.openingHours, start: schedule.start, end: schedule.end })) {
      return reply.status(409).send({ message: 'O novo horário fica fora da jornada disponível deste profissional.' });
    }

    const conflict = await prisma.appointment.findFirst({ where: buildAppointmentConflictWhere({ appointmentId: id, salonId: tenant.salonId, professionalId: schedule.professionalId, start: schedule.start, end: schedule.end }) });
    if (conflict) return reply.status(409).send({ message: 'Este profissional já possui agendamento neste horário.' });

    const updated = await prisma.appointment.update({
      where: { id },
      data: { startTime: schedule.start, endTime: schedule.end, professionalId: schedule.professionalId, ...(data.status ? { status: data.status } : {}) },
      include: { service: true, professional: true }
    });

    const freedPreviousSpace = current.status === 'CONFIRMED'
      && (current.startTime.getTime() !== schedule.start.getTime() || current.professionalId !== schedule.professionalId || data.status === 'CANCELED');
    if (freedPreviousSpace) {
      await createOperationalNotification({ salonId: tenant.salonId, type: 'APPOINTMENT_RESCHEDULED', title: 'Agendamento reagendado', message: `${current.clientName} foi movido para um novo horário/profissional.`, appointmentId: current.id, professionalId: schedule.professionalId, clientName: current.clientName, severity: 'INFO' });
      setImmediate(() => { void matchWaitlistAfterAppointmentChange({ salonId: tenant.salonId, previousStartTime: current.startTime }).catch((error) => app.log.error(error, 'Falha ao processar lista de espera após reagendamento.')); });
    }
    return updated;
  });
}

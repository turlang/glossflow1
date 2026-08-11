import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getPublicSalon } from '../helpers';
import { managementQuerySchema } from './contracts';
import { cancellationWindow } from './access';
import { notifyAppointmentCancelled, validateAppointmentManagementAccess } from '../../services/appointment-notification.service';
import { matchWaitlistAfterAppointmentChange } from '../../services/waitlist.service';

export async function managementAppointmentRoutes(app: FastifyInstance) {
  app.get('/appointments/manage', async (request, reply) => {
    const query = managementQuerySchema.parse(request.query);
    const salon = await getPublicSalon(request);
    const valid = await validateAppointmentManagementAccess({ salonId: salon.id, appointmentId: query.appointmentId, token: query.token });
    if (!valid) return reply.status(404).send({ message: 'Link de gerenciamento inválido ou expirado.' });

    const appointment = await prisma.appointment.findFirst({ where: { id: query.appointmentId, salonId: salon.id }, include: { service: true, professional: true } });
    if (!appointment) return reply.status(404).send({ message: 'Agendamento não encontrado.' });
    const policy = cancellationWindow(appointment.startTime);

    return {
      id: appointment.id,
      clientName: appointment.clientName,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      service: { id: appointment.service.id, name: appointment.service.name, durationMin: appointment.service.durationMin },
      professional: { id: appointment.professional.id, name: appointment.professional.name },
      cancellationPolicy: { minHours: policy.minHours, cancelUntil: policy.cancelUntil, canCancel: appointment.status === 'CONFIRMED' && policy.canCancel }
    };
  });

  app.post('/appointments/cancel', async (request, reply) => {
    const data = managementQuerySchema.parse(request.body);
    const salon = await getPublicSalon(request);
    const valid = await validateAppointmentManagementAccess({ salonId: salon.id, appointmentId: data.appointmentId, token: data.token });
    if (!valid) return reply.status(404).send({ message: 'Link de gerenciamento inválido ou expirado.' });

    const appointment = await prisma.appointment.findFirst({ where: { id: data.appointmentId, salonId: salon.id }, include: { service: true, professional: true } });
    if (!appointment) return reply.status(404).send({ message: 'Agendamento não encontrado.' });
    if (appointment.status === 'CANCELED') return { cancelled: true, alreadyCancelled: true, message: 'Este agendamento já está cancelado.' };
    if (appointment.status !== 'CONFIRMED') return reply.status(409).send({ message: 'Este agendamento não pode mais ser cancelado pelo cliente.' });

    const policy = cancellationWindow(appointment.startTime);
    if (!policy.canCancel) {
      return reply.status(409).send({
        message: `O cancelamento online precisa ser feito com no mínimo ${policy.minHours} horas de antecedência. Entre em contato com o salão para verificar uma exceção.`,
        code: 'CANCELLATION_WINDOW_CLOSED', minHours: policy.minHours, cancelUntil: policy.cancelUntil
      });
    }

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELED' } });
    const notification = await notifyAppointmentCancelled({
      salonId: salon.id,
      salonName: salon.name,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      appointmentId: appointment.id,
      serviceName: appointment.service.name,
      professionalId: appointment.professional.id,
      professionalName: appointment.professional.name,
      startTime: appointment.startTime,
      cancelledBy: 'CLIENT'
    });

    setImmediate(() => {
      void matchWaitlistAfterAppointmentChange({ salonId: salon.id, previousStartTime: appointment.startTime })
        .catch((error) => app.log.error(error, 'Falha ao processar lista de espera após cancelamento do cliente.'));
    });

    return { cancelled: true, message: 'Agendamento cancelado com sucesso. O horário foi liberado na agenda.', clientNotification: notification.ok ? 'SENT' : 'FAILED' };
  });
}

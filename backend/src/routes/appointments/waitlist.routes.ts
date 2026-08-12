import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getPublicSalon, getTenant } from '../helpers';
import { hasSalonModule } from '../../services/module-access.service';
import { professionalCanPerform } from '../../services/professional-capability.service';
import { publicBookingAvailability } from '../../services/public-booking-availability.service';
import { createOperationalNotification } from '../../services/appointment-notification.service';
import { expireWaitlistOffers, matchWaitlistForDate } from '../../services/waitlist.service';
import { agendaManageAccess } from './access';
import { idParamSchema, normalizePhone, slotInWindow, waitlistCreateSchema, waitlistScanSchema, waitlistUpdateSchema } from './contracts';

export async function waitlistAppointmentRoutes(app: FastifyInstance) {
  app.post('/appointments/waitlist', async (request, reply) => {
    const data = waitlistCreateSchema.parse(request.body);
    const salon = await getPublicSalon(request);
    if (!hasSalonModule(salon, 'AGENDA')) return reply.status(403).send({ message: 'A lista de espera depende do módulo Agenda.', code: 'MODULE_DISABLED', module: 'AGENDA' });

    const endOfDesiredDay = new Date(`${data.desiredDate}T23:59:59`);
    if (!Number.isFinite(endOfDesiredDay.getTime()) || endOfDesiredDay < new Date()) return reply.status(400).send({ message: 'Escolha uma data futura para entrar na lista de espera.' });

    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, salonId: salon.id, active: true } }),
      data.professionalId ? prisma.professional.findFirst({ where: { id: data.professionalId, salonId: salon.id, active: true } }) : Promise.resolve(null)
    ]);
    if (!service) return reply.status(404).send({ message: 'Serviço não encontrado.' });
    if (data.professionalId && !professional) return reply.status(404).send({ message: 'Profissional não encontrado.' });
    if (professional && !professionalCanPerform(professional, service.id)) return reply.status(409).send({ message: `${professional.name} não executa ${service.name}.` });

    const availability = await publicBookingAvailability({ salon, serviceId: service.id, professionalId: professional?.id, date: data.desiredDate });
    if (availability?.mode === 'day') {
      const compatibleSlot = availability.professionals.some((item) => item.slots.some((slot) => slotInWindow(slot.label, data.earliestTime, data.latestTime)));
      if (compatibleSlot) return reply.status(409).send({ message: 'Já existe um horário disponível dentro dessa preferência. Escolha diretamente no calendário.', code: 'SLOT_AVAILABLE' });
    }

    const phone = normalizePhone(data.clientPhone);
    const duplicate = await prisma.waitlistEntry.findFirst({ where: { salonId: salon.id, serviceId: service.id, clientPhone: phone, desiredDate: data.desiredDate, status: { in: ['WAITING', 'OFFERED'] } } });
    if (duplicate) return reply.status(409).send({ message: 'Você já está na lista de espera para esse serviço e essa data.' });

    const existingClient = await prisma.client.findFirst({ where: { salonId: salon.id, phone } });
    const client = existingClient || await prisma.client.create({ data: { name: data.clientName, phone, email: data.clientEmail || null, notes: 'Criado automaticamente pela lista de espera.', salonId: salon.id } });

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

    return reply.status(201).send({ ...entry, message: 'Você entrou na lista de espera. Se surgir uma vaga compatível, o GlossFlow poderá avisar pelo WhatsApp.' });
  });

  app.get('/admin/appointments/waitlist', agendaManageAccess, async (request) => {
    const tenant = getTenant(request);
    await expireWaitlistOffers(tenant.salonId);
    return prisma.waitlistEntry.findMany({ where: { salonId: tenant.salonId }, include: { service: true, professional: true }, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }] });
  });

  app.post('/admin/appointments/waitlist/scan', agendaManageAccess, async (request) => {
    const tenant = getTenant(request);
    const { date } = waitlistScanSchema.parse(request.body);
    const result = await matchWaitlistForDate({ salonId: tenant.salonId, date });
    if (!result) return { matched: false, message: 'Nenhum cliente da fila possui encaixe compatível neste momento.' };
    if ('offered' in result && result.offered === false) {
      await createOperationalNotification({ salonId: tenant.salonId, type: 'WAITLIST_ACTION_REQUIRED', title: 'Lista de espera precisa de atenção', message: 'Encontrei um cliente compatível, mas o WhatsApp não entregou a oferta. Verifique a integração ou faça contato manual com o cliente.', severity: 'WARNING' });
      return { ...result, warning: true, message: 'Encontrei um cliente compatível, mas não consegui enviar a oferta pelo WhatsApp. A equipe foi notificada para fazer contato manual.' };
    }
    return result;
  });

  app.put('/admin/appointments/waitlist/:id', agendaManageAccess, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = idParamSchema.parse(request.params);
    const data = waitlistUpdateSchema.parse(request.body);
    const current = await prisma.waitlistEntry.findFirst({ where: { id, salonId: tenant.salonId } });
    if (!current) return reply.status(404).send({ message: 'Entrada da lista de espera não encontrada.' });
    return prisma.waitlistEntry.update({ where: { id }, data, include: { service: true, professional: true } });
  });
}

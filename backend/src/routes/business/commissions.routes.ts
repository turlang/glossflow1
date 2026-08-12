import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { commissionRuleSchema, objectIdSchema } from '../schemas';
import { businessAdminOnly } from './access';

/** Regras e projeções de comissão do salão autenticado. */
export async function businessCommissionRoutes(app: FastifyInstance) {
  app.get('/admin/commissions', businessAdminOnly, async (request) => {
    const tenant = getTenant(request);
    const [rules, appointments] = await Promise.all([
      prisma.commissionRule.findMany({
        where: { salonId: tenant.salonId },
        include: { professional: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.appointment.findMany({
        where: { salonId: tenant.salonId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        include: { service: true, professional: true }
      })
    ]);

    const projections = appointments.map((appointment) => {
      const rule = rules.find((item) => item.professionalId === appointment.professionalId && item.active);
      const percentage = rule?.percentage ?? 40;
      return {
        appointmentId: appointment.id,
        professional: appointment.professional.name,
        service: appointment.service.name,
        baseValue: appointment.service.price,
        percentage,
        commission: appointment.service.price * (percentage / 100),
        commissionPaid: appointment.commissionPaid
      };
    });

    return { rules, projections };
  });

  app.post('/admin/commissions/rules', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const data = commissionRuleSchema.parse(request.body);
    const professional = await prisma.professional.findFirst({ where: { id: data.professionalId, salonId: tenant.salonId } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    return reply.status(201).send(await prisma.commissionRule.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/commissions/rules/:id', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = commissionRuleSchema.parse(request.body);
    const professional = await prisma.professional.findFirst({ where: { id: data.professionalId, salonId: tenant.salonId } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    const result = await prisma.commissionRule.updateMany({ where: { id, salonId: tenant.salonId }, data });
    if (result.count === 0) return reply.status(404).send({ message: 'Regra de comissão não encontrada neste salão.' });
    return prisma.commissionRule.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/commissions/rules/:id', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.commissionRule.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Regra de comissão não encontrada neste salão.' });
    return reply.status(204).send();
  });
}

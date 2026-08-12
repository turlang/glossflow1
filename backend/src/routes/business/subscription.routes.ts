import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { salonSubscriptionSchema, subscriptionPlanSchema } from '../schemas';
import { businessAdminOnly } from './access';

/** Consulta de assinatura do tenant; mutações globais continuam bloqueadas no compositor. */
export async function businessSubscriptionRoutes(app: FastifyInstance) {
  app.get('/admin/subscription', businessAdminOnly, async (request) => {
    const tenant = getTenant(request);
    const [plans, subscription] = await Promise.all([
      prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
      prisma.salonSubscription.findUnique({ where: { salonId: tenant.salonId }, include: { plan: true } })
    ]);
    return { plans, subscription };
  });

  app.post('/admin/subscription/plans', businessAdminOnly, async (request, reply) => {
    const data = subscriptionPlanSchema.parse(request.body);
    return reply.status(201).send(await prisma.subscriptionPlan.create({ data }));
  });

  app.put('/admin/subscription', businessAdminOnly, async (request) => {
    const tenant = getTenant(request);
    const data = salonSubscriptionSchema.parse(request.body);
    return prisma.salonSubscription.upsert({
      where: { salonId: tenant.salonId },
      create: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null, salonId: tenant.salonId },
      update: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null }
    });
  });
}

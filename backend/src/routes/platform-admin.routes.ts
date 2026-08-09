import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DEFAULT_ENABLED_MODULES, MODULE_LABELS, normalizeEnabledModules, SALON_MODULES } from '../services/module-access.service';

function brl(value: number) {
  return Number(value || 0).toFixed(2);
}

const salonIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de salão inválido.');
const modulesSchema = z.object({
  enabledModules: z.array(z.enum(SALON_MODULES)).default([])
});

/**
 * Rotas exclusivas do Super Admin GlossFlow.
 * Nunca dependem de salonId para filtrar um tenant específico porque representam
 * a visão agregada da plataforma inteira. A autorização SUPER_ADMIN é aplicada
 * no grupo dedicado em appRoutes.ts.
 */
export async function platformAdminRoutes(app: FastifyInstance) {
  app.get('/platform-admin/modules/catalog', async () => ({
    modules: SALON_MODULES.map((key) => ({ key, label: MODULE_LABELS[key] })),
    defaults: DEFAULT_ENABLED_MODULES
  }));

  app.get('/platform-admin/overview', async () => {
    const [salons, users, plans, subscriptions, activeSubscriptions] = await Promise.all([
      prisma.salon.count({ where: { slug: { not: 'glossflow-platform' } } }),
      prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
      prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } }),
      prisma.salonSubscription.findMany({
        where: { salon: { slug: { not: 'glossflow-platform' } } },
        include: { plan: true, salon: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.salonSubscription.findMany({
        where: { status: 'ACTIVE', salon: { slug: { not: 'glossflow-platform' } } },
        include: { plan: true }
      })
    ]);

    const mrr = activeSubscriptions.reduce((sum: number, subscription: any) => sum + Number(subscription.plan?.price || 0), 0);

    return {
      totals: {
        salons,
        users,
        plans: plans.length,
        subscriptions: subscriptions.length
      },
      revenue: {
        mrr,
        mrrFormatted: `R$ ${brl(mrr)}`
      },
      subscriptionStatus: {
        trial: subscriptions.filter((item: any) => item.status === 'TRIAL').length,
        active: subscriptions.filter((item: any) => item.status === 'ACTIVE').length,
        pastDue: subscriptions.filter((item: any) => item.status === 'PAST_DUE').length,
        canceled: subscriptions.filter((item: any) => item.status === 'CANCELED').length
      },
      recentSubscriptions: subscriptions.slice(0, 10).map((subscription: any) => ({
        id: subscription.id,
        status: subscription.status,
        salon: subscription.salon?.name,
        salonId: subscription.salonId,
        plan: subscription.plan?.name,
        price: subscription.plan?.price,
        endsAt: subscription.endsAt,
        createdAt: subscription.createdAt
      }))
    };
  });

  app.get('/platform-admin/salons', async () => {
    const salons = await prisma.salon.findMany({
      where: { slug: { not: 'glossflow-platform' } },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { plan: true } },
        users: { select: { id: true, role: true, active: true } },
        _count: { select: { appointments: true, clients: true, inventoryProducts: true, professionals: true } }
      }
    });

    return salons.map((salon: any) => ({
      id: salon.id,
      slug: salon.slug,
      name: salon.name,
      phone: salon.phone,
      whatsapp: salon.whatsapp,
      customDomain: salon.customDomain,
      users: salon.users.length,
      activeUsers: salon.users.filter((user: any) => user.active).length,
      modulesConfigured: Boolean(salon.modulesConfigured),
      enabledModules: normalizeEnabledModules(salon),
      metrics: {
        appointments: salon._count.appointments,
        clients: salon._count.clients,
        inventoryProducts: salon._count.inventoryProducts,
        professionals: salon._count.professionals
      },
      subscription: salon.subscription ? {
        status: salon.subscription.status,
        plan: salon.subscription.plan?.name,
        price: salon.subscription.plan?.price,
        endsAt: salon.subscription.endsAt
      } : null,
      createdAt: salon.createdAt
    }));
  });

  app.put('/platform-admin/salons/:id/modules', async (request, reply) => {
    const { id } = z.object({ id: salonIdSchema }).parse(request.params);
    const { enabledModules } = modulesSchema.parse(request.body);
    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon || salon.slug === 'glossflow-platform') {
      return reply.status(404).send({ message: 'Salão não encontrado.' });
    }

    const updated = await prisma.salon.update({
      where: { id },
      data: {
        modulesConfigured: true,
        enabledModules: [...new Set(enabledModules)]
      }
    });

    return {
      id: updated.id,
      name: updated.name,
      modulesConfigured: true,
      enabledModules: normalizeEnabledModules(updated)
    };
  });
}

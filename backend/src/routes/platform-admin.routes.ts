import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { getMetricsSnapshot } from './metrics';
import { DEFAULT_ENABLED_MODULES, MODULE_LABELS, normalizeEnabledModules, SALON_MODULES } from '../services/module-access.service';

function brl(value: number) {
  return Number(value || 0).toFixed(2);
}

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido.');
const modulesSchema = z.object({ enabledModules: z.array(z.enum(SALON_MODULES)).default([]) });
const subscriptionSchema = z.object({
  planId: objectIdSchema,
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).default('TRIAL'),
  endsAt: z.string().optional().or(z.literal(''))
});
const planSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().min(0),
  maxUsers: z.coerce.number().int().positive(),
  maxSalons: z.coerce.number().int().positive().default(1),
  features: z.string().min(3),
  active: z.coerce.boolean().optional().default(true)
});
const createSalonSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).max(63).regex(/^[a-z0-9][a-z0-9-]*$/, 'Use apenas letras minúsculas, números e hífen no slug.'),
  phone: z.string().min(8),
  whatsapp: z.string().min(8),
  address: z.string().min(5),
  openingHours: z.string().min(3),
  description: z.string().optional().default(''),
  instagram: z.string().optional().default(''),
  enabledModules: z.array(z.enum(SALON_MODULES)).default([]),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(12, 'A senha inicial do administrador precisa ter pelo menos 12 caracteres.')
});
const adminAccessSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(12).optional(),
  active: z.coerce.boolean().optional()
});

async function getSalonOr404(id: string) {
  const salon = await prisma.salon.findUnique({ where: { id } });
  if (!salon || salon.slug === 'glossflow-platform') return null;
  return salon;
}

/** Rotas exclusivas do SUPER_ADMIN da plataforma GlossFlow. */
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
      totals: { salons, users, plans: plans.length, subscriptions: subscriptions.length },
      revenue: { mrr, mrrFormatted: `R$ ${brl(mrr)}` },
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
        users: { select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } },
        _count: { select: { appointments: true, clients: true, inventoryProducts: true, professionals: true, services: true } }
      }
    });

    return salons.map((salon: any) => {
      const owner = salon.users.find((user: any) => user.role === 'ADMIN') || salon.users[0] || null;
      return {
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        phone: salon.phone,
        whatsapp: salon.whatsapp,
        address: salon.address,
        openingHours: salon.openingHours,
        customDomain: salon.customDomain,
        users: salon.users.length,
        activeUsers: salon.users.filter((user: any) => user.active).length,
        owner: owner ? { id: owner.id, name: owner.name, email: owner.email, active: owner.active } : null,
        modulesConfigured: Boolean(salon.modulesConfigured),
        enabledModules: normalizeEnabledModules(salon),
        metrics: {
          appointments: salon._count.appointments,
          clients: salon._count.clients,
          inventoryProducts: salon._count.inventoryProducts,
          professionals: salon._count.professionals,
          services: salon._count.services
        },
        subscription: salon.subscription ? {
          id: salon.subscription.id,
          status: salon.subscription.status,
          planId: salon.subscription.planId,
          plan: salon.subscription.plan?.name,
          price: salon.subscription.plan?.price,
          endsAt: salon.subscription.endsAt
        } : null,
        createdAt: salon.createdAt
      };
    });
  });

  app.post('/platform-admin/salons', async (request, reply) => {
    const data = createSalonSchema.parse(request.body);
    const email = data.adminEmail.trim().toLowerCase();
    const slug = data.slug.trim().toLowerCase();

    const [existingSalon, existingUser] = await Promise.all([
      prisma.salon.findUnique({ where: { slug } }),
      prisma.user.findUnique({ where: { email } })
    ]);
    if (existingSalon) return reply.status(409).send({ message: 'Já existe um salão com este slug.' });
    if (existingUser) return reply.status(409).send({ message: 'Este e-mail já está cadastrado na plataforma.' });

    const salon = await prisma.salon.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        phone: data.phone,
        whatsapp: data.whatsapp,
        address: data.address,
        openingHours: data.openingHours,
        instagram: data.instagram,
        heroImage: '',
        modulesConfigured: true,
        enabledModules: [...new Set(data.enabledModules)]
      }
    });

    try {
      const admin = await prisma.user.create({
        data: {
          name: data.adminName,
          email,
          password: await bcrypt.hash(data.adminPassword, 12),
          role: 'ADMIN',
          active: true,
          salonId: salon.id
        }
      });
      return reply.status(201).send({
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        enabledModules: normalizeEnabledModules(salon),
        owner: { id: admin.id, name: admin.name, email: admin.email, active: admin.active }
      });
    } catch (error) {
      await prisma.salon.delete({ where: { id: salon.id } }).catch(() => undefined);
      throw error;
    }
  });

  app.get('/platform-admin/salons/:id/metrics', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const salon = await getSalonOr404(id);
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [appointments, upcoming, completed, clients, products, professionals, services, users, financialEntries, lastAppointment] = await Promise.all([
      prisma.appointment.count({ where: { salonId: id } }),
      prisma.appointment.count({ where: { salonId: id, status: 'CONFIRMED', startTime: { gte: now } } }),
      prisma.appointment.count({ where: { salonId: id, status: 'COMPLETED' } }),
      prisma.client.count({ where: { salonId: id } }),
      prisma.inventoryProduct.findMany({ where: { salonId: id, active: true }, select: { quantity: true, minimumQuantity: true } }),
      prisma.professional.count({ where: { salonId: id, active: true } }),
      prisma.service.count({ where: { salonId: id, active: true } }),
      prisma.user.count({ where: { salonId: id, active: true } }),
      prisma.financialEntry.findMany({ where: { salonId: id, referenceDate: { gte: monthStart } } }),
      prisma.appointment.findFirst({ where: { salonId: id }, orderBy: { startTime: 'desc' }, select: { startTime: true, status: true, clientName: true } })
    ]);

    const revenue = financialEntries.filter((entry: any) => entry.type === 'REVENUE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const expenses = financialEntries.filter((entry: any) => entry.type === 'EXPENSE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const lowStock = products.filter((item: any) => Number(item.quantity) <= Number(item.minimumQuantity)).length;

    return {
      salon: { id: salon.id, name: salon.name, slug: salon.slug },
      operation: { appointments, upcoming, completed, clients, professionals, services, activeUsers: users, products: products.length, lowStock },
      finance: { monthRevenue: revenue, monthExpenses: expenses, monthProfit: revenue - expenses },
      lastAppointment
    };
  });

  app.put('/platform-admin/salons/:id/modules', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const { enabledModules } = modulesSchema.parse(request.body);
    const salon = await getSalonOr404(id);
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const updated = await prisma.salon.update({
      where: { id },
      data: { modulesConfigured: true, enabledModules: [...new Set(enabledModules)] }
    });
    return { id: updated.id, name: updated.name, modulesConfigured: true, enabledModules: normalizeEnabledModules(updated) };
  });

  app.put('/platform-admin/salons/:id/admin-access', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = adminAccessSchema.parse(request.body);
    const salon = await getSalonOr404(id);
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    const admin = await prisma.user.findFirst({ where: { salonId: id, role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) return reply.status(404).send({ message: 'Administrador principal deste salão não foi encontrado.' });

    const nextEmail = data.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== admin.email) {
      const collision = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (collision) return reply.status(409).send({ message: 'Este e-mail já está em uso.' });
    }

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(typeof data.active === 'boolean' ? { active: data.active } : {}),
        ...(data.password ? { password: await bcrypt.hash(data.password, 12) } : {})
      }
    });
    return { id: updated.id, name: updated.name, email: updated.email, active: updated.active };
  });

  app.get('/platform-admin/plans', async () => prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } }));

  app.post('/platform-admin/plans', async (request, reply) => {
    const data = planSchema.parse(request.body);
    return reply.status(201).send(await prisma.subscriptionPlan.create({ data }));
  });

  app.put('/platform-admin/plans/:id', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = planSchema.parse(request.body);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return reply.status(404).send({ message: 'Plano não encontrado.' });
    return prisma.subscriptionPlan.update({ where: { id }, data });
  });

  app.put('/platform-admin/salons/:id/subscription', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = subscriptionSchema.parse(request.body);
    const salon = await getSalonOr404(id);
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) return reply.status(404).send({ message: 'Plano não encontrado.' });

    return prisma.salonSubscription.upsert({
      where: { salonId: id },
      create: { planId: data.planId, status: data.status, endsAt: data.endsAt ? new Date(data.endsAt) : null, salonId: id },
      update: { planId: data.planId, status: data.status, endsAt: data.endsAt ? new Date(data.endsAt) : null },
      include: { plan: true }
    });
  });

  app.get('/platform-admin/integrations', async () => {
    const integrations = getIntegrationStatus();
    const connected = integrations.filter((item) => item.status === 'connected').length;
    return { connected, total: integrations.length, integrations };
  });

  app.get('/platform-admin/observability', async () => {
    const metrics = getMetricsSnapshot();
    const [auditLogs, sessions, consents, backups] = await Promise.all([
      prisma.auditLog.count(),
      prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.lgpdConsent.count({ where: { granted: true } }),
      prisma.backupJob.count()
    ]);
    const errorRate = metrics.totalRequests ? Math.round((metrics.errors / metrics.totalRequests) * 10000) / 100 : 0;
    return {
      service: {
        uptimeSeconds: metrics.uptimeSeconds,
        averageLatency: metrics.averageLatency,
        totalRequests: metrics.totalRequests,
        errors: metrics.errors,
        errorRate,
        memoryMb: Math.round(metrics.memory.rss / 1024 / 1024)
      },
      security: { auditLogs, activeSessions: sessions, lgpdConsents: consents, backups },
      recent: metrics.recent.slice(0, 20)
    };
  });
}

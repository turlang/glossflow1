import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { sendWhatsAppMessage } from '../services/whatsapp.service';

function requireRouteRoles(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenant = getTenant(request);
    if (!roles.includes(tenant.role)) {
      return reply.status(403).send({ message: 'Permissão insuficiente para esta operação.' });
    }
  };
}

const adminOnly = { preHandler: requireRouteRoles(['ADMIN']) };
const adminOrReception = { preHandler: requireRouteRoles(['ADMIN', 'RECEPTION']) };

const objectIdParam = z.object({ id: z.string().min(12) });

function brl(value: number) {
  return Number(value || 0).toFixed(2);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function renderTemplate(template: string, data: Record<string, string>) {
  return Object.entries(data).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/**
 * Rotas de evolução do GlossFlow.
 * -----------------------------------------------------------------------------
 * Este módulo concentra as bases das 7 fases comerciais:
 * 1. Super Admin SaaS
 * 2. WhatsApp real/automatizável
 * 3. CRM inteligente
 * 4. Agenda profissional
 * 5. Pagamentos e assinaturas
 * 6. Business Intelligence
 * 7. Plataforma comercial
 */
export async function growthRoutes(app: FastifyInstance) {
  /** Fase 1 — Super Admin SaaS */
  app.get('/admin/saas/overview', adminOnly, async () => {
    const [salons, users, plans, subscriptions, activeSubscriptions] = await Promise.all([
      prisma.salon.count(),
      prisma.user.count(),
      prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } }),
      prisma.salonSubscription.findMany({ include: { plan: true, salon: true }, orderBy: { createdAt: 'desc' } }),
      prisma.salonSubscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } })
    ]);

    const mrr = activeSubscriptions.reduce((sum: number, subscription: any) => sum + Number(subscription.plan?.price || 0), 0);
    const trialCount = subscriptions.filter((subscription: any) => subscription.status === 'TRIAL').length;
    const activeCount = subscriptions.filter((subscription: any) => subscription.status === 'ACTIVE').length;
    const pastDueCount = subscriptions.filter((subscription: any) => subscription.status === 'PAST_DUE').length;

    return {
      totals: { salons, users, plans: plans.length, subscriptions: subscriptions.length },
      revenue: { mrr, mrrFormatted: `R$ ${brl(mrr)}` },
      subscriptionStatus: { trial: trialCount, active: activeCount, pastDue: pastDueCount },
      recentSubscriptions: subscriptions.slice(0, 8).map((subscription: any) => ({
        id: subscription.id,
        status: subscription.status,
        salon: subscription.salon?.name,
        plan: subscription.plan?.name,
        price: subscription.plan?.price,
        createdAt: subscription.createdAt
      })),
      nextActions: [
        'Conectar cobrança recorrente real.',
        'Criar tela Super Admin para gerir salões, planos e assinaturas.',
        'Adicionar alertas para assinaturas vencidas.'
      ]
    };
  });

  app.get('/admin/saas/salons', adminOnly, async () => {
    const salons = await prisma.salon.findMany({ orderBy: { createdAt: 'desc' }, include: { subscription: { include: { plan: true } }, users: true } });
    return salons.map((salon: any) => ({
      id: salon.id,
      slug: salon.slug,
      name: salon.name,
      phone: salon.phone,
      whatsapp: salon.whatsapp,
      users: salon.users.length,
      subscription: salon.subscription ? {
        status: salon.subscription.status,
        plan: salon.subscription.plan?.name,
        price: salon.subscription.plan?.price,
        endsAt: salon.subscription.endsAt
      } : null,
      createdAt: salon.createdAt
    }));
  });

  app.get('/admin/saas/plans', adminOnly, async () => {
    return prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
  });

  /** Fase 2 — WhatsApp real/automatizável */
  app.post('/admin/whatsapp/automation-preview', adminOrReception, async (request) => {
    const tenant = getTenant(request);
    const body = z.object({
      event: z.enum(['APPOINTMENT_CREATED', 'REMINDER', 'BIRTHDAY', 'REACTIVATION', 'POST_SERVICE']),
      clientId: z.string().optional(),
      appointmentId: z.string().optional()
    }).parse(request.body);

    const [template, client, appointment] = await Promise.all([
      prisma.whatsAppTemplate.findFirst({ where: { salonId: tenant.salonId, event: body.event, active: true } }),
      body.clientId ? prisma.client.findFirst({ where: { id: body.clientId, salonId: tenant.salonId } }) : null,
      body.appointmentId ? prisma.appointment.findFirst({ where: { id: body.appointmentId, salonId: tenant.salonId }, include: { service: true, professional: true } }) : null
    ]);

    const fallback = {
      APPOINTMENT_CREATED: 'Olá {nome}! Seu agendamento foi recebido no GlossFlow. Em breve confirmamos os detalhes.',
      REMINDER: 'Olá {nome}! Lembrete do seu horário: {servico} com {profissional}. Esperamos você!',
      BIRTHDAY: 'Feliz aniversário, {nome}! Temos uma condição especial para cuidar de você nesta semana.',
      REACTIVATION: 'Olá {nome}! Sentimos sua falta. Que tal reservar um novo horário?',
      POST_SERVICE: 'Olá {nome}! Obrigado pela visita. Conte para nós como foi sua experiência.'
    }[body.event];

    const message = renderTemplate(template?.message || fallback, {
      nome: client?.name || appointment?.clientName || 'cliente',
      servico: appointment?.service?.name || 'seu serviço',
      profissional: appointment?.professional?.name || 'nossa equipe'
    });

    return { event: body.event, templateId: template?.id || null, clientPhone: client?.phone || appointment?.clientPhone || null, message };
  });

  app.post('/admin/whatsapp/send-to-client', adminOrReception, async (request, reply) => {
    const body = z.object({
      phone: z.string().min(10),
      message: z.string().min(3).max(1200),
      dryRun: z.boolean().optional().default(true)
    }).parse(request.body);

    const result = await sendWhatsAppMessage(body);
    return reply.status(result.ok ? 200 : 400).send(result);
  });

  /** Fase 3 — CRM Inteligente */
  app.get('/admin/crm/segments', adminOrReception, async (request) => {
    const tenant = getTenant(request);
    const clients = await prisma.client.findMany({
      where: { salonId: tenant.salonId },
      include: { appointments: { orderBy: { startTime: 'desc' }, include: { service: true } }, loyaltyEntries: true },
      orderBy: { name: 'asc' }
    });

    const now = new Date();
    const segments = clients.map((client: any) => {
      const lastAppointment = client.appointments[0];
      const totalSpent = client.appointments.reduce((sum: number, appointment: any) => sum + Number(appointment.service?.price || 0), 0);
      const daysSinceLastVisit = lastAppointment ? Math.floor((now.getTime() - new Date(lastAppointment.startTime).getTime()) / 86_400_000) : null;
      const loyaltyPoints = client.loyaltyEntries.reduce((sum: number, entry: any) => sum + Number(entry.points || 0), 0);
      const birthDate = client.birthDate ? new Date(client.birthDate) : null;
      const birthdayThisMonth = birthDate ? birthDate.getMonth() === now.getMonth() : false;

      const tags = [
        totalSpent >= 500 ? 'VIP' : null,
        daysSinceLastVisit === null ? 'SEM_HISTORICO' : null,
        daysSinceLastVisit !== null && daysSinceLastVisit >= 60 ? 'INATIVO_60_DIAS' : null,
        birthdayThisMonth ? 'ANIVERSARIANTE' : null,
        loyaltyPoints >= 100 ? 'FIDELIDADE_FORTE' : null
      ].filter(Boolean);

      return { id: client.id, name: client.name, phone: client.phone, email: client.email, totalSpent, loyaltyPoints, daysSinceLastVisit, tags };
    });

    return {
      totalClients: clients.length,
      vip: segments.filter((client: any) => client.tags.includes('VIP')),
      inactive60Days: segments.filter((client: any) => client.tags.includes('INATIVO_60_DIAS')),
      birthdays: segments.filter((client: any) => client.tags.includes('ANIVERSARIANTE')),
      all: segments
    };
  });

  app.get('/admin/crm/campaign-suggestions', adminOrReception, async (request) => {
    const tenant = getTenant(request);
    const clients = await prisma.client.findMany({ where: { salonId: tenant.salonId }, include: { appointments: { orderBy: { startTime: 'desc' }, include: { service: true } } } });
    const inactive = clients.filter((client: any) => !client.appointments[0] || new Date(client.appointments[0].startTime) < daysAgo(60));
    const topClients = clients.filter((client: any) => client.appointments.reduce((sum: number, appt: any) => sum + Number(appt.service?.price || 0), 0) >= 500);

    return [
      { title: 'Reativação de clientes', segment: 'INATIVO_60_DIAS', clients: inactive.length, channel: 'WhatsApp', message: 'Olá {nome}! Sentimos sua falta. Temos horários especiais esta semana.' },
      { title: 'Campanha VIP', segment: 'VIP', clients: topClients.length, channel: 'WhatsApp', message: 'Olá {nome}! Você está entre nossos clientes especiais. Temos uma condição exclusiva para você.' }
    ];
  });

  /** Fase 4 — Agenda Profissional */
  app.get('/admin/schedule/professional-agenda', adminOrReception, async (request) => {
    const tenant = getTenant(request);
    const query = z.object({ start: z.string().optional(), end: z.string().optional() }).parse(request.query);
    const start = query.start ? new Date(query.start) : daysAgo(7);
    const end = query.end ? new Date(query.end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const professionals = await prisma.professional.findMany({ where: { salonId: tenant.salonId, active: true }, orderBy: { name: 'asc' } });
    const appointments = await prisma.appointment.findMany({ where: { salonId: tenant.salonId, startTime: { gte: start, lte: end } }, include: { service: true, professional: true }, orderBy: { startTime: 'asc' } });

    return professionals.map((professional: any) => {
      const items = appointments.filter((appointment: any) => appointment.professionalId === professional.id);
      return { professionalId: professional.id, professional: professional.name, specialty: professional.specialty, appointments: items, totalAppointments: items.length };
    });
  });

  app.put('/admin/schedule/appointments/:id/status', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = objectIdParam.parse(request.params);
    const body = z.object({ status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW']) }).parse(request.body);
    const result = await prisma.appointment.updateMany({ where: { id, salonId: tenant.salonId }, data: { status: body.status } });
    if (result.count === 0) return reply.status(404).send({ message: 'Agendamento não encontrado neste salão.' });
    return prisma.appointment.findFirst({ where: { id, salonId: tenant.salonId }, include: { service: true, professional: true } });
  });

  /** Fase 5 — Pagamentos e Assinaturas */
  app.get('/admin/billing/summary', adminOnly, async (request) => {
    const tenant = getTenant(request);
    const subscription = await prisma.salonSubscription.findUnique({ where: { salonId: tenant.salonId }, include: { plan: true, salon: true } });
    const plans = await prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } });

    return {
      current: subscription ? {
        status: subscription.status,
        plan: subscription.plan?.name,
        price: subscription.plan?.price,
        endsAt: subscription.endsAt,
        isBlocked: ['PAST_DUE', 'CANCELED'].includes(subscription.status)
      } : null,
      availablePlans: plans,
      nextActions: [
        'Conectar Mercado Pago ou Stripe para checkout real.',
        'Criar webhook de confirmação de pagamento.',
        'Bloquear recursos premium quando status for PAST_DUE ou CANCELED.'
      ]
    };
  });

  /** Fase 6 — Business Intelligence */
  app.get('/admin/bi/executive-summary', adminOnly, async (request) => {
    const tenant = getTenant(request);
    const [appointments, financialEntries, clients, inventory] = await Promise.all([
      prisma.appointment.findMany({ where: { salonId: tenant.salonId }, include: { service: true, professional: true } }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId } }),
      prisma.client.findMany({ where: { salonId: tenant.salonId } }),
      prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId } })
    ]);

    const revenue = financialEntries.filter((entry: any) => entry.type === 'REVENUE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const expenses = financialEntries.filter((entry: any) => entry.type === 'EXPENSE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const appointmentValue = appointments.reduce((sum: number, appointment: any) => sum + Number(appointment.service?.price || 0), 0);
    const ticketAverage = appointments.length ? appointmentValue / appointments.length : 0;
    const lowStock = inventory.filter((product: any) => product.quantity <= product.minimumQuantity);

    const professionals = appointments.reduce((acc: Record<string, number>, appointment: any) => {
      const name = appointment.professional?.name || 'Sem profissional';
      acc[name] = (acc[name] || 0) + Number(appointment.service?.price || 0);
      return acc;
    }, {});

    return {
      revenue,
      expenses,
      profit: revenue - expenses,
      appointments: appointments.length,
      clients: clients.length,
      ticketAverage,
      lowStock: lowStock.length,
      professionalRanking: Object.entries(professionals).map(([name, total]) => ({ name, total })).sort((a: any, b: any) => b.total - a.total),
      recommendations: [
        lowStock.length ? 'Priorize reposição dos produtos abaixo do estoque mínimo.' : 'Estoque sem alerta crítico.',
        ticketAverage < 80 ? 'Crie combos para elevar o ticket médio.' : 'Ticket médio saudável para campanhas premium.',
        clients.length < 50 ? 'Aumente cadastro de clientes para fortalecer CRM.' : 'Base de clientes pronta para segmentação avançada.'
      ]
    };
  });

  /** Fase 7 — Plataforma Comercial */
  app.get('/admin/commercial/landing-kit', adminOnly, async () => {
    const plans = await prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } });

    return {
      hero: {
        title: 'GlossFlow — gestão premium para salões, barbearias e clínicas de estética',
        subtitle: 'Agenda, CRM, financeiro, estoque, WhatsApp, fidelidade e indicadores em uma única plataforma SaaS.',
        cta: 'Começar demonstração'
      },
      sections: [
        'Gestão completa do salão',
        'CRM inteligente e campanhas',
        'Agenda profissional',
        'Dashboard executivo',
        'Automações por WhatsApp',
        'Multiempresa e planos SaaS'
      ],
      plans,
      onboardingChecklist: [
        'Cadastrar salão',
        'Configurar serviços',
        'Cadastrar profissionais',
        'Importar clientes',
        'Ativar templates de WhatsApp',
        'Configurar plano e cobrança',
        'Publicar vitrine pública'
      ]
    };
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createStripeCheckout } from '../services/payments.service';
import { sendWhatsAppMessage } from '../services/whatsapp.service';

const leadSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(30).optional().default(''),
  businessName: z.string().min(2).max(160).optional().default(''),
  source: z.string().max(80).optional().default('landing'),
  plan: z.enum(['STARTER', 'PRO', 'PREMIUM']).optional().default('PRO'),
  message: z.string().max(800).optional().default('')
});

const affiliateSchema = z.object({
  affiliateCode: z.string().min(3).max(80),
  leadEmail: z.string().email(),
  leadName: z.string().min(2).max(120),
  plan: z.enum(['STARTER', 'PRO', 'PREMIUM']).optional().default('PRO')
});

const plans = [
  { code: 'STARTER', name: 'Essencial', price: 79, trialDays: 7, maxUsers: 2, features: ['Agenda online', 'Cadastro de clientes', 'Serviços e profissionais'] },
  { code: 'PRO', name: 'Profissional', price: 149, trialDays: 7, maxUsers: 8, features: ['Dashboard financeiro', 'WhatsApp', 'Estoque', 'Fidelidade'] },
  { code: 'PREMIUM', name: 'Premium SaaS', price: 249, trialDays: 7, maxUsers: 20, features: ['IA', 'Auditoria', 'Relatórios avançados', 'Suporte prioritário'] }
];

async function persistCommercialEvent(kind: string, payload: Record<string, unknown>) {
  // Usa AuditLog como fallback operacional para manter a fase comercial funcional mesmo antes da coleção dedicada ser migrada.
  // Em produção, execute `npm run prisma:push` para ativar também os models CommercialLead/AffiliateReferral.
  return prisma.auditLog.create({
    data: {
      action: kind,
      resource: 'CommercialFunnel',
      method: 'POST',
      path: `/commercial/${kind.toLowerCase()}`,
      metadata: payload,
      salonId: String(process.env.DEFAULT_SALON_ID || '000000000000000000000000')
    }
  }).catch(() => null);
}

export async function commercialRoutes(app: FastifyInstance) {
  app.get('/commercial/plans', async () => ({ plans, trial: { days: 7, requiresCard: false }, checkoutReady: Boolean(process.env.STRIPE_SECRET_KEY || process.env.MERCADO_PAGO_ACCESS_TOKEN) }));

  app.post('/commercial/leads', async (request, reply) => {
    const lead = leadSchema.parse(request.body);
    await persistCommercialEvent('LEAD_CAPTURED', lead);
    return reply.status(201).send({ ok: true, lead, nextStep: 'Contato comercial ou criação do checkout de assinatura.' });
  });

  app.post('/commercial/trial', async (request, reply) => {
    const lead = leadSchema.parse(request.body);
    await persistCommercialEvent('TRIAL_REQUESTED', lead);

    if (process.env.COMMERCIAL_NOTIFY_WHATSAPP_TO) {
      await sendWhatsAppMessage({
        to: process.env.COMMERCIAL_NOTIFY_WHATSAPP_TO,
        message: `Novo trial GlossFlow: ${lead.name} - ${lead.businessName || 'sem empresa'} - ${lead.email}`,
        dryRun: process.env.WHATSAPP_DRY_RUN !== 'false'
      });
    }

    return reply.status(201).send({ ok: true, trialDays: 7, lead, message: 'Trial solicitado. Configure onboarding automático com credenciais reais.' });
  });

  app.post('/commercial/checkout', async (request, reply) => {
    const payload = leadSchema.extend({ successUrl: z.string().url().optional(), failureUrl: z.string().url().optional() }).parse(request.body);
    const selectedPlan = plans.find((plan) => plan.code === payload.plan) || plans[1];
    const checkout = await createStripeCheckout({
      amount: selectedPlan.price,
      description: `Assinatura GlossFlow ${selectedPlan.name}`,
      payerEmail: payload.email,
      successUrl: payload.successUrl,
      failureUrl: payload.failureUrl,
      dryRun: process.env.PAYMENTS_DRY_RUN !== 'false'
    });
    await persistCommercialEvent('CHECKOUT_CREATED', { payload, checkout });
    return reply.status(checkout.ok ? 201 : 400).send({ plan: selectedPlan, checkout });
  });

  app.post('/commercial/affiliate/referral', async (request, reply) => {
    const referral = affiliateSchema.parse(request.body);
    await persistCommercialEvent('AFFILIATE_REFERRAL', referral);
    return reply.status(201).send({ ok: true, referral, commissionRule: 'Comissão pendente de configuração em AFFILIATE_COMMISSION_PERCENT.' });
  });
}

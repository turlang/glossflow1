import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { sendWhatsAppMessage } from '../services/whatsapp.service';
import { createMercadoPagoPix, createStripeCheckout } from '../services/payments.service';

const testWhatsAppSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1).max(1200).default('Teste GlossFlow: integração WhatsApp pronta.'),
  dryRun: z.boolean().optional().default(true)
});

const paymentSchema = z.object({
  provider: z.enum(['mercadopago', 'stripe']).default('mercadopago'),
  amount: z.number().positive(),
  description: z.string().min(3).max(180),
  payerEmail: z.string().email().optional(),
  successUrl: z.string().url().optional(),
  failureUrl: z.string().url().optional(),
  dryRun: z.boolean().optional().default(true)
});

/**
 * Central de integrações da Fase 2.
 * -----------------------------------------------------------------------------
 * Todas as rotas abaixo estão prontas para receber credenciais reais por ENV.
 * Sem credenciais, trabalham em modo dry-run/diagnóstico para permitir QA seguro.
 */
export async function integrationsRoutes(app: FastifyInstance) {
  app.get('/admin/ecosystem/integrations', async () => {
    const integrations = getIntegrationStatus();
    const connected = integrations.filter((integration) => integration.status === 'connected').length;
    const ready = integrations.filter((integration) => integration.status !== 'missing').length;

    return {
      connected,
      ready,
      total: integrations.length,
      score: Math.round((connected / integrations.length) * 100),
      nextAction: connected === integrations.length
        ? 'Todas as integrações essenciais estão configuradas.'
        : 'Preencha as variáveis ausentes no ambiente de produção e rode npm run deploy:verify.',
      integrations
    };
  });

  app.post('/admin/ecosystem/integrations/:key/test', async (request) => {
    const { key } = z.object({ key: z.string() }).parse(request.params);
    const integrations = getIntegrationStatus();
    const integration = integrations.find((item) => item.key === key);

    return {
      key,
      ok: Boolean(integration),
      testedAt: new Date().toISOString(),
      integration: integration || null,
      message: integration
        ? integration.missingEnv.length
          ? `Conector reconhecido. Variáveis pendentes: ${integration.missingEnv.join(', ')}.`
          : 'Conector reconhecido e variáveis mínimas presentes.'
        : 'Conector ainda não cadastrado no GlossFlow.'
    };
  });

  app.post('/admin/whatsapp/send-test', async (request, reply) => {
    const payload = testWhatsAppSchema.parse(request.body);
    const result = await sendWhatsAppMessage(payload);
    return reply.status(result.ok ? 200 : 400).send(result);
  });

  app.post('/admin/payments/checkout', async (request, reply) => {
    const payload = paymentSchema.parse(request.body);
    const result = payload.provider === 'stripe'
      ? await createStripeCheckout(payload)
      : await createMercadoPagoPix(payload);

    return reply.status(result.ok ? 200 : 400).send(result);
  });
}

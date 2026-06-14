import { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * Ecossistema de integrações.
 * -----------------------------------------------------------------------------
 * O objetivo é deixar claro o nível de prontidão de cada integração real do SaaS.
 * As chaves ficam em variáveis de ambiente e nunca devem ser versionadas.
 */
export async function integrationsRoutes(app: FastifyInstance) {
  app.get('/admin/ecosystem/integrations', async () => {
    const integrations = [
      {
        key: 'openai',
        name: 'OpenAI',
        category: 'IA',
        status: process.env.OPENAI_API_KEY ? 'connected' : 'ready',
        env: 'OPENAI_API_KEY',
        description: 'Gera análises, campanhas, previsões e respostas executivas com contexto real do salão.'
      },
      {
        key: 'whatsapp',
        name: 'WhatsApp Business',
        category: 'Comunicação',
        status: process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN ? 'connected' : 'ready',
        env: 'WHATSAPP_API_URL + WHATSAPP_API_TOKEN',
        description: 'Permite envio real de confirmações, lembretes, aniversários e campanhas.'
      },
      {
        key: 'mercadopago',
        name: 'Mercado Pago',
        category: 'Pagamentos',
        status: process.env.MERCADO_PAGO_ACCESS_TOKEN ? 'connected' : 'ready',
        env: 'MERCADO_PAGO_ACCESS_TOKEN',
        description: 'Base preparada para cobrança de reservas, planos e pagamentos avulsos.'
      },
      {
        key: 'stripe',
        name: 'Stripe',
        category: 'Assinaturas',
        status: process.env.STRIPE_SECRET_KEY ? 'connected' : 'ready',
        env: 'STRIPE_SECRET_KEY',
        description: 'Base preparada para assinatura SaaS recorrente e trial controlado.'
      },
      {
        key: 'google-calendar',
        name: 'Google Calendar',
        category: 'Agenda',
        status: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'connected' : 'ready',
        env: 'GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET',
        description: 'Sincronização futura de agenda dos profissionais e eventos externos.'
      },
      {
        key: 'cloudinary',
        name: 'Cloudinary',
        category: 'Imagens',
        status: process.env.CLOUDINARY_URL ? 'connected' : 'ready',
        env: 'CLOUDINARY_URL',
        description: 'Armazenamento profissional de fotos da vitrine, serviços, produtos e profissionais.'
      },
      {
        key: 'sentry',
        name: 'Sentry',
        category: 'Observabilidade',
        status: process.env.SENTRY_DSN ? 'connected' : 'ready',
        env: 'SENTRY_DSN',
        description: 'Monitoramento externo de erros, performance e estabilidade do frontend/backend.'
      },
      {
        key: 'meta-ads',
        name: 'Meta Ads',
        category: 'Marketing',
        status: process.env.META_ACCESS_TOKEN ? 'connected' : 'ready',
        env: 'META_ACCESS_TOKEN',
        description: 'Preparado para campanhas de remarketing, públicos personalizados e promoções.'
      }
    ];

    const connected = integrations.filter((integration) => integration.status === 'connected').length;
    return {
      connected,
      total: integrations.length,
      score: Math.round((connected / integrations.length) * 100),
      integrations
    };
  });

  app.post('/admin/ecosystem/integrations/:key/test', async (request) => {
    const { key } = z.object({ key: z.string() }).parse(request.params);
    const known = ['openai', 'whatsapp', 'mercadopago', 'stripe', 'google-calendar', 'cloudinary', 'sentry', 'meta-ads'];
    return {
      key,
      ok: known.includes(key),
      testedAt: new Date().toISOString(),
      message: known.includes(key)
        ? 'Conector reconhecido. Configure as variáveis de ambiente para ativação real.'
        : 'Conector ainda não cadastrado no GlossFlow.'
    };
  });
}

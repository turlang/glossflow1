/**
 * Catálogo central de integrações externas.
 *
 * A tela administrativa usa este serviço para mostrar quais conectores estão
 * prontos, parcialmente configurados ou pendentes. Ao adicionar uma nova
 * integração, cadastre aqui as variáveis obrigatórias para que /ready e o
 * painel de integrações continuem confiáveis.
 */
export type IntegrationKey = 'openai' | 'whatsapp' | 'mercadopago' | 'stripe' | 'sentry' | 'deploy';

export type IntegrationStatus = {
  key: IntegrationKey;
  name: string;
  category: string;
  status: 'connected' | 'ready' | 'missing';
  env: string[];
  missingEnv: string[];
  description: string;
};

function missing(keys: string[]) {
  return keys.filter((key) => !process.env[key]);
}

function statusFor(keys: string[]): IntegrationStatus['status'] {
  const missingKeys = missing(keys);
  if (missingKeys.length === 0) return 'connected';
  return missingKeys.length < keys.length ? 'ready' : 'missing';
}

export function getIntegrationStatus(): IntegrationStatus[] {
  const items: Array<Omit<IntegrationStatus, 'missingEnv' | 'status'>> = [
    {
      key: 'openai',
      name: 'OpenAI',
      category: 'IA',
      env: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
      description: 'Assistente executivo, previsão de faturamento e campanhas baseadas nos dados reais do salão.'
    },
    {
      key: 'whatsapp',
      name: 'WhatsApp Cloud API',
      category: 'Comunicação',
      env: ['WHATSAPP_PROVIDER', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
      description: 'Confirmações, lembretes, aniversários e campanhas por WhatsApp.'
    },
    {
      key: 'mercadopago',
      name: 'Mercado Pago',
      category: 'Pagamentos',
      env: ['MERCADO_PAGO_ACCESS_TOKEN'],
      description: 'PIX, checkout e cobranças avulsas para reservas ou serviços.'
    },
    {
      key: 'stripe',
      name: 'Stripe',
      category: 'Assinaturas',
      env: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'],
      description: 'Assinatura recorrente do SaaS, trial e checkout de planos.'
    },
    {
      key: 'sentry',
      name: 'Sentry',
      category: 'Observabilidade',
      env: ['SENTRY_DSN'],
      description: 'Monitoramento de erros e trilha de falhas em produção.'
    },
    {
      key: 'deploy',
      name: 'Deploy validável',
      category: 'Infraestrutura',
      env: ['FRONTEND_ORIGIN', 'DATABASE_URL', 'JWT_SECRET'],
      description: 'Variáveis mínimas para subir API e frontend em produção.'
    }
  ];

  return items.map((item) => ({
    ...item,
    status: statusFor(item.env),
    missingEnv: missing(item.env)
  }));
}

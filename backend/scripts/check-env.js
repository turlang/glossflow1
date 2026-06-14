require('dotenv').config();
/**
 * Validador de ambiente.
 * - Por padrão valida apenas o mínimo para o backend iniciar.
 * - Com STRICT_INTEGRATIONS=true, valida também Fase 2: WhatsApp, pagamento, Sentry e IA.
 */
const required = ['DATABASE_URL', 'JWT_SECRET'];
const strict = process.env.STRICT_INTEGRATIONS === 'true';
const phase2 = [
  'OPENAI_API_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'MERCADO_PAGO_ACCESS_TOKEN',
  'SENTRY_DSN'
];
const phase3 = [
  'APP_PUBLIC_URL',
  'PUBLIC_API_URL'
];

const missing = [...required, ...(strict ? [...phase2, ...phase3] : [])].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

if ((process.env.JWT_SECRET || '').length < 32) {
  console.error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  process.exit(1);
}

console.log(strict ? 'Ambiente completo das Fases 2 e 3 validado com sucesso.' : 'Ambiente mínimo validado com sucesso.');

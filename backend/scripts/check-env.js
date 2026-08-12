require('dotenv').config();
/**
 * Validador de ambiente.
 * - Por padrão valida o mínimo seguro para o backend iniciar.
 * - Em produção exige também origem do frontend.
 * - Com STRICT_INTEGRATIONS=true, valida integrações externas.
 */
const production = process.env.NODE_ENV === 'production';
const required = ['DATABASE_URL', 'JWT_SECRET', ...(production ? ['FRONTEND_ORIGIN'] : [])];
const strict = process.env.STRICT_INTEGRATIONS === 'true';

function whatsappRequiredEnv() {
  const provider = String(process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
  if (provider === 'twilio') {
    const keys = ['WHATSAPP_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'];
    if (process.env.TWILIO_TRIAL_MODE === 'true') keys.push('TWILIO_TRIAL_CONTENT_SID');
    return keys;
  }
  return ['WHATSAPP_PROVIDER', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'];
}

const phase2 = [
  'OPENAI_API_KEY',
  ...whatsappRequiredEnv(),
  'MERCADO_PAGO_ACCESS_TOKEN',
  'SENTRY_DSN'
];
const phase3 = [
  'APP_PUBLIC_URL',
  'PUBLIC_API_URL'
];

const missing = [...required, ...(strict ? [...phase2, ...phase3] : [])].filter((key) => !String(process.env[key] || '').trim());
if (missing.length > 0) {
  console.error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const jwtSecret = String(process.env.JWT_SECRET || '');
if (jwtSecret.length < 32) {
  console.error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  process.exit(1);
}

const normalizedSecret = jwtSecret.toLowerCase();
if (['changeme', 'change-me', 'secret', 'password'].includes(normalizedSecret)
  || normalizedSecret.includes('troque-por-uma-chave')) {
  console.error('JWT_SECRET ainda usa valor de exemplo/placeholder.');
  process.exit(1);
}

const backupSecret = String(process.env.BACKUP_SIGNING_SECRET || '').trim();
if (backupSecret && backupSecret.length < 32) {
  console.error('BACKUP_SIGNING_SECRET, quando configurado, deve ter pelo menos 32 caracteres.');
  process.exit(1);
}

if (production && !/^mongodb(\+srv)?:\/\//.test(String(process.env.DATABASE_URL || ''))) {
  console.error('DATABASE_URL de produção precisa usar URI MongoDB válida.');
  process.exit(1);
}

if (production && process.env.BACKUP_RESTORE_ENABLED === 'true' && !backupSecret) {
  console.error('BACKUP_RESTORE_ENABLED=true em produção exige BACKUP_SIGNING_SECRET explícito.');
  process.exit(1);
}

console.log(strict ? 'Ambiente completo das integrações validado com sucesso.' : 'Ambiente mínimo validado com sucesso.');

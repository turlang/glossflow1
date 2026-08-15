import * as dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma';
import {
  provisionTenant,
  updateTenantLifecycle,
  updateTenantOwner
} from '../src/services/saas-lifecycle.service';
import { SALON_MODULES } from '../src/services/module-access.service';

dotenv.config({ path: process.env.QA_ENV_FILE || '.env.qa' });

const QA_CONFIRMATION_PHRASE = 'CREATE_ISOLATED_QA_TENANT';

function required(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}.`);
  return value;
}

function databaseNameFromUrl(value: string) {
  const withoutQuery = value.split('?')[0].replace(/\/$/, '');
  const slash = withoutQuery.lastIndexOf('/');
  return slash >= 0 ? decodeURIComponent(withoutQuery.slice(slash + 1)) : '';
}

function assertQaEnvironment() {
  if (process.env.QA_TENANT_BOOTSTRAP_ENABLED !== 'true') {
    throw new Error('QA_TENANT_BOOTSTRAP_ENABLED precisa ser true para habilitar o bootstrap.');
  }
  if (String(process.env.QA_ENVIRONMENT || '').toLowerCase() !== 'qa') {
    throw new Error('QA_ENVIRONMENT precisa ser exatamente qa.');
  }
  if (process.env.QA_CONFIRMATION !== QA_CONFIRMATION_PHRASE) {
    throw new Error(`QA_CONFIRMATION precisa ser exatamente ${QA_CONFIRMATION_PHRASE}.`);
  }
  if (process.env.NODE_ENV === 'production' && process.env.QA_ALLOW_NODE_ENV_PRODUCTION !== 'true') {
    throw new Error('NODE_ENV=production foi detectado. Em runtime isolado de QA, defina QA_ALLOW_NODE_ENV_PRODUCTION=true explicitamente.');
  }

  const databaseUrl = required('DATABASE_URL');
  const expectedDatabase = required('QA_DATABASE_NAME');
  const actualDatabase = databaseNameFromUrl(databaseUrl);
  if (!/(qa|test|staging)/i.test(expectedDatabase)) {
    throw new Error('QA_DATABASE_NAME precisa identificar explicitamente um banco qa, test ou staging.');
  }
  if (actualDatabase !== expectedDatabase) {
    throw new Error(`DATABASE_URL aponta para "${actualDatabase || 'desconhecido'}", mas QA_DATABASE_NAME é "${expectedDatabase}".`);
  }
}

async function ensureQaPlan() {
  const name = String(process.env.QA_PLAN_NAME || 'QA Internal').trim();
  const existing = await prisma.subscriptionPlan.findFirst({ where: { name, active: true } });
  if (existing) return existing;

  return prisma.subscriptionPlan.create({
    data: {
      name,
      price: 0,
      maxUsers: 25,
      maxSalons: 5,
      features: 'Plano interno para homologação isolada dos 19 módulos do GlossFlow.',
      active: true
    }
  });
}

async function main() {
  assertQaEnvironment();

  const slug = String(process.env.QA_TENANT_SLUG || 'glossflow-qa').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || !slug.includes('qa')) {
    throw new Error('QA_TENANT_SLUG deve ser um slug válido e conter "qa".');
  }

  const adminEmail = required('QA_ADMIN_EMAIL').toLowerCase();
  const adminPassword = required('QA_ADMIN_PASSWORD');
  if (adminPassword.length < 12) throw new Error('QA_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.');

  const plan = await ensureQaPlan();
  const existingSalon = await prisma.salon.findUnique({ where: { slug } });

  if (existingSalon) {
    const owner = await prisma.user.findFirst({ where: { salonId: existingSalon.id, role: 'ADMIN' } });
    if (!owner) throw new Error('Tenant QA existente não possui ADMIN; corrija manualmente antes de continuar.');

    await updateTenantLifecycle({
      salonId: existingSalon.id,
      planId: plan.id,
      status: 'ACTIVE',
      enabledModules: [...SALON_MODULES],
      billing: {
        provider: 'MANUAL',
        customerId: '',
        subscriptionRef: '',
        nextBillingAt: '',
        notes: 'Tenant QA isolado — sem cobrança real.'
      }
    });
    await updateTenantOwner({
      salonId: existingSalon.id,
      name: String(process.env.QA_ADMIN_NAME || 'GlossFlow QA Admin').trim(),
      email: adminEmail,
      password: adminPassword,
      active: true
    });

    console.log(JSON.stringify({
      ok: true,
      reused: true,
      salonId: existingSalon.id,
      slug,
      adminEmail,
      modules: SALON_MODULES.length,
      database: required('QA_DATABASE_NAME')
    }, null, 2));
    return;
  }

  const result = await provisionTenant({
    salon: {
      name: String(process.env.QA_TENANT_NAME || 'GlossFlow QA').trim(),
      slug,
      phone: String(process.env.QA_PHONE || '5500000000000').trim(),
      whatsapp: String(process.env.QA_WHATSAPP || '5500000000000').trim(),
      address: String(process.env.QA_ADDRESS || 'Ambiente QA isolado — não usar como endereço comercial').trim(),
      openingHours: 'Ambiente QA — uso controlado',
      description: 'Tenant isolado para homologação do GlossFlow. Não contém dados de clientes reais.',
      instagram: ''
    },
    admin: {
      name: String(process.env.QA_ADMIN_NAME || 'GlossFlow QA Admin').trim(),
      email: adminEmail,
      password: adminPassword
    },
    enabledModules: [...SALON_MODULES],
    planId: plan.id,
    status: 'ACTIVE',
    billing: {
      provider: 'MANUAL',
      customerId: '',
      subscriptionRef: '',
      nextBillingAt: '',
      notes: 'Tenant QA isolado — sem cobrança real.'
    }
  });

  console.log(JSON.stringify({
    ok: true,
    reused: false,
    salonId: result.salon.id,
    slug: result.salon.slug,
    adminEmail: result.owner.email,
    modules: result.salon.enabledModules.length,
    database: required('QA_DATABASE_NAME')
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[qa-bootstrap] falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

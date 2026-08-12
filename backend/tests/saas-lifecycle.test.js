require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const {
  assertSubscriptionTransition,
  evaluateSubscriptionAccess,
  provisionTenant,
  updateTenantLifecycle,
  updateTenantOwner
} = require('../src/services/saas-lifecycle.service.ts');

const salonId = '507f1f77bcf86cd799439011';
const planId = '507f1f77bcf86cd799439012';
const adminId = '507f1f77bcf86cd799439013';

async function withMocks(replacements, run) {
  const originals = [];
  for (const [delegate, methods] of Object.entries(replacements)) {
    for (const [method, implementation] of Object.entries(methods)) {
      originals.push([delegate, method, prisma[delegate][method]]);
      prisma[delegate][method] = implementation;
    }
  }
  try {
    return await run();
  } finally {
    for (const [delegate, method, original] of originals.reverse()) prisma[delegate][method] = original;
  }
}

function salon(overrides = {}) {
  return {
    id: salonId,
    slug: 'studio-marco21',
    name: 'Studio Marco 21',
    customDomain: null,
    modulesConfigured: true,
    enabledModules: ['SITE', 'AGENDA'],
    ...overrides
  };
}

function plan(overrides = {}) {
  return { id: planId, name: 'Plano Smart', price: 199, active: true, ...overrides };
}

test('contrato ACTIVE libera operação e CANCELED bloqueia imediatamente', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  assert.equal(evaluateSubscriptionAccess({ status: 'ACTIVE', endsAt: null }, now).allowed, true);
  const canceled = evaluateSubscriptionAccess({ status: 'CANCELED', endsAt: null }, now);
  assert.equal(canceled.allowed, false);
  assert.equal(canceled.code, 'SUBSCRIPTION_CANCELED');
});

test('TRIAL e PAST_DUE respeitam fim de avaliação e período de graça', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  assert.equal(evaluateSubscriptionAccess({ status: 'TRIAL', endsAt: '2026-08-13T12:00:00.000Z' }, now).code, 'TRIAL_ACTIVE');
  assert.equal(evaluateSubscriptionAccess({ status: 'TRIAL', endsAt: '2026-08-11T12:00:00.000Z' }, now).code, 'TRIAL_EXPIRED');
  assert.equal(evaluateSubscriptionAccess({ status: 'PAST_DUE', endsAt: '2026-08-13T12:00:00.000Z' }, now).code, 'PAST_DUE_GRACE');
  assert.equal(evaluateSubscriptionAccess({ status: 'PAST_DUE', endsAt: '2026-08-11T12:00:00.000Z' }, now).code, 'PAST_DUE_BLOCKED');
});

test('tenant legado sem assinatura continua compatível até migração comercial', () => {
  const result = evaluateSubscriptionAccess(null, new Date('2026-08-12T12:00:00.000Z'));
  assert.equal(result.allowed, true);
  assert.equal(result.code, 'LEGACY_NO_SUBSCRIPTION');
});

test('matriz de transição impede reabrir cancelado como trial e permite reativar como active', () => {
  assert.throws(() => assertSubscriptionTransition('CANCELED', 'TRIAL'), /CANCELED → TRIAL/);
  assert.doesNotThrow(() => assertSubscriptionTransition('CANCELED', 'ACTIVE'));
  assert.doesNotThrow(() => assertSubscriptionTransition('ACTIVE', 'PAST_DUE'));
});

test('cancelamento do contrato revoga sessões e audita antes/depois', async () => {
  const audits = [];
  let revoked = null;
  const current = {
    id: 'sub-1', salonId, planId, status: 'ACTIVE', endsAt: null, plan: plan()
  };
  const canceled = {
    ...current,
    status: 'CANCELED',
    endsAt: new Date('2026-08-12T14:00:00.000Z')
  };

  await withMocks({
    salon: { findUnique: async () => salon() },
    salonSubscription: {
      findUnique: async () => current,
      upsert: async ({ update }) => {
        assert.equal(update.status, 'CANCELED');
        return canceled;
      }
    },
    userSession: {
      updateMany: async (query) => { revoked = query; return { count: 2 }; }
    },
    auditLog: {
      create: async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}`, ...data }; },
      findFirst: async () => null
    }
  }, async () => {
    const result = await updateTenantLifecycle({ salonId, status: 'CANCELED', endsAt: '' });
    assert.equal(result.access.allowed, false);
    assert.equal(result.access.code, 'SUBSCRIPTION_CANCELED');
  });

  assert.equal(revoked.where.salonId, salonId);
  assert.equal(revoked.where.revokedAt, null);
  const event = audits.find((item) => item.action === 'SAAS_SUBSCRIPTION_CHANGED');
  assert.ok(event);
  assert.equal(event.metadata.before.status, 'ACTIVE');
  assert.equal(event.metadata.after.status, 'CANCELED');
});

test('provisionamento cria tenant, ADMIN, contrato, módulos e billing em um único fluxo', async () => {
  const audits = [];
  let createdSalon = null;
  let createdAdmin = null;
  let createdSubscription = null;

  await withMocks({
    subscriptionPlan: { findUnique: async () => plan() },
    salon: {
      findUnique: async () => null,
      create: async ({ data }) => {
        createdSalon = data;
        return salon({ ...data });
      },
      delete: async () => ({})
    },
    user: {
      findUnique: async () => null,
      create: async ({ data }) => {
        createdAdmin = data;
        return { id: adminId, ...data };
      },
      deleteMany: async () => ({ count: 0 })
    },
    salonSubscription: {
      create: async ({ data }) => {
        createdSubscription = data;
        return { id: 'sub-new', ...data, plan: plan() };
      },
      deleteMany: async () => ({ count: 0 })
    },
    userSession: { deleteMany: async () => ({ count: 0 }) },
    auditLog: {
      create: async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}`, ...data }; },
      deleteMany: async () => ({ count: 0 })
    }
  }, async () => {
    const result = await provisionTenant({
      salon: {
        name: 'Studio Marco 21',
        slug: 'studio-marco21',
        phone: '11999999999',
        whatsapp: '11999999999',
        address: 'Rua Teste, 21',
        openingHours: '09h às 19h'
      },
      admin: { name: 'Admin Cliente', email: 'cliente@marco21.test', password: 'SenhaSegura123!' },
      enabledModules: ['SITE', 'AGENDA', 'CRM'],
      planId,
      status: 'TRIAL',
      billing: { provider: 'MANUAL' }
    });

    assert.equal(result.salon.slug, 'studio-marco21');
    assert.equal(result.subscription.status, 'TRIAL');
    assert.equal(result.access.allowed, true);
  });

  assert.deepEqual(createdSalon.enabledModules, ['SITE', 'AGENDA', 'CRM']);
  assert.equal(createdAdmin.role, 'ADMIN');
  assert.equal(createdAdmin.salonId, salonId);
  assert.notEqual(createdAdmin.password, 'SenhaSegura123!');
  assert.equal(createdSubscription.planId, planId);
  assert.ok(createdSubscription.endsAt instanceof Date);
  assert.ok(audits.some((item) => item.action === 'SAAS_BILLING_PROFILE_UPDATED'));
  assert.ok(audits.some((item) => item.action === 'SAAS_TENANT_PROVISIONED'));
});

test('falha no provisionamento remove tenant parcial em vez de deixar registro órfão', async () => {
  const cleanup = [];
  await withMocks({
    subscriptionPlan: { findUnique: async () => plan() },
    salon: {
      findUnique: async () => null,
      create: async ({ data }) => salon({ ...data }),
      delete: async () => { cleanup.push('salon'); return {}; }
    },
    user: {
      findUnique: async () => null,
      create: async () => { throw new Error('falha simulada ao criar ADMIN'); },
      deleteMany: async () => { cleanup.push('users'); return { count: 0 }; }
    },
    salonSubscription: { deleteMany: async () => { cleanup.push('subscription'); return { count: 0 }; } },
    userSession: { deleteMany: async () => { cleanup.push('sessions'); return { count: 0 }; } },
    auditLog: { deleteMany: async () => { cleanup.push('audits'); return { count: 0 }; } }
  }, async () => {
    await assert.rejects(() => provisionTenant({
      salon: { name: 'Falha', slug: 'falha-marco21', phone: '11999999999', whatsapp: '11999999999', address: 'Rua Teste, 21', openingHours: '09h às 19h' },
      admin: { name: 'Admin', email: 'falha@marco21.test', password: 'SenhaSegura123!' },
      enabledModules: ['SITE'],
      planId
    }), /falha simulada/);
  });

  assert.deepEqual(cleanup, ['audits', 'sessions', 'users', 'subscription', 'salon']);
});

test('rotação de senha do ADMIN revoga suas sessões e não grava a senha em auditoria', async () => {
  const audits = [];
  let sessionUpdate = null;
  const currentAdmin = { id: adminId, name: 'Admin Atual', email: 'admin@tenant.test', active: true, password: 'hash-antigo' };

  await withMocks({
    salon: { findUnique: async () => ({ id: salonId, slug: 'tenant' }) },
    user: {
      findFirst: async () => currentAdmin,
      findUnique: async () => null,
      update: async ({ data }) => ({ ...currentAdmin, ...data })
    },
    userSession: { updateMany: async (query) => { sessionUpdate = query; return { count: 1 }; } },
    auditLog: { create: async ({ data }) => { audits.push(data); return { id: 'audit-owner', ...data }; } }
  }, async () => {
    const result = await updateTenantOwner({ salonId, password: 'NovaSenhaSegura123!' });
    assert.equal(result.sessionsRevoked, true);
  });

  assert.equal(sessionUpdate.where.userId, adminId);
  assert.equal(audits[0].metadata.passwordRotated, true);
  assert.equal(JSON.stringify(audits[0].metadata).includes('NovaSenhaSegura123!'), false);
});

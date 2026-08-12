require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

const salonId = '507f1f77bcf86cd799439011';
const appointmentId = '507f1f77bcf86cd799439012';

function token(role) {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: `${role.toLowerCase()}@teste.local`,
    role,
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function enabledSalon() {
  return {
    id: salonId,
    modulesConfigured: true,
    enabledModules: ['AGENDA', 'ESTOQUE', 'CRM', 'FINANCEIRO', 'FIDELIDADE', 'WHATSAPP', 'IA']
  };
}

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

async function inject(role, options) {
  const app = buildApp();
  try {
    return await app.inject({
      ...options,
      headers: { ...(options.headers || {}), authorization: `Bearer ${token(role)}` }
    });
  } finally {
    await app.close();
  }
}

test('SUPER_ADMIN acessa administração global e não precisa operar tenant', async () => {
  const response = await inject('SUPER_ADMIN', { method: 'GET', url: '/platform-admin/modules/catalog' });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(Array.isArray(response.json().modules), true);
});

test('SUPER_ADMIN é bloqueado na Agenda operacional do tenant', async () => {
  const response = await inject('SUPER_ADMIN', { method: 'GET', url: '/admin/appointments' });
  assert.equal(response.statusCode, 403);
});

test('ADMIN acessa usuários do próprio tenant', async () => {
  await withMocks({
    salon: { findUnique: async () => enabledSalon() },
    user: { findMany: async ({ where }) => { assert.equal(where.salonId, salonId); return []; } }
  }, async () => {
    const response = await inject('ADMIN', { method: 'GET', url: '/admin/users' });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), []);
  });
});

test('RECEPTION não acessa usuários nem configuração crítica do ADMIN', async () => {
  await withMocks({ salon: { findUnique: async () => enabledSalon() } }, async () => {
    const response = await inject('RECEPTION', { method: 'GET', url: '/admin/users' });
    assert.equal(response.statusCode, 403);
  });
});

test('RECEPTION acessa CRM operacional quando módulo está habilitado', async () => {
  await withMocks({
    salon: { findUnique: async () => enabledSalon() },
    client: { findMany: async ({ where }) => { assert.equal(where.salonId, salonId); return []; } }
  }, async () => {
    const response = await inject('RECEPTION', { method: 'GET', url: '/admin/clients' });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), []);
  });
});

test('RECEPTION não acessa lançamentos financeiros exclusivos do ADMIN', async () => {
  await withMocks({ salon: { findUnique: async () => enabledSalon() } }, async () => {
    const response = await inject('RECEPTION', { method: 'GET', url: '/admin/financial' });
    assert.equal(response.statusCode, 403);
  });
});

test('PROFESSIONAL mantém leitura da Agenda do tenant', async () => {
  await withMocks({
    salon: { findUnique: async () => enabledSalon() },
    appointment: { findMany: async ({ where }) => { assert.equal(where.salonId, salonId); return []; } }
  }, async () => {
    const response = await inject('PROFESSIONAL', { method: 'GET', url: '/admin/appointments' });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), []);
  });
});

test('PROFESSIONAL não pode reagendar atendimento', async () => {
  const response = await inject('PROFESSIONAL', {
    method: 'PUT',
    url: `/admin/appointments/${appointmentId}`,
    payload: { status: 'CONFIRMED' }
  });
  assert.equal(response.statusCode, 403);
});

test('PROFESSIONAL não pode operar lista de espera', async () => {
  const response = await inject('PROFESSIONAL', { method: 'GET', url: '/admin/appointments/waitlist' });
  assert.equal(response.statusCode, 403);
});

test('PROFESSIONAL não pode abrir mesa operacional da recepção', async () => {
  await withMocks({ salon: { findUnique: async () => enabledSalon() } }, async () => {
    const response = await inject('PROFESSIONAL', { method: 'GET', url: '/admin/appointments/operational-options' });
    assert.equal(response.statusCode, 403);
  });
});

test('PROFESSIONAL não acessa CRM', async () => {
  const response = await inject('PROFESSIONAL', { method: 'GET', url: '/admin/clients' });
  assert.equal(response.statusCode, 403);
});

require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

function token(role = 'ADMIN', salonId = '507f1f77bcf86cd799439011') {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: 'admin@teste.local',
    role,
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
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
    for (const [delegate, method, original] of originals.reverse()) {
      prisma[delegate][method] = original;
    }
  }
}

test('buildApp exige autenticação e aplica cabeçalhos de segurança', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/admin/appointments' });
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  } finally {
    await app.close();
  }
});

test('RBAC bloqueia perfil não operacional antes de consultar módulo do salão', async () => {
  const app = buildApp();
  let salonReads = 0;
  try {
    await withMocks({ salon: { findUnique: async () => { salonReads += 1; return null; } } }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/appointments',
        headers: { authorization: `Bearer ${token('SUPER_ADMIN')}` }
      });
      assert.equal(response.statusCode, 403);
      assert.equal(salonReads, 0);
    });
  } finally {
    await app.close();
  }
});

test('falha Zod é normalizada para contrato HTTP 400', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/appointments/availability?serviceId=invalid&date=2026-08-20'
    });
    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.message, 'Dados inválidos.');
    assert.equal(Array.isArray(body.issues), true);
  } finally {
    await app.close();
  }
});

test('salonId assinado no JWT prevalece sobre cabeçalho público na rota administrativa', async () => {
  const app = buildApp();
  const tenantSalonId = '507f1f77bcf86cd799439011';
  let appointmentWhere = null;
  try {
    await withMocks({
      salon: {
        findUnique: async ({ where }) => {
          assert.equal(where.id, tenantSalonId);
          return { modulesConfigured: true, enabledModules: ['AGENDA'] };
        }
      },
      appointment: {
        findMany: async ({ where }) => {
          appointmentWhere = where;
          return [];
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/appointments',
        headers: {
          authorization: `Bearer ${token('ADMIN', tenantSalonId)}`,
          'x-salon-slug': 'outro-salao'
        }
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), []);
      assert.equal(appointmentWhere.salonId, tenantSalonId);
    });
  } finally {
    await app.close();
  }
});

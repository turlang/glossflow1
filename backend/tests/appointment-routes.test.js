require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

const salonId = '507f1f77bcf86cd799439011';
const serviceId = '507f1f77bcf86cd799439012';

function token() {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: 'admin@teste.local',
    role: 'ADMIN',
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
    for (const [delegate, method, original] of originals.reverse()) prisma[delegate][method] = original;
  }
}

test('Agenda admin bloqueia módulo desabilitado antes de consultar agendamentos', async () => {
  const app = buildApp();
  let appointmentReads = 0;
  try {
    await withMocks({
      salon: { findUnique: async () => ({ modulesConfigured: true, enabledModules: [] }) },
      appointment: { findMany: async () => { appointmentReads += 1; return []; } }
    }, async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/appointments', headers: { authorization: `Bearer ${token()}` } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, 'MODULE_DISABLED');
      assert.equal(appointmentReads, 0);
    });
  } finally {
    await app.close();
  }
});

test('Agenda admin habilitada consulta somente o salão autenticado', async () => {
  const app = buildApp();
  let receivedWhere = null;
  try {
    await withMocks({
      salon: { findUnique: async ({ where }) => { assert.equal(where.id, salonId); return { modulesConfigured: true, enabledModules: ['AGENDA'] }; } },
      appointment: { findMany: async ({ where }) => { receivedWhere = where; return []; } }
    }, async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/appointments', headers: { authorization: `Bearer ${token()}` } });
      assert.equal(response.statusCode, 200);
      assert.equal(receivedWhere.salonId, salonId);
    });
  } finally {
    await app.close();
  }
});

test('Agenda pública bloqueia módulo desabilitado antes de consultar disponibilidade', async () => {
  const app = buildApp();
  let serviceReads = 0;
  try {
    await withMocks({
      salon: {
        findUnique: async ({ where }) => {
          if (where.slug) {
            assert.equal(where.slug, 'glossflow');
            return { id: salonId, slug: 'glossflow', name: 'GlossFlow', modulesConfigured: true, enabledModules: [], openingHours: '09h às 19h' };
          }
          assert.equal(where.id, salonId);
          return { subscription: null };
        }
      },
      service: { findFirst: async () => { serviceReads += 1; return null; } }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/appointments/availability?serviceId=${serviceId}&date=2026-08-20`
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().module, 'AGENDA');
      assert.equal(serviceReads, 0);
    });
  } finally {
    await app.close();
  }
});

test('Agenda pública habilitada consulta ocupação apenas do salão resolvido', async () => {
  const app = buildApp();
  let whereSeen = null;
  try {
    await withMocks({
      salon: {
        findUnique: async ({ where }) => where.slug
          ? { id: salonId, slug: 'glossflow', name: 'GlossFlow', modulesConfigured: true, enabledModules: ['AGENDA'], openingHours: '09h às 19h' }
          : { subscription: null }
      },
      appointment: {
        findMany: async ({ where }) => { whereSeen = where; return []; }
      }
    }, async () => {
      const response = await app.inject({ method: 'GET', url: '/appointments' });
      assert.equal(response.statusCode, 200);
      assert.equal(whereSeen.salonId, salonId);
      assert.equal(whereSeen.status, 'CONFIRMED');
    });
  } finally {
    await app.close();
  }
});

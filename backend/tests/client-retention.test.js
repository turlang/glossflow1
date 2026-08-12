require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');
const { buildRetentionProfile } = require('../src/services/client-retention.service.ts');

const salonId = '507f1f77bcf86cd799439011';
const clientId = '507f1f77bcf86cd799439013';

function token(role = 'ADMIN') {
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
    for (const [delegate, method, original] of originals.reverse()) prisma[delegate][method] = original;
  }
}

function enabledSalon() {
  return {
    name: 'Gloss Teste',
    modulesConfigured: true,
    enabledModules: ['AGENDA', 'ESTOQUE', 'CRM', 'WHATSAPP', 'IA']
  };
}

const now = new Date('2026-08-12T12:00:00.000Z');

function visit(daysAgo, status = 'COMPLETED') {
  return {
    id: `a-${daysAgo}-${status}`,
    startTime: new Date(now.getTime() - daysAgo * 86400000),
    endTime: new Date(now.getTime() - daysAgo * 86400000 + 3600000),
    status
  };
}

test('segmentação de retenção explica aniversário, frequência e opt-out', () => {
  const profile = buildRetentionProfile({
    id: clientId,
    name: 'Carla Silva',
    phone: '11999999999',
    email: 'carla@example.com',
    birthDate: new Date('1995-08-20T12:00:00.000Z'),
    appointments: [visit(10), visit(30), visit(60), visit(3, 'CANCELLED')],
    consents: [{ granted: false, createdAt: new Date('2026-08-11T12:00:00.000Z') }]
  }, now);

  assert.equal(profile.primarySegment, 'BIRTHDAY');
  assert.equal(profile.marketingAllowed, false);
  assert.equal(profile.visits90d, 3);
  assert.ok(profile.tags.includes('FREQUENT'));
  assert.match(profile.reasons.join(' '), /Aniversário/i);
});

test('overview CRM calcula segmentos e métricas apenas do tenant autenticado', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        findMany: async ({ where }) => {
          assert.equal(where.salonId, salonId);
          return [
            { id: clientId, name: 'Carla', phone: '11999999999', email: null, birthDate: new Date('1995-08-20T12:00:00Z'), createdAt: now, consents: [], appointments: [visit(70)] },
            { id: '507f1f77bcf86cd799439014', name: 'Bia', phone: '11988888888', email: null, birthDate: null, createdAt: now, consents: [{ granted: false, createdAt: now }], appointments: [visit(130)] }
          ];
        }
      },
      auditLog: { findMany: async ({ where }) => { assert.equal(where.salonId, salonId); return []; } }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/clients/retention',
        headers: { authorization: `Bearer ${token()}` }
      });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json();
      assert.equal(body.summary.totalClients, 2);
      assert.equal(body.summary.optedOut, 1);
      assert.equal(body.summary.inactive60d, 2);
      assert.equal(body.summary.inactive120d, 1);
      assert.equal(body.clients[0].primarySegment, 'BIRTHDAY');
    });
  } finally {
    await app.close();
  }
});

test('histórico de atendimentos permanece isolado por tenant', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        findFirst: async ({ where }) => {
          assert.equal(where.id, clientId);
          assert.equal(where.salonId, salonId);
          return { id: clientId, name: 'Carla', phone: '11999999999', appointments: [] };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/admin/clients/${clientId}/history`,
        headers: { authorization: `Bearer ${token('RECEPTION')}` }
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().id, clientId);
    });
  } finally {
    await app.close();
  }
});

test('opt-out de marketing cria evidência LGPD no tenant', async () => {
  const app = buildApp();
  let created = null;
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: { findFirst: async ({ where }) => ({ id: where.id }) },
      lgpdConsent: {
        create: async ({ data }) => {
          created = data;
          return { id: '507f1f77bcf86cd799439099', ...data, createdAt: now };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/admin/clients/${clientId}/marketing-consent`,
        headers: { authorization: `Bearer ${token()}` },
        payload: { granted: false, evidence: 'Pedido do cliente no balcão' }
      });
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(created.salonId, salonId);
      assert.equal(created.clientId, clientId);
      assert.equal(created.type, 'MARKETING');
      assert.equal(created.granted, false);
    });
  } finally {
    await app.close();
  }
});

test('follow-up é bloqueado quando o cliente fez opt-out', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        findFirst: async () => ({
          id: clientId,
          name: 'Carla',
          phone: '11999999999',
          email: null,
          birthDate: null,
          createdAt: now,
          consents: [{ granted: false, createdAt: now }],
          appointments: [visit(80)]
        })
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/admin/clients/${clientId}/follow-up`,
        headers: { authorization: `Bearer ${token()}` }
      });
      assert.equal(response.statusCode, 409, response.body);
      assert.equal(response.json().code, 'MARKETING_OPT_OUT');
    });
  } finally {
    await app.close();
  }
});

test('follow-up registra contato e devolve mensagem preparada sem disparo automático', async () => {
  const app = buildApp();
  let audit = null;
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        findFirst: async () => ({
          id: clientId,
          name: 'Carla Silva',
          phone: '(11) 99999-9999',
          email: null,
          birthDate: null,
          createdAt: now,
          consents: [],
          appointments: [visit(130)]
        })
      },
      whatsAppTemplate: { findFirst: async () => null },
      auditLog: {
        create: async ({ data }) => {
          audit = data;
          return { id: 'log-1', ...data, createdAt: now };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/admin/clients/${clientId}/follow-up`,
        headers: { authorization: `Bearer ${token('RECEPTION')}` }
      });
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json();
      assert.equal(body.ok, true);
      assert.match(body.whatsappUrl, /^https:\/\/wa\.me\//);
      assert.match(body.message, /Faz um tempo/i);
      assert.equal(audit.resource, 'RetentionFollowUp');
      assert.equal(audit.resourceId, clientId);
      assert.equal(audit.metadata.segment, 'INACTIVE_120');
    });
  } finally {
    await app.close();
  }
});

require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const { exportClientPersonalData, eraseClientPersonalData } = require('../src/services/lgpd.service.ts');

const salonId = '507f1f77bcf86cd799439011';
const clientId = '507f191e810c19729de860ea';
const appointmentId = '507f191e810c19729de860eb';

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

function clientFixture() {
  return {
    id: clientId,
    salonId,
    name: 'Cliente Teste',
    phone: '(11) 99999-0000',
    email: 'cliente@example.test',
    birthDate: new Date('1990-01-01T00:00:00.000Z'),
    notes: 'preferência de teste',
    preferences: 'sem perfume',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    appointments: [{
      id: appointmentId,
      salonId,
      clientId,
      clientName: 'Cliente Teste',
      clientPhone: '11999990000',
      clientEmail: 'cliente@example.test',
      startTime: new Date('2026-02-10T12:00:00.000Z'),
      service: { id: 'service-1', name: 'Serviço', price: 100, duration: 60 },
      professional: { id: 'professional-1', name: 'Profissional' }
    }],
    waitlistEntries: [{ id: 'wait-1', clientId }],
    loyaltyEntries: [{ id: 'loyalty-1', clientId }],
    consents: [{ id: 'consent-1', clientId, type: 'MARKETING', granted: true }]
  };
}

test('exportação LGPD isola tenant e agrega eventos realmente ligados ao titular', async () => {
  let receivedWhere = null;
  await withMocks({
    client: {
      findFirst: async ({ where }) => {
        receivedWhere = where;
        return clientFixture();
      }
    },
    auditLog: {
      findMany: async () => [
        {
          id: 'log-1', action: 'WHATSAPP_RECEIVED', resource: 'WhatsAppMessage',
          resourceId: 'provider-message', metadata: { phone: '5511999990000', text: 'oi' }, createdAt: new Date()
        },
        {
          id: 'log-2', action: 'WHATSAPP_RECEIVED', resource: 'WhatsAppMessage',
          resourceId: 'other-message', metadata: { phone: '5511888880000', text: 'outro cliente' }, createdAt: new Date()
        },
        {
          id: 'log-3', action: 'RETENTION_FOLLOWUP_INITIATED', resource: 'RetentionFollowUp',
          resourceId: clientId, metadata: { segment: 'ACTIVE' }, createdAt: new Date()
        }
      ]
    }
  }, async () => {
    const bundle = await exportClientPersonalData(salonId, clientId);
    assert.equal(receivedWhere.salonId, salonId);
    assert.equal(receivedWhere.id, clientId);
    assert.equal(bundle.subject.email, 'cliente@example.test');
    assert.equal(bundle.appointments.length, 1);
    assert.deepEqual(bundle.processingEvents.map((item) => item.id), ['log-1', 'log-3']);
  });
});

test('eliminação LGPD anonimiza histórico e remove dados operacionais dispensáveis', async () => {
  const auditUpdates = [];
  let appointmentUpdate = null;
  let finalAudit = null;
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(prisma);

  try {
    await withMocks({
      client: {
        findFirst: async ({ where }) => {
          assert.equal(where.salonId, salonId);
          return { ...clientFixture(), appointments: [{ id: appointmentId }] };
        },
        deleteMany: async ({ where }) => {
          assert.deepEqual(where, { salonId, id: clientId });
          return { count: 1 };
        }
      },
      auditLog: {
        findMany: async () => [
          { id: 'message-log', resource: 'WhatsAppMessage', resourceId: 'provider-id', metadata: { phone: '5511999990000', text: 'conteúdo pessoal' } },
          { id: 'notification-log', resource: 'OperationalNotification', resourceId: appointmentId, metadata: { clientName: 'Cliente Teste', message: 'Cliente Teste chegou' } },
          { id: 'other-log', resource: 'WhatsAppMessage', resourceId: 'other', metadata: { phone: '5511888880000', text: 'outro' } }
        ],
        update: async (args) => { auditUpdates.push(args); return args.data; },
        create: async ({ data }) => { finalAudit = data; return data; }
      },
      appointment: {
        updateMany: async (args) => { appointmentUpdate = args; return { count: 1 }; }
      },
      waitlistEntry: { deleteMany: async () => ({ count: 1 }) },
      loyaltyEntry: { deleteMany: async () => ({ count: 2 }) },
      lgpdConsent: { deleteMany: async () => ({ count: 1 }) }
    }, async () => {
      const result = await eraseClientPersonalData({
        salonId,
        clientId,
        requestedByUserId: 'admin-1',
        reason: 'Solicitação formal do titular em teste.'
      });

      assert.equal(result.ok, true);
      assert.equal(result.appointmentsAnonymized, 1);
      assert.equal(result.auditEventsRedacted, 2);
      assert.equal(auditUpdates.length, 2);
      assert.equal(auditUpdates.every((item) => String(item.data.resourceId).startsWith('anon:')), true);
      assert.equal(appointmentUpdate.data.clientId, null);
      assert.equal(appointmentUpdate.data.clientName, 'Titular removido');
      assert.equal(appointmentUpdate.data.clientPhone, '');
      assert.equal(appointmentUpdate.data.clientEmail, null);
      assert.equal(finalAudit.action, 'LGPD_SUBJECT_ERASED');
      assert.equal(finalAudit.userId, 'admin-1');
      assert.equal(String(finalAudit.resourceId).startsWith('anon:'), true);
    });
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test('eliminação não atravessa tenant quando titular não existe no salão atual', async () => {
  await withMocks({ client: { findFirst: async () => null } }, async () => {
    const result = await eraseClientPersonalData({
      salonId,
      clientId: 'outro-cliente',
      requestedByUserId: 'admin-1',
      reason: 'Solicitação formal de teste suficiente.'
    });
    assert.equal(result, null);
  });
});

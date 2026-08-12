require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const {
  retentionPolicy,
  previewTenantRetention,
  runTenantRetention
} = require('../src/services/data-retention.service.ts');

const salonId = '507f1f77bcf86cd799439011';

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

test('política de retenção possui defaults explícitos e datas previsíveis', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const policy = retentionPolicy(now);
  assert.equal(policy.sessionDays, 30);
  assert.equal(policy.whatsappDays, 180);
  assert.equal(policy.auditDays, 730);
  assert.equal(policy.backupDays, 180);
  assert.equal(policy.sessionCutoff.toISOString(), '2026-07-13T12:00:00.000Z');
});

test('preview de retenção mantém todas as contagens isoladas por tenant', async () => {
  const seen = [];
  await withMocks({
    userSession: { count: async ({ where }) => { seen.push(where.salonId); return 2; } },
    auditLog: { count: async ({ where }) => { seen.push(where.salonId); return where.resource ? 3 : 4; } },
    backupJob: { count: async ({ where }) => { seen.push(where.salonId); return 1; } }
  }, async () => {
    const preview = await previewTenantRetention(salonId, new Date('2026-08-12T12:00:00.000Z'));
    assert.deepEqual(preview.candidates, {
      sessionsToDelete: 2,
      whatsappEventsToRedact: 3,
      auditLogsToDelete: 4,
      backupMetadataToDelete: 1
    });
    assert.equal(seen.every((value) => value === salonId), true);
  });
});

test('execução redige conteúdo antigo antes de remover metadados vencidos', async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(prisma);
  const updates = [];
  let auditEvent = null;

  try {
    await withMocks({
      auditLog: {
        findMany: async () => [{ id: 'log-1', resource: 'WhatsAppMessage', metadata: { direction: 'IN', text: 'dado pessoal' } }],
        update: async (args) => { updates.push(args); return args.data; },
        deleteMany: async () => ({ count: 5 }),
        create: async ({ data }) => { auditEvent = data; return data; }
      },
      userSession: { deleteMany: async () => ({ count: 2 }) },
      backupJob: { deleteMany: async () => ({ count: 1 }) }
    }, async () => {
      const result = await runTenantRetention({
        salonId,
        userId: 'admin-1',
        now: new Date('2026-08-12T12:00:00.000Z')
      });
      assert.equal(result.ok, true);
      assert.equal(result.whatsappEventsRedacted, 1);
      assert.equal(updates[0].data.metadata.redactedByRetention, true);
      assert.equal(updates[0].data.metadata.text, undefined);
      assert.equal(auditEvent.action, 'DATA_RETENTION_APPLIED');
      assert.equal(auditEvent.salonId, salonId);
    });
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

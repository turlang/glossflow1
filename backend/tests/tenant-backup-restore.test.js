require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';

const { prisma } = require('../src/lib/prisma.ts');
const {
  createTenantBackup,
  restoreTenantBackup,
  verifyTenantBackup
} = require('../src/services/tenant-backup.service.ts');

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

function exportMocks(serviceRows = []) {
  const empty = async () => [];
  return {
    service: { findMany: async () => serviceRows },
    professional: { findMany: empty },
    portfolioItem: { findMany: empty },
    client: { findMany: empty },
    appointment: { findMany: empty },
    waitlistEntry: { findMany: empty },
    inventoryProduct: { findMany: empty },
    inventoryMovement: { findMany: empty },
    financialEntry: { findMany: empty },
    commissionRule: { findMany: empty },
    loyaltyProgram: { findUnique: async () => null },
    loyaltyEntry: { findMany: empty },
    whatsAppTemplate: { findMany: empty },
    lgpdConsent: { findMany: empty }
  };
}

test('snapshot assinado valida íntegro e rejeita adulteração ou outro tenant', async () => {
  await withMocks(exportMocks(), async () => {
    const { envelope } = await createTenantBackup(salonId);
    assert.equal(verifyTenantBackup(envelope, salonId).salonId, salonId);

    const tampered = JSON.parse(JSON.stringify(envelope));
    tampered.data.clients.push({ id: 'cliente-injetado', salonId });
    assert.throws(() => verifyTenantBackup(tampered, salonId), /assinatura/i);
    assert.throws(() => verifyTenantBackup(envelope, '507f1f77bcf86cd799439099'), /outro tenant/i);
  });
});

test('restore permanece bloqueado por padrão mesmo com snapshot válido', async () => {
  const previous = process.env.BACKUP_RESTORE_ENABLED;
  delete process.env.BACKUP_RESTORE_ENABLED;
  try {
    await withMocks(exportMocks(), async () => {
      const { envelope } = await createTenantBackup(salonId);
      await assert.rejects(
        restoreTenantBackup({ salonId, requestedByUserId: 'admin-1', snapshot: envelope }),
        /Restore bloqueado/i
      );
    });
  } finally {
    if (previous === undefined) delete process.env.BACKUP_RESTORE_ENABLED;
    else process.env.BACKUP_RESTORE_ENABLED = previous;
  }
});

test('restore habilitado substitui domínio operacional no tenant e audita a recuperação', async () => {
  const serviceRow = {
    id: '507f1f77bcf86cd799439021',
    name: 'Serviço restaurado',
    description: '',
    price: 120,
    durationMin: 60,
    imageUrl: '',
    active: true,
    salonId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
  let snapshot;
  await withMocks(exportMocks([serviceRow]), async () => {
    snapshot = (await createTenantBackup(salonId)).envelope;
  });

  const previous = process.env.BACKUP_RESTORE_ENABLED;
  process.env.BACKUP_RESTORE_ENABLED = 'true';
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(prisma);
  const serviceCreates = [];
  let restoreAudit = null;
  const deleted = async () => ({ count: 0 });

  try {
    await withMocks({
      inventoryMovement: { deleteMany: deleted },
      loyaltyEntry: { deleteMany: deleted },
      lgpdConsent: { deleteMany: deleted },
      waitlistEntry: { deleteMany: deleted },
      appointment: { deleteMany: deleted },
      commissionRule: { deleteMany: deleted },
      inventoryProduct: { deleteMany: deleted },
      client: { deleteMany: deleted },
      portfolioItem: { deleteMany: deleted },
      financialEntry: { deleteMany: deleted },
      whatsAppTemplate: { deleteMany: deleted },
      loyaltyProgram: { deleteMany: deleted },
      service: {
        deleteMany: deleted,
        createMany: async ({ data }) => { serviceCreates.push(...data); return { count: data.length }; }
      },
      professional: { deleteMany: deleted },
      auditLog: { create: async ({ data }) => { restoreAudit = data; return data; } }
    }, async () => {
      const result = await restoreTenantBackup({ salonId, requestedByUserId: 'admin-1', snapshot });
      assert.equal(result.ok, true);
      assert.equal(result.restored.services, 1);
      assert.equal(serviceCreates.length, 1);
      assert.equal(serviceCreates[0].salonId, salonId);
      assert.equal(restoreAudit.action, 'TENANT_BACKUP_RESTORED');
      assert.equal(restoreAudit.userId, 'admin-1');
    });
  } finally {
    prisma.$transaction = originalTransaction;
    if (previous === undefined) delete process.env.BACKUP_RESTORE_ENABLED;
    else process.env.BACKUP_RESTORE_ENABLED = previous;
  }
});

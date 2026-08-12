import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const TENANT_BACKUP_SCHEMA = 'glossflow-tenant-backup/v1';

type BackupRows = Record<string, unknown>[];

export type TenantBackupEnvelope = {
  schema: string;
  salonId: string;
  createdAt: string;
  data: {
    services: BackupRows;
    professionals: BackupRows;
    portfolioItems: BackupRows;
    clients: BackupRows;
    appointments: BackupRows;
    waitlistEntries: BackupRows;
    inventoryProducts: BackupRows;
    inventoryMovements: BackupRows;
    financialEntries: BackupRows;
    commissionRules: BackupRows;
    loyaltyProgram: Record<string, unknown> | null;
    loyaltyEntries: BackupRows;
    whatsappTemplates: BackupRows;
    lgpdConsents: BackupRows;
  };
  signature: string;
};

function signingSecret() {
  const secret = String(process.env.BACKUP_SIGNING_SECRET || process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('BACKUP_SIGNING_SECRET ou JWT_SECRET forte é obrigatório para backup em produção.');
  }
  return secret || 'glossflow-local-backup-signing-secret-with-32-chars';
}

function unsignedEnvelope(envelope: Omit<TenantBackupEnvelope, 'signature'>) {
  return JSON.stringify(envelope);
}

function sign(envelope: Omit<TenantBackupEnvelope, 'signature'>) {
  return createHmac('sha256', signingSecret()).update(unsignedEnvelope(envelope)).digest('hex');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asRows(value: unknown): BackupRows {
  if (!Array.isArray(value) || !value.every(isObject)) throw new Error('Snapshot de backup inválido.');
  return value;
}

function parseEnvelope(value: unknown): TenantBackupEnvelope {
  if (!isObject(value) || !isObject(value.data)) throw new Error('Envelope de backup inválido.');
  const data = value.data;
  const envelope: TenantBackupEnvelope = {
    schema: String(value.schema || ''),
    salonId: String(value.salonId || ''),
    createdAt: String(value.createdAt || ''),
    data: {
      services: asRows(data.services),
      professionals: asRows(data.professionals),
      portfolioItems: asRows(data.portfolioItems),
      clients: asRows(data.clients),
      appointments: asRows(data.appointments),
      waitlistEntries: asRows(data.waitlistEntries),
      inventoryProducts: asRows(data.inventoryProducts),
      inventoryMovements: asRows(data.inventoryMovements),
      financialEntries: asRows(data.financialEntries),
      commissionRules: asRows(data.commissionRules),
      loyaltyProgram: data.loyaltyProgram === null ? null : (isObject(data.loyaltyProgram) ? data.loyaltyProgram : null),
      loyaltyEntries: asRows(data.loyaltyEntries),
      whatsappTemplates: asRows(data.whatsappTemplates),
      lgpdConsents: asRows(data.lgpdConsents)
    },
    signature: String(value.signature || '')
  };
  if (envelope.schema !== TENANT_BACKUP_SCHEMA || !envelope.salonId || !envelope.createdAt || !envelope.signature) {
    throw new Error('Metadados do backup inválidos ou incompatíveis.');
  }
  return envelope;
}

function stripSignature(envelope: TenantBackupEnvelope): Omit<TenantBackupEnvelope, 'signature'> {
  const { signature: _signature, ...unsigned } = envelope;
  return unsigned;
}

export function verifyTenantBackup(value: unknown, expectedSalonId: string) {
  const envelope = parseEnvelope(value);
  if (envelope.salonId !== expectedSalonId) throw new Error('Backup pertence a outro tenant.');
  const expected = sign(stripSignature(envelope));
  const received = envelope.signature;
  if (expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    throw new Error('Assinatura do backup inválida. O snapshot pode ter sido alterado ou corrompido.');
  }
  return envelope;
}

function tenantRow<T extends Record<string, unknown>>(row: T, salonId: string) {
  return { ...row, salonId };
}

function counts(data: TenantBackupEnvelope['data']) {
  return {
    services: data.services.length,
    professionals: data.professionals.length,
    portfolioItems: data.portfolioItems.length,
    clients: data.clients.length,
    appointments: data.appointments.length,
    waitlistEntries: data.waitlistEntries.length,
    inventoryProducts: data.inventoryProducts.length,
    inventoryMovements: data.inventoryMovements.length,
    financialEntries: data.financialEntries.length,
    commissionRules: data.commissionRules.length,
    loyaltyPrograms: data.loyaltyProgram ? 1 : 0,
    loyaltyEntries: data.loyaltyEntries.length,
    whatsappTemplates: data.whatsappTemplates.length,
    lgpdConsents: data.lgpdConsents.length
  };
}

/** Exporta somente domínio operacional; nunca inclui usuários, senhas, sessões ou contrato SaaS. */
export async function createTenantBackup(salonId: string) {
  const [
    services,
    professionals,
    portfolioItems,
    clients,
    appointments,
    waitlistEntries,
    inventoryProducts,
    inventoryMovements,
    financialEntries,
    commissionRules,
    loyaltyProgram,
    loyaltyEntries,
    whatsappTemplates,
    lgpdConsents
  ] = await Promise.all([
    prisma.service.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.professional.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.portfolioItem.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.client.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.appointment.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.waitlistEntry.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.inventoryProduct.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.inventoryMovement.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.financialEntry.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.commissionRule.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.loyaltyProgram.findUnique({ where: { salonId } }),
    prisma.loyaltyEntry.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.whatsAppTemplate.findMany({ where: { salonId }, orderBy: { id: 'asc' } }),
    prisma.lgpdConsent.findMany({ where: { salonId }, orderBy: { id: 'asc' } })
  ]);

  const unsigned: Omit<TenantBackupEnvelope, 'signature'> = {
    schema: TENANT_BACKUP_SCHEMA,
    salonId,
    createdAt: new Date().toISOString(),
    data: {
      services,
      professionals,
      portfolioItems,
      clients,
      appointments,
      waitlistEntries,
      inventoryProducts,
      inventoryMovements,
      financialEntries,
      commissionRules,
      loyaltyProgram,
      loyaltyEntries,
      whatsappTemplates,
      lgpdConsents
    } as unknown as TenantBackupEnvelope['data']
  };
  const envelope: TenantBackupEnvelope = { ...unsigned, signature: sign(unsigned) };
  return { envelope, counts: counts(envelope.data) };
}

/**
 * Restore destrutivo deliberadamente opt-in. O endpoint que chama este serviço
 * precisa exigir confirmação e BACKUP_RESTORE_ENABLED=true.
 */
export async function restoreTenantBackup(input: {
  salonId: string;
  requestedByUserId: string;
  snapshot: unknown;
}) {
  const envelope = verifyTenantBackup(input.snapshot, input.salonId);
  if (String(process.env.BACKUP_RESTORE_ENABLED || 'false').toLowerCase() !== 'true') {
    throw new Error('Restore bloqueado. Habilite BACKUP_RESTORE_ENABLED somente durante procedimento controlado de recuperação.');
  }

  const data = envelope.data;
  const restored = counts(data);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.deleteMany({ where: { salonId: input.salonId } });
    await tx.loyaltyEntry.deleteMany({ where: { salonId: input.salonId } });
    await tx.lgpdConsent.deleteMany({ where: { salonId: input.salonId } });
    await tx.waitlistEntry.deleteMany({ where: { salonId: input.salonId } });
    await tx.appointment.deleteMany({ where: { salonId: input.salonId } });
    await tx.commissionRule.deleteMany({ where: { salonId: input.salonId } });
    await tx.inventoryProduct.deleteMany({ where: { salonId: input.salonId } });
    await tx.client.deleteMany({ where: { salonId: input.salonId } });
    await tx.portfolioItem.deleteMany({ where: { salonId: input.salonId } });
    await tx.financialEntry.deleteMany({ where: { salonId: input.salonId } });
    await tx.whatsAppTemplate.deleteMany({ where: { salonId: input.salonId } });
    await tx.loyaltyProgram.deleteMany({ where: { salonId: input.salonId } });
    await tx.service.deleteMany({ where: { salonId: input.salonId } });
    await tx.professional.deleteMany({ where: { salonId: input.salonId } });

    if (data.services.length) await tx.service.createMany({ data: data.services.map((row) => tenantRow(row, input.salonId)) as Prisma.ServiceCreateManyInput[] });
    if (data.professionals.length) await tx.professional.createMany({ data: data.professionals.map((row) => tenantRow(row, input.salonId)) as Prisma.ProfessionalCreateManyInput[] });
    if (data.portfolioItems.length) await tx.portfolioItem.createMany({ data: data.portfolioItems.map((row) => tenantRow(row, input.salonId)) as Prisma.PortfolioItemCreateManyInput[] });
    if (data.clients.length) await tx.client.createMany({ data: data.clients.map((row) => tenantRow(row, input.salonId)) as Prisma.ClientCreateManyInput[] });
    if (data.inventoryProducts.length) await tx.inventoryProduct.createMany({ data: data.inventoryProducts.map((row) => tenantRow(row, input.salonId)) as Prisma.InventoryProductCreateManyInput[] });
    if (data.appointments.length) await tx.appointment.createMany({ data: data.appointments.map((row) => tenantRow(row, input.salonId)) as Prisma.AppointmentCreateManyInput[] });
    if (data.waitlistEntries.length) await tx.waitlistEntry.createMany({ data: data.waitlistEntries.map((row) => tenantRow(row, input.salonId)) as Prisma.WaitlistEntryCreateManyInput[] });
    if (data.inventoryMovements.length) await tx.inventoryMovement.createMany({ data: data.inventoryMovements.map((row) => tenantRow(row, input.salonId)) as Prisma.InventoryMovementCreateManyInput[] });
    if (data.financialEntries.length) await tx.financialEntry.createMany({ data: data.financialEntries.map((row) => tenantRow(row, input.salonId)) as Prisma.FinancialEntryCreateManyInput[] });
    if (data.commissionRules.length) await tx.commissionRule.createMany({ data: data.commissionRules.map((row) => tenantRow(row, input.salonId)) as Prisma.CommissionRuleCreateManyInput[] });
    if (data.loyaltyProgram) await tx.loyaltyProgram.create({ data: tenantRow(data.loyaltyProgram, input.salonId) as Prisma.LoyaltyProgramCreateInput });
    if (data.loyaltyEntries.length) await tx.loyaltyEntry.createMany({ data: data.loyaltyEntries.map((row) => tenantRow(row, input.salonId)) as Prisma.LoyaltyEntryCreateManyInput[] });
    if (data.whatsappTemplates.length) await tx.whatsAppTemplate.createMany({ data: data.whatsappTemplates.map((row) => tenantRow(row, input.salonId)) as Prisma.WhatsAppTemplateCreateManyInput[] });
    if (data.lgpdConsents.length) await tx.lgpdConsent.createMany({ data: data.lgpdConsents.map((row) => tenantRow(row, input.salonId)) as Prisma.LgpdConsentCreateManyInput[] });

    await tx.auditLog.create({
      data: {
        action: 'TENANT_BACKUP_RESTORED',
        resource: 'BackupJob',
        method: 'ADMIN',
        path: '/admin/security/backups/restore',
        salonId: input.salonId,
        userId: input.requestedByUserId,
        metadata: {
          schema: envelope.schema,
          snapshotCreatedAt: envelope.createdAt,
          signaturePrefix: envelope.signature.slice(0, 12),
          restored
        }
      }
    });
  });

  return { ok: true as const, restored, sourceCreatedAt: envelope.createdAt };
}

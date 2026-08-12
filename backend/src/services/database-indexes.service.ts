import { prisma } from '../lib/prisma';

export type IndexSyncLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

type IndexDefinition = {
  key: Record<string, 1 | -1>;
  name: string;
};

type CollectionIndexes = {
  collection: string;
  indexes: IndexDefinition[];
};

/**
 * Índices compostos alinhados aos filtros reais do SaaS multi-tenant.
 *
 * Prisma + MongoDB não usa migrations SQL. O Render também não executa
 * `prisma db push` no deploy. Por isso os índices críticos são sincronizados
 * via `createIndexes`, operação idempotente e não destrutiva do MongoDB.
 */
export const criticalMongoIndexes: CollectionIndexes[] = [
  {
    collection: 'UserSession',
    indexes: [
      { key: { salonId: 1, revokedAt: 1, expiresAt: 1 }, name: 'idx_session_salon_active_expiry' },
      { key: { userId: 1, revokedAt: 1, expiresAt: 1 }, name: 'idx_session_user_active_expiry' }
    ]
  },
  {
    collection: 'Service',
    indexes: [{ key: { salonId: 1, active: 1 }, name: 'idx_service_salon_active' }]
  },
  {
    collection: 'Professional',
    indexes: [{ key: { salonId: 1, active: 1 }, name: 'idx_professional_salon_active' }]
  },
  {
    collection: 'Client',
    indexes: [
      { key: { salonId: 1, phone: 1 }, name: 'idx_client_salon_phone' },
      { key: { salonId: 1, createdAt: -1 }, name: 'idx_client_salon_created' }
    ]
  },
  {
    collection: 'Appointment',
    indexes: [
      { key: { salonId: 1, startTime: 1 }, name: 'idx_appointment_salon_start' },
      { key: { salonId: 1, professionalId: 1, startTime: 1 }, name: 'idx_appointment_salon_professional_start' },
      { key: { salonId: 1, status: 1, startTime: 1 }, name: 'idx_appointment_salon_status_start' }
    ]
  },
  {
    collection: 'WaitlistEntry',
    indexes: [{ key: { salonId: 1, status: 1, desiredDate: 1 }, name: 'idx_waitlist_salon_status_date' }]
  },
  {
    collection: 'InventoryProduct',
    indexes: [{ key: { salonId: 1, active: 1 }, name: 'idx_inventory_salon_active' }]
  },
  {
    collection: 'InventoryMovement',
    indexes: [{ key: { salonId: 1, productId: 1, createdAt: -1 }, name: 'idx_inventory_movement_salon_product_created' }]
  },
  {
    collection: 'FinancialEntry',
    indexes: [{ key: { salonId: 1, referenceDate: -1 }, name: 'idx_financial_salon_reference' }]
  },
  {
    collection: 'AuditLog',
    indexes: [{ key: { salonId: 1, createdAt: -1 }, name: 'idx_audit_salon_created' }]
  },
  {
    collection: 'BackupJob',
    indexes: [{ key: { salonId: 1, createdAt: -1 }, name: 'idx_backup_salon_created' }]
  }
];

export async function syncCriticalMongoIndexes(logger: IndexSyncLogger) {
  if (process.env.SYNC_MONGO_INDEXES === 'false') {
    logger.info('Sincronização de índices MongoDB desabilitada por SYNC_MONGO_INDEXES=false.');
    return { ok: true, skipped: true, collections: 0, indexes: 0 };
  }

  let indexes = 0;
  const failures: Array<{ collection: string; message: string }> = [];

  for (const group of criticalMongoIndexes) {
    try {
      await prisma.$runCommandRaw({
        createIndexes: group.collection,
        indexes: group.indexes
      });
      indexes += group.indexes.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ collection: group.collection, message });
      logger.warn(`Falha ao sincronizar índices de ${group.collection}: ${message}`);
    }
  }

  if (!failures.length) {
    logger.info(`Índices MongoDB sincronizados: ${indexes} índices compostos em ${criticalMongoIndexes.length} coleções.`);
  }

  return {
    ok: failures.length === 0,
    skipped: false,
    collections: criticalMongoIndexes.length,
    indexes,
    failures
  };
}

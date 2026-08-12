import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const DAY_MS = 86_400_000;
const WHATSAPP_RESOURCES = ['WhatsAppMessage', 'WhatsAppHandoff', 'WhatsAppPendingAction'];

function positiveDays(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function retentionPolicy(now = new Date()) {
  const sessionDays = positiveDays(process.env.SESSION_RECORD_RETENTION_DAYS, 30);
  const whatsappDays = positiveDays(process.env.WHATSAPP_CONTENT_RETENTION_DAYS, 180);
  const auditDays = positiveDays(process.env.AUDIT_LOG_RETENTION_DAYS, 730);
  const backupDays = positiveDays(process.env.BACKUP_METADATA_RETENTION_DAYS, 180);
  return {
    sessionDays,
    whatsappDays,
    auditDays,
    backupDays,
    sessionCutoff: new Date(now.getTime() - sessionDays * DAY_MS),
    whatsappCutoff: new Date(now.getTime() - whatsappDays * DAY_MS),
    auditCutoff: new Date(now.getTime() - auditDays * DAY_MS),
    backupCutoff: new Date(now.getTime() - backupDays * DAY_MS)
  };
}

export async function previewTenantRetention(salonId: string, now = new Date()) {
  const policy = retentionPolicy(now);
  const [sessions, whatsappContent, auditLogs, backups] = await Promise.all([
    prisma.userSession.count({
      where: {
        salonId,
        OR: [
          { revokedAt: { lt: policy.sessionCutoff } },
          { expiresAt: { lt: policy.sessionCutoff } }
        ]
      }
    }),
    prisma.auditLog.count({
      where: {
        salonId,
        resource: { in: WHATSAPP_RESOURCES },
        createdAt: { lt: policy.whatsappCutoff, gte: policy.auditCutoff }
      }
    }),
    prisma.auditLog.count({ where: { salonId, createdAt: { lt: policy.auditCutoff } } }),
    prisma.backupJob.count({ where: { salonId, createdAt: { lt: policy.backupCutoff } } })
  ]);

  return {
    generatedAt: now.toISOString(),
    policy: {
      sessionDays: policy.sessionDays,
      whatsappContentDays: policy.whatsappDays,
      auditLogDays: policy.auditDays,
      backupMetadataDays: policy.backupDays
    },
    candidates: {
      sessionsToDelete: sessions,
      whatsappEventsToRedact: whatsappContent,
      auditLogsToDelete: auditLogs,
      backupMetadataToDelete: backups
    }
  };
}

export async function runTenantRetention(input: { salonId: string; userId: string; now?: Date }) {
  const now = input.now || new Date();
  const policy = retentionPolicy(now);

  return prisma.$transaction(async (tx) => {
    const oldWhatsappLogs = await tx.auditLog.findMany({
      where: {
        salonId: input.salonId,
        resource: { in: WHATSAPP_RESOURCES },
        createdAt: { lt: policy.whatsappCutoff, gte: policy.auditCutoff }
      },
      select: { id: true, resource: true, metadata: true }
    });

    for (const log of oldWhatsappLogs) {
      const metadata = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
        ? log.metadata as Record<string, unknown>
        : {};
      await tx.auditLog.update({
        where: { id: log.id },
        data: {
          metadata: {
            direction: metadata.direction || '',
            redactedByRetention: true,
            redactedAt: now.toISOString()
          } as Prisma.InputJsonValue
        }
      });
    }

    const sessions = await tx.userSession.deleteMany({
      where: {
        salonId: input.salonId,
        OR: [
          { revokedAt: { lt: policy.sessionCutoff } },
          { expiresAt: { lt: policy.sessionCutoff } }
        ]
      }
    });
    const auditLogs = await tx.auditLog.deleteMany({
      where: { salonId: input.salonId, createdAt: { lt: policy.auditCutoff } }
    });
    const backups = await tx.backupJob.deleteMany({
      where: { salonId: input.salonId, createdAt: { lt: policy.backupCutoff } }
    });

    await tx.auditLog.create({
      data: {
        action: 'DATA_RETENTION_APPLIED',
        resource: 'DataRetention',
        method: 'ADMIN',
        path: '/admin/security/retention/run',
        salonId: input.salonId,
        userId: input.userId,
        metadata: {
          appliedAt: now.toISOString(),
          sessionsDeleted: sessions.count,
          whatsappEventsRedacted: oldWhatsappLogs.length,
          auditLogsDeleted: auditLogs.count,
          backupMetadataDeleted: backups.count,
          policy: {
            sessionDays: policy.sessionDays,
            whatsappContentDays: policy.whatsappDays,
            auditLogDays: policy.auditDays,
            backupMetadataDays: policy.backupDays
          }
        }
      }
    });

    return {
      ok: true as const,
      appliedAt: now.toISOString(),
      sessionsDeleted: sessions.count,
      whatsappEventsRedacted: oldWhatsappLogs.length,
      auditLogsDeleted: auditLogs.count,
      backupMetadataDeleted: backups.count
    };
  });
}

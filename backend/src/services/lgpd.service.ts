import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { normalizePhone } from './whatsapp-agent/contracts';

const SUBJECT_RESOURCES = new Set([
  'WhatsAppMessage',
  'WhatsAppHandoff',
  'WhatsAppPendingAction',
  'RetentionFollowUp',
  'OperationalNotification'
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function subjectFingerprint(salonId: string, clientId: string) {
  return createHash('sha256').update(`${salonId}:${clientId}`).digest('hex').slice(0, 20);
}

function auditTouchesSubject(
  log: { resource: string; resourceId: string | null; metadata: unknown },
  input: { clientId: string; phone: string; appointmentIds: Set<string> }
) {
  if (!SUBJECT_RESOURCES.has(log.resource)) return false;
  const metadata = asRecord(log.metadata);
  const metadataPhone = normalizePhone(String(metadata.phone || ''));
  return log.resourceId === input.clientId
    || Boolean(input.phone && metadataPhone === input.phone)
    || Boolean(input.phone && log.resourceId === input.phone)
    || Boolean(log.resourceId && input.appointmentIds.has(log.resourceId));
}

function exportedAuditEvent(log: {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    metadata: log.metadata,
    createdAt: log.createdAt
  };
}

/**
 * Pacote de acesso do titular. O tenant é sempre parte da chave de busca.
 * Não inclui dados de outros clientes nem credenciais administrativas.
 */
export async function exportClientPersonalData(salonId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, salonId },
    include: {
      appointments: {
        orderBy: { startTime: 'asc' },
        include: {
          service: { select: { id: true, name: true, price: true, durationMin: true } },
          professional: { select: { id: true, name: true } }
        }
      },
      waitlistEntries: { orderBy: { createdAt: 'asc' } },
      loyaltyEntries: { orderBy: { createdAt: 'asc' } },
      consents: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!client) return null;

  const phone = normalizePhone(client.phone);
  const appointmentIds = new Set<string>(client.appointments.map((item) => item.id));
  const auditLogs = await prisma.auditLog.findMany({
    where: { salonId, resource: { in: [...SUBJECT_RESOURCES] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      metadata: true,
      createdAt: true
    }
  });

  const subjectEvents = auditLogs
    .filter((log) => auditTouchesSubject(log, { clientId, phone, appointmentIds }))
    .map(exportedAuditEvent);

  return {
    generatedAt: new Date().toISOString(),
    salonId,
    subject: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      birthDate: client.birthDate,
      notes: client.notes,
      preferences: client.preferences,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt
    },
    appointments: client.appointments,
    waitlistEntries: client.waitlistEntries,
    loyaltyEntries: client.loyaltyEntries,
    consents: client.consents,
    processingEvents: subjectEvents
  };
}

function redactedMetadata(resource: string, value: unknown, erasedAt: string) {
  const metadata = asRecord(value);
  if (resource === 'WhatsAppMessage') {
    return {
      direction: metadata.direction || '',
      redacted: true,
      erasedAt
    } as Prisma.InputJsonValue;
  }
  if (resource === 'OperationalNotification') {
    return {
      type: metadata.type || '',
      severity: metadata.severity || '',
      redacted: true,
      erasedAt
    } as Prisma.InputJsonValue;
  }
  return { redacted: true, erasedAt } as Prisma.InputJsonValue;
}

/**
 * Eliminação LGPD operacional:
 * - apaga perfil, fila, fidelidade e consentimentos;
 * - preserva atendimento histórico sem PII;
 * - redige conversas/handoffs/notificações relacionadas;
 * - mantém uma trilha de auditoria anônima da própria eliminação.
 */
export async function eraseClientPersonalData(input: {
  salonId: string;
  clientId: string;
  requestedByUserId: string;
  reason: string;
}) {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, salonId: input.salonId },
    include: { appointments: { select: { id: true } } }
  });
  if (!client) return null;

  const phone = normalizePhone(client.phone);
  const appointmentIds = new Set<string>(client.appointments.map((item) => item.id));
  const fingerprint = subjectFingerprint(input.salonId, input.clientId);
  const erasedAt = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const auditCandidates = await tx.auditLog.findMany({
      where: { salonId: input.salonId, resource: { in: [...SUBJECT_RESOURCES] } },
      select: { id: true, resource: true, resourceId: true, metadata: true }
    });
    const affectedAuditLogs = auditCandidates.filter((log) =>
      auditTouchesSubject(log, { clientId: input.clientId, phone, appointmentIds })
    );

    for (const log of affectedAuditLogs) {
      await tx.auditLog.update({
        where: { id: log.id },
        data: {
          resourceId: `anon:${fingerprint}`,
          metadata: redactedMetadata(log.resource, log.metadata, erasedAt)
        }
      });
    }

    const appointments = await tx.appointment.updateMany({
      where: { salonId: input.salonId, clientId: input.clientId },
      data: {
        clientId: null,
        clientName: 'Titular removido',
        clientPhone: '',
        clientEmail: null,
        notes: ''
      }
    });
    const waitlist = await tx.waitlistEntry.deleteMany({
      where: { salonId: input.salonId, clientId: input.clientId }
    });
    const loyalty = await tx.loyaltyEntry.deleteMany({
      where: { salonId: input.salonId, clientId: input.clientId }
    });
    const consents = await tx.lgpdConsent.deleteMany({
      where: { salonId: input.salonId, clientId: input.clientId }
    });
    const deleted = await tx.client.deleteMany({
      where: { salonId: input.salonId, id: input.clientId }
    });

    if (deleted.count !== 1) {
      throw new Error('O perfil do titular não pôde ser eliminado de forma atômica.');
    }

    await tx.auditLog.create({
      data: {
        action: 'LGPD_SUBJECT_ERASED',
        resource: 'LgpdSubject',
        resourceId: `anon:${fingerprint}`,
        method: 'ADMIN',
        path: '/admin/security/lgpd/erase',
        salonId: input.salonId,
        userId: input.requestedByUserId,
        metadata: {
          erasedAt,
          reason: input.reason.slice(0, 500),
          appointmentsAnonymized: appointments.count,
          waitlistDeleted: waitlist.count,
          loyaltyDeleted: loyalty.count,
          consentsDeleted: consents.count,
          auditEventsRedacted: affectedAuditLogs.length
        }
      }
    });

    return {
      ok: true as const,
      erasedAt,
      fingerprint,
      appointmentsAnonymized: appointments.count,
      waitlistDeleted: waitlist.count,
      loyaltyDeleted: loyalty.count,
      consentsDeleted: consents.count,
      auditEventsRedacted: affectedAuditLogs.length
    };
  });
}

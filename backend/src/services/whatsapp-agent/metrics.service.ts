import { prisma } from '../../lib/prisma';
import { normalizePhone } from './contracts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

type ContactState = {
  inbound: number;
  outbound: number;
  handoffOpened: number;
};

function contactState(map: Map<string, ContactState>, phone: string) {
  const normalized = normalizePhone(phone);
  const current = map.get(normalized) || { inbound: 0, outbound: 0, handoffOpened: 0 };
  map.set(normalized, current);
  return current;
}

export async function getWhatsAppOperationalMetrics(salonId: string, days = 30) {
  const safeDays = Math.max(1, Math.min(Number(days) || 30, 90));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: { salonId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: { action: true, resource: true, resourceId: true, metadata: true, createdAt: true }
  });

  const contacts = new Map<string, ContactState>();
  const counters = {
    messagesIn: 0,
    messagesOut: 0,
    providerFailures: 0,
    handoffsOpened: 0,
    handoffsClosed: 0,
    actionsProposed: 0,
    actionsCompleted: 0,
    actionsCanceled: 0,
    actionsFailed: 0,
    actionsExpired: 0
  };

  for (const log of logs) {
    const metadata = asRecord(log.metadata);
    const metadataPhone = normalizePhone(String(metadata.phone || ''));
    const resourcePhone = normalizePhone(String(log.resourceId || ''));
    const phone = metadataPhone || resourcePhone;

    if (log.resource === 'WhatsAppMessage') {
      if (log.action === 'WHATSAPP_RECEIVED') {
        counters.messagesIn += 1;
        if (phone) contactState(contacts, phone).inbound += 1;
      } else if (log.action === 'WHATSAPP_SENT') {
        counters.messagesOut += 1;
        if (phone) contactState(contacts, phone).outbound += 1;
      }
    }

    if (log.action === 'WHATSAPP_PROVIDER_FAILED') counters.providerFailures += 1;
    if (log.action === 'HANDOFF_OPEN') {
      counters.handoffsOpened += 1;
      if (phone) contactState(contacts, phone).handoffOpened += 1;
    }
    if (log.action === 'HANDOFF_CLOSED') counters.handoffsClosed += 1;
    if (log.action === 'WHATSAPP_ACTION_PENDING') counters.actionsProposed += 1;
    if (log.action === 'WHATSAPP_ACTION_COMPLETED') counters.actionsCompleted += 1;
    if (log.action === 'WHATSAPP_ACTION_CANCELED') counters.actionsCanceled += 1;
    if (log.action === 'WHATSAPP_ACTION_FAILED') counters.actionsFailed += 1;
    if (log.action === 'WHATSAPP_ACTION_EXPIRED') counters.actionsExpired += 1;
  }

  const inboundContacts = [...contacts.values()].filter((item) => item.inbound > 0);
  const automaticallyResolved = inboundContacts.filter((item) => item.outbound > 0 && item.handoffOpened === 0).length;
  const automaticResolutionRate = inboundContacts.length
    ? Number(((automaticallyResolved / inboundContacts.length) * 100).toFixed(1))
    : 0;
  const providerAttempts = counters.messagesOut + counters.providerFailures;
  const providerSuccessRate = providerAttempts
    ? Number(((counters.messagesOut / providerAttempts) * 100).toFixed(1))
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    periodDays: safeDays,
    uniqueInboundContacts: inboundContacts.length,
    automaticallyResolvedContacts: automaticallyResolved,
    automaticResolutionRate,
    providerSuccessRate,
    ...counters
  };
}

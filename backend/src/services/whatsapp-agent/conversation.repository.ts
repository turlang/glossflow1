import { prisma } from '../../lib/prisma';
import { AgentSalon, ConversationMessage, normalizePhone } from './contracts';

export async function findSalonByWhatsApp(displayPhoneNumber: string): Promise<AgentSalon | null> {
  const target = normalizePhone(displayPhoneNumber);
  if (!target) return null;
  const salons = await prisma.salon.findMany({ select: { id: true, name: true, description: true, whatsapp: true, openingHours: true, address: true, phone: true, instagram: true } });
  return salons.find((salon) => normalizePhone(salon.whatsapp) === target) || null;
}

export async function isDuplicateWhatsAppMessage(messageId: string) {
  if (!messageId) return false;
  const existing = await prisma.auditLog.findFirst({ where: { resource: 'WhatsAppMessage', resourceId: messageId }, select: { id: true } });
  return Boolean(existing);
}

export async function saveWhatsAppMessage(input: { salonId: string; providerMessageId?: string; phone: string; direction: 'IN' | 'OUT'; text: string }) {
  return prisma.auditLog.create({
    data: {
      action: input.direction === 'IN' ? 'WHATSAPP_RECEIVED' : 'WHATSAPP_SENT',
      resource: 'WhatsAppMessage',
      resourceId: input.providerMessageId || undefined,
      method: input.direction === 'IN' ? 'WEBHOOK' : 'OUTBOUND',
      path: '/webhooks/whatsapp',
      salonId: input.salonId,
      metadata: { phone: normalizePhone(input.phone), direction: input.direction, text: input.text.slice(0, 4000) }
    }
  });
}

export async function conversationHistory(salonId: string, phone: string): Promise<ConversationMessage[]> {
  const normalized = normalizePhone(phone);
  const logs = await prisma.auditLog.findMany({ where: { salonId, resource: 'WhatsAppMessage' }, orderBy: { createdAt: 'desc' }, take: 60, select: { metadata: true } });
  return logs
    .map((log) => log.metadata as Record<string, unknown> | null)
    .filter((metadata): metadata is Record<string, unknown> => Boolean(metadata && normalizePhone(String(metadata.phone || '')) === normalized))
    .map((metadata) => ({ direction: metadata.direction === 'OUT' ? 'OUT' as const : 'IN' as const, text: String(metadata.text || '') }))
    .filter((item) => item.text)
    .reverse()
    .slice(-12);
}

export async function hasOpenHumanHandoff(salonId: string, phone: string) {
  const last = await prisma.auditLog.findFirst({ where: { salonId, resource: 'WhatsAppHandoff', resourceId: normalizePhone(phone) }, orderBy: { createdAt: 'desc' }, select: { action: true } });
  return last?.action === 'HANDOFF_OPEN';
}

export async function openHumanHandoff(salonId: string, phone: string, reason: string) {
  let context: ConversationMessage[] = [];
  try {
    context = (await conversationHistory(salonId, phone)).slice(-6);
  } catch {
    // Falha ao montar contexto não pode impedir o encaminhamento humano.
  }

  return prisma.auditLog.create({
    data: {
      action: 'HANDOFF_OPEN',
      resource: 'WhatsAppHandoff',
      resourceId: normalizePhone(phone),
      method: 'AGENT',
      path: '/webhooks/whatsapp',
      salonId,
      metadata: {
        phone: normalizePhone(phone),
        reason: reason.slice(0, 500),
        context: context.map((item) => ({ direction: item.direction, text: item.text.slice(0, 1000) }))
      }
    }
  });
}

export async function closeHumanHandoff(salonId: string, phone: string) {
  return prisma.auditLog.create({
    data: { action: 'HANDOFF_CLOSED', resource: 'WhatsAppHandoff', resourceId: normalizePhone(phone), method: 'ADMIN', path: '/admin/whatsapp/handoffs', salonId, metadata: { phone: normalizePhone(phone) } }
  });
}

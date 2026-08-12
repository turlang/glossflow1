import { prisma } from '../../lib/prisma';
import { normalizePhone, ToolArgs } from './contracts';

export type PendingWhatsAppActionType = 'CREATE_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT';

export type PendingWhatsAppAction = {
  id: string;
  salonId: string;
  phone: string;
  type: PendingWhatsAppActionType;
  payload: ToolArgs;
  summary: string;
  expiresAt: Date;
};

type AuditMetadata = Record<string, unknown>;

function asRecord(value: unknown): AuditMetadata {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AuditMetadata
    : {};
}

function ttlMinutes() {
  const configured = Number(process.env.WHATSAPP_ACTION_CONFIRMATION_TTL_MINUTES || 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60) : 10;
}

function normalizeDecisionText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Confirmação é deliberadamente conservadora: uma ação pendente só é executada
 * quando a mensagem inteira representa uma confirmação curta e inequívoca.
 */
export function confirmationDecision(text: string): 'CONFIRM' | 'CANCEL' | 'UNKNOWN' {
  const value = normalizeDecisionText(text);
  if (!value) return 'UNKNOWN';

  const positive = new Set([
    'confirmo',
    'confirmar',
    'confirmado',
    'sim',
    'sim pode',
    'pode sim',
    'ok',
    'pode agendar',
    'pode cancelar',
    'pode reagendar',
    'sim pode agendar',
    'sim pode cancelar',
    'sim pode reagendar'
  ]);
  if (positive.has(value)) return 'CONFIRM';

  const negative = new Set([
    'cancelar operacao',
    'cancelar acao',
    'nao',
    'nao confirmo',
    'nao quero',
    'desistir',
    'desisto'
  ]);
  if (negative.has(value)) return 'CANCEL';

  return 'UNKNOWN';
}

export async function createPendingAction(input: {
  salonId: string;
  phone: string;
  type: PendingWhatsAppActionType;
  payload: ToolArgs;
  summary: string;
}) {
  const phone = normalizePhone(input.phone);
  const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000);
  const event = await prisma.auditLog.create({
    data: {
      action: 'WHATSAPP_ACTION_PENDING',
      resource: 'WhatsAppPendingAction',
      resourceId: phone,
      method: 'AGENT',
      path: '/webhooks/whatsapp',
      salonId: input.salonId,
      metadata: {
        type: input.type,
        payload: input.payload,
        summary: input.summary.slice(0, 1000),
        expiresAt: expiresAt.toISOString()
      }
    }
  });

  return {
    id: event.id,
    salonId: input.salonId,
    phone,
    type: input.type,
    payload: input.payload,
    summary: input.summary,
    expiresAt
  } satisfies PendingWhatsAppAction;
}

export async function pendingActionForPhone(salonId: string, phoneValue: string): Promise<PendingWhatsAppAction | null> {
  const phone = normalizePhone(phoneValue);
  const event = await prisma.auditLog.findFirst({
    where: { salonId, resource: 'WhatsAppPendingAction', resourceId: phone },
    orderBy: { createdAt: 'desc' },
    select: { id: true, action: true, metadata: true }
  });
  if (!event || event.action !== 'WHATSAPP_ACTION_PENDING') return null;

  const metadata = asRecord(event.metadata);
  const type = String(metadata.type || '') as PendingWhatsAppActionType;
  if (!['CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT'].includes(type)) return null;

  const expiresAt = new Date(String(metadata.expiresAt || ''));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await recordPendingActionState({ salonId, phone, pendingActionId: event.id, type, summary: String(metadata.summary || ''), state: 'EXPIRED' });
    return null;
  }

  return {
    id: event.id,
    salonId,
    phone,
    type,
    payload: asRecord(metadata.payload),
    summary: String(metadata.summary || 'Ação solicitada pelo cliente.'),
    expiresAt
  };
}

export async function recordPendingActionState(input: {
  salonId: string;
  phone: string;
  pendingActionId: string;
  type: PendingWhatsAppActionType;
  summary: string;
  state: 'COMPLETED' | 'CANCELED' | 'FAILED' | 'EXPIRED';
  result?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      action: `WHATSAPP_ACTION_${input.state}`,
      resource: 'WhatsAppPendingAction',
      resourceId: normalizePhone(input.phone),
      method: 'AGENT',
      path: '/webhooks/whatsapp',
      salonId: input.salonId,
      metadata: {
        pendingActionId: input.pendingActionId,
        type: input.type,
        summary: input.summary.slice(0, 1000),
        ...(input.result === undefined ? {} : { result: input.result })
      }
    }
  });
}

export function pendingActionPrompt(action: PendingWhatsAppAction) {
  return `${action.summary}\n\nPara executar, responda apenas CONFIRMAR. Para desistir, responda CANCELAR AÇÃO.`;
}

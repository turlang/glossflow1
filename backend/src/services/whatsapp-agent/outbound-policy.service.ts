import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from '../whatsapp.service';
import { saveWhatsAppMessage } from './conversation.repository';
import { normalizePhone } from './contracts';

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function providerMessageId(result: unknown) {
  const data = asRecord(result);
  const nested = asRecord(data.data);
  const messages = Array.isArray(nested.messages) ? nested.messages : [];
  const first = asRecord(messages[0]);
  return String(data.messageId || first.id || nested.sid || '').trim() || undefined;
}

function envKeyForEvent(event: string) {
  return `WHATSAPP_TEMPLATE_${String(event || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

export function configuredProviderTemplate(event: string) {
  return String(process.env[envKeyForEvent(event)] || '').trim();
}

export async function lastInboundAt(salonId: string, phoneValue: string) {
  const phone = normalizePhone(phoneValue);
  const logs = await prisma.auditLog.findMany({
    where: { salonId, resource: 'WhatsAppMessage', action: 'WHATSAPP_RECEIVED' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { metadata: true, createdAt: true }
  });
  const match = logs.find((log) => normalizePhone(String(asRecord(log.metadata).phone || '')) === phone);
  return match?.createdAt || null;
}

export async function customerServiceWindow(salonId: string, phone: string, now = new Date()) {
  const lastInbound = await lastInboundAt(salonId, phone);
  const open = Boolean(lastInbound && now.getTime() - lastInbound.getTime() <= CUSTOMER_SERVICE_WINDOW_MS);
  return {
    open,
    lastInboundAt: lastInbound?.toISOString() || null,
    closesAt: lastInbound ? new Date(lastInbound.getTime() + CUSTOMER_SERVICE_WINDOW_MS).toISOString() : null
  };
}

async function recordPolicyEvent(input: {
  salonId: string;
  phone: string;
  action: 'WHATSAPP_POLICY_SENT' | 'WHATSAPP_PROVIDER_FAILED';
  event: string;
  mode: 'FREE_FORM' | 'TEMPLATE';
  result: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      resource: 'WhatsAppOutbound',
      resourceId: normalizePhone(input.phone),
      method: 'OUTBOUND',
      path: '/admin/whatsapp/send',
      salonId: input.salonId,
      metadata: {
        event: input.event,
        mode: input.mode,
        result: jsonValue(input.result)
      }
    }
  });
}

/**
 * Política central para mensagens iniciadas pelo salão. Texto livre só é usado
 * quando há uma janela de atendimento aberta; fora dela, o servidor exige um
 * identificador de template configurado e deixa o provider validar aprovação.
 */
export async function sendPolicyCompliantWhatsApp(input: {
  salonId: string;
  phone: string;
  message: string;
  event: string;
  templateName?: string;
  bodyParameters?: Array<string | number>;
  now?: Date;
  dryRun?: boolean;
}) {
  const phone = normalizePhone(input.phone);
  const window = await customerServiceWindow(input.salonId, phone, input.now || new Date());
  const templateName = String(input.templateName || configuredProviderTemplate(input.event)).trim();
  const mode = window.open ? 'FREE_FORM' as const : 'TEMPLATE' as const;

  if (!window.open && !templateName) {
    return {
      ok: false as const,
      code: 'PROVIDER_TEMPLATE_REQUIRED' as const,
      message: 'A janela de atendimento está fechada. Configure um template oficial do provider para este evento antes do envio.',
      window,
      mode
    };
  }

  const result = window.open
    ? await sendWhatsAppMessage({ to: phone, message: input.message, dryRun: input.dryRun })
    : await sendWhatsAppTemplateMessage({
        to: phone,
        templateName,
        bodyParameters: input.bodyParameters || [],
        dryRun: input.dryRun
      });

  if (!result.ok) {
    await recordPolicyEvent({ salonId: input.salonId, phone, action: 'WHATSAPP_PROVIDER_FAILED', event: input.event, mode, result });
    return { ...result, ok: false as const, window, mode };
  }

  await saveWhatsAppMessage({
    salonId: input.salonId,
    providerMessageId: providerMessageId(result),
    phone,
    direction: 'OUT',
    text: mode === 'FREE_FORM' ? input.message : `[template:${templateName}] ${input.message}`
  });
  await recordPolicyEvent({ salonId: input.salonId, phone, action: 'WHATSAPP_POLICY_SENT', event: input.event, mode, result });

  return { ...result, ok: true as const, window, mode, templateName: mode === 'TEMPLATE' ? templateName : null };
}

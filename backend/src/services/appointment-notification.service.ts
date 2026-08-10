import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma';
import { normalizePhone, saveWhatsAppMessage } from './whatsapp-agent.service';
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from './whatsapp.service';

const MANAGEMENT_RESOURCE = 'AppointmentManageToken';
const NOTIFICATION_RESOURCE = 'OperationalNotification';
const NOTIFICATION_READ_RESOURCE = 'NotificationRead';

function businessTimeZone() {
  return process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';
}

export function cancellationMinHours() {
  const value = Number(process.env.CLIENT_CANCELLATION_MIN_HOURS || 12);
  return Number.isFinite(value) && value >= 0 ? value : 12;
}

export function formatAppointmentDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: businessTimeZone(),
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function managementBaseUrl(salon: { slug?: string | null; customDomain?: string | null }) {
  if (salon.customDomain) return `https://${salon.customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return String(process.env.APP_PUBLIC_URL || process.env.FRONTEND_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
}

export async function createAppointmentManagementAccess(input: {
  salonId: string;
  salonSlug?: string | null;
  customDomain?: string | null;
  appointmentId: string;
}) {
  const token = randomBytes(32).toString('hex');
  await prisma.auditLog.create({
    data: {
      action: 'MANAGEMENT_TOKEN_CREATED',
      resource: MANAGEMENT_RESOURCE,
      resourceId: input.appointmentId,
      method: 'SYSTEM',
      path: '/appointments',
      salonId: input.salonId,
      metadata: { tokenHash: hashToken(token) }
    }
  });

  const base = managementBaseUrl({ slug: input.salonSlug, customDomain: input.customDomain });
  const query = new URLSearchParams({
    action: 'manage-booking',
    appointment: input.appointmentId,
    token,
    ...(input.salonSlug ? { salon: input.salonSlug } : {})
  }).toString();

  return {
    token,
    url: base ? `${base}/?${query}` : `/?${query}`
  };
}

export async function validateAppointmentManagementAccess(input: {
  salonId: string;
  appointmentId: string;
  token: string;
}) {
  if (!input.token || input.token.length < 32) return false;
  const record = await prisma.auditLog.findFirst({
    where: {
      salonId: input.salonId,
      resource: MANAGEMENT_RESOURCE,
      resourceId: input.appointmentId,
      action: 'MANAGEMENT_TOKEN_CREATED'
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });
  const metadata = record?.metadata as Record<string, unknown> | null;
  const expected = String(metadata?.tokenHash || '');
  const received = hashToken(input.token);
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function createOperationalNotification(input: {
  salonId: string;
  type: 'APPOINTMENT_CREATED' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_RESCHEDULED' | 'WHATSAPP_DELIVERY_FAILED' | 'WAITLIST_ACTION_REQUIRED';
  title: string;
  message: string;
  appointmentId?: string;
  professionalId?: string;
  clientName?: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
}) {
  return prisma.auditLog.create({
    data: {
      action: 'NOTIFICATION_CREATED',
      resource: NOTIFICATION_RESOURCE,
      resourceId: input.appointmentId,
      method: 'SYSTEM',
      path: '/admin/appointments/notifications',
      salonId: input.salonId,
      metadata: {
        type: input.type,
        title: input.title,
        message: input.message,
        professionalId: input.professionalId || '',
        clientName: input.clientName || '',
        severity: input.severity || 'INFO'
      }
    }
  });
}

export async function listOperationalNotifications(input: { salonId: string; userId: string; limit?: number }) {
  const notifications = await prisma.auditLog.findMany({
    where: { salonId: input.salonId, resource: NOTIFICATION_RESOURCE, action: 'NOTIFICATION_CREATED' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(input.limit || 40, 1), 100),
    select: { id: true, resourceId: true, metadata: true, createdAt: true }
  });

  const ids = notifications.map((item) => item.id);
  const reads = ids.length ? await prisma.auditLog.findMany({
    where: {
      salonId: input.salonId,
      resource: NOTIFICATION_READ_RESOURCE,
      resourceId: { in: ids },
      userId: input.userId
    },
    select: { resourceId: true }
  }) : [];
  const readIds = new Set(reads.map((item) => item.resourceId).filter(Boolean));

  return notifications.map((item) => {
    const metadata = (item.metadata || {}) as Record<string, unknown>;
    return {
      id: item.id,
      appointmentId: item.resourceId || null,
      type: String(metadata.type || 'INFO'),
      title: String(metadata.title || 'Notificação'),
      message: String(metadata.message || ''),
      professionalId: String(metadata.professionalId || ''),
      clientName: String(metadata.clientName || ''),
      severity: String(metadata.severity || 'INFO'),
      createdAt: item.createdAt,
      read: readIds.has(item.id)
    };
  });
}

export async function markOperationalNotificationRead(input: { salonId: string; userId: string; notificationId: string }) {
  const notification = await prisma.auditLog.findFirst({
    where: { id: input.notificationId, salonId: input.salonId, resource: NOTIFICATION_RESOURCE },
    select: { id: true }
  });
  if (!notification) return false;

  const existing = await prisma.auditLog.findFirst({
    where: {
      salonId: input.salonId,
      resource: NOTIFICATION_READ_RESOURCE,
      resourceId: input.notificationId,
      userId: input.userId
    },
    select: { id: true }
  });
  if (existing) return true;

  await prisma.auditLog.create({
    data: {
      action: 'NOTIFICATION_READ',
      resource: NOTIFICATION_READ_RESOURCE,
      resourceId: input.notificationId,
      method: 'USER',
      path: '/admin/appointments/notifications',
      salonId: input.salonId,
      userId: input.userId
    }
  });
  return true;
}

export async function markAllOperationalNotificationsRead(input: { salonId: string; userId: string }) {
  const notifications = await prisma.auditLog.findMany({
    where: { salonId: input.salonId, resource: NOTIFICATION_RESOURCE, action: 'NOTIFICATION_CREATED' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true }
  });
  const existing = await prisma.auditLog.findMany({
    where: {
      salonId: input.salonId,
      resource: NOTIFICATION_READ_RESOURCE,
      userId: input.userId,
      resourceId: { in: notifications.map((item) => item.id) }
    },
    select: { resourceId: true }
  });
  const existingIds = new Set(existing.map((item) => item.resourceId).filter(Boolean));
  const missing = notifications.filter((item) => !existingIds.has(item.id));
  if (missing.length) {
    await Promise.all(missing.map((item) => prisma.auditLog.create({
      data: {
        action: 'NOTIFICATION_READ',
        resource: NOTIFICATION_READ_RESOURCE,
        resourceId: item.id,
        method: 'USER',
        path: '/admin/appointments/notifications/read-all',
        salonId: input.salonId,
        userId: input.userId
      }
    })));
  }
  return { marked: missing.length };
}

function twilioTrialContentSid() {
  const isTwilioTrial = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase() === 'twilio'
    && process.env.TWILIO_TRIAL_MODE === 'true';
  return isTwilioTrial ? String(process.env.TWILIO_TRIAL_CONTENT_SID || '').trim() : '';
}

async function registerWhatsAppDelivery(input: {
  salonId: string;
  clientPhone: string;
  message: string;
  appointmentId: string;
  contextTitle: string;
  templateName?: string;
  templateParameters?: Array<string | number>;
}) {
  const effectiveTemplateName = input.templateName || twilioTrialContentSid() || undefined;
  const result = effectiveTemplateName
    ? await sendWhatsAppTemplateMessage({
        phone: input.clientPhone,
        templateName: effectiveTemplateName,
        bodyParameters: input.templateParameters || []
      })
    : await sendWhatsAppMessage({ phone: input.clientPhone, message: input.message });

  const providerData = result as { messageId?: string; data?: { messages?: Array<{ id?: string }>; sid?: string } };
  if (result.ok) {
    await saveWhatsAppMessage({
      salonId: input.salonId,
      providerMessageId: providerData.messageId || providerData.data?.messages?.[0]?.id || providerData.data?.sid,
      phone: input.clientPhone,
      direction: 'OUT',
      text: input.message
    });
    return { ok: true as const, provider: result.provider || 'whatsapp' };
  }

  const detail = result as Record<string, unknown>;
  const providerReason = String(detail.errorMessage || detail.message || detail.code || '').trim();
  await createOperationalNotification({
    salonId: input.salonId,
    type: 'WHATSAPP_DELIVERY_FAILED',
    title: 'Falha ao enviar WhatsApp',
    message: `${input.contextTitle}. O agendamento continua válido, mas a mensagem automática para o cliente não foi entregue.${providerReason ? ` Provider: ${providerReason}` : ''}`,
    appointmentId: input.appointmentId,
    severity: 'WARNING'
  });
  return { ok: false as const, provider: result.provider || 'whatsapp', detail: result };
}

export async function notifyAppointmentCreated(input: {
  salonId: string;
  salonName: string;
  clientName: string;
  clientPhone: string;
  appointmentId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startTime: Date;
  managementUrl: string;
}) {
  const when = formatAppointmentDate(input.startTime);
  await createOperationalNotification({
    salonId: input.salonId,
    type: 'APPOINTMENT_CREATED',
    title: 'Novo agendamento',
    message: `${input.clientName} agendou ${input.serviceName} para ${when} com ${input.professionalName}.`,
    appointmentId: input.appointmentId,
    professionalId: input.professionalId,
    clientName: input.clientName,
    severity: 'SUCCESS'
  });

  const hours = cancellationMinHours();
  const message = `Agendamento confirmado ✅\n\n${input.serviceName}\n📅 ${when}\nProfissional: ${input.professionalName}\n\nCancelamentos pelo cliente são permitidos com no mínimo ${hours} horas de antecedência.\nGerenciar ou cancelar: ${input.managementUrl}\n\n${input.salonName}`;
  return registerWhatsAppDelivery({
    salonId: input.salonId,
    clientPhone: normalizePhone(input.clientPhone),
    message,
    appointmentId: input.appointmentId,
    contextTitle: `Confirmação de ${input.clientName}`,
    templateName: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMED || undefined,
    templateParameters: [
      input.clientName,
      input.serviceName,
      when,
      input.professionalName,
      hours,
      input.managementUrl,
      input.salonName
    ]
  });
}

export async function notifyAppointmentCancelled(input: {
  salonId: string;
  salonName: string;
  clientName: string;
  clientPhone: string;
  appointmentId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startTime: Date;
  cancelledBy: 'CLIENT' | 'TEAM';
}) {
  const when = formatAppointmentDate(input.startTime);
  await createOperationalNotification({
    salonId: input.salonId,
    type: 'APPOINTMENT_CANCELLED',
    title: input.cancelledBy === 'CLIENT' ? 'Cliente cancelou um horário' : 'Agendamento cancelado',
    message: `${input.clientName} · ${input.serviceName} · ${when} com ${input.professionalName}.`,
    appointmentId: input.appointmentId,
    professionalId: input.professionalId,
    clientName: input.clientName,
    severity: 'WARNING'
  });

  const message = `Cancelamento confirmado ✅\n\n${input.serviceName}\n📅 ${when}\nProfissional: ${input.professionalName}\n\nO horário foi liberado na agenda do ${input.salonName}.`;
  return registerWhatsAppDelivery({
    salonId: input.salonId,
    clientPhone: normalizePhone(input.clientPhone),
    message,
    appointmentId: input.appointmentId,
    contextTitle: `Confirmação de cancelamento de ${input.clientName}`,
    templateName: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CANCELLED || undefined,
    templateParameters: [
      input.clientName,
      input.serviceName,
      when,
      input.professionalName,
      input.salonName
    ]
  });
}

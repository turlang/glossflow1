import { prisma } from '../lib/prisma';
import { createOperationalNotification, cancellationMinHours, formatAppointmentDate } from './appointment-notification.service';
import { hasSalonModule } from './module-access.service';
import { normalizePhone, saveWhatsAppMessage } from './whatsapp-agent.service';
import { sendWhatsAppMessage } from './whatsapp.service';

const REMINDER_RESOURCE = 'AppointmentReminder';
const CONFIRMATION_RESOURCE = 'AppointmentClientConfirmation';
const HOUR_MS = 60 * 60_000;

type ReminderKind = '24H' | '2H';

function reminderAction(kind: ReminderKind) {
  return `REMINDER_${kind}_SENT`;
}

async function alreadySent(appointmentId: string, salonId: string, kind: ReminderKind) {
  const record = await prisma.auditLog.findFirst({
    where: {
      salonId,
      resource: REMINDER_RESOURCE,
      resourceId: appointmentId,
      action: reminderAction(kind)
    },
    select: { id: true }
  });
  return Boolean(record);
}

async function recentFailedAttempt(appointmentId: string, salonId: string, kind: ReminderKind) {
  const since = new Date(Date.now() - 30 * 60_000);
  const record = await prisma.auditLog.findFirst({
    where: {
      salonId,
      resource: REMINDER_RESOURCE,
      resourceId: appointmentId,
      action: `REMINDER_${kind}_FAILED`,
      createdAt: { gte: since }
    },
    select: { id: true }
  });
  return Boolean(record);
}

async function registerAttempt(input: {
  appointmentId: string;
  salonId: string;
  kind: ReminderKind;
  clientPhone: string;
  ok: boolean;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.ok ? reminderAction(input.kind) : `REMINDER_${input.kind}_FAILED`,
      resource: REMINDER_RESOURCE,
      resourceId: input.appointmentId,
      method: 'SYSTEM',
      path: '/system/appointment-reminders',
      salonId: input.salonId,
      metadata: { kind: input.kind, clientPhone: normalizePhone(input.clientPhone) }
    }
  });
}

async function deliverReminder(input: {
  salonId: string;
  salonName: string;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  professionalName: string;
  startTime: Date;
  kind: ReminderKind;
}) {
  if (await alreadySent(input.appointmentId, input.salonId, input.kind)) return { skipped: true, ok: true };
  if (await recentFailedAttempt(input.appointmentId, input.salonId, input.kind)) return { skipped: true, ok: false };

  const when = formatAppointmentDate(input.startTime);
  const minHours = cancellationMinHours();
  const message = input.kind === '24H'
    ? `Lembrete de agendamento ✨\n\nOlá, ${input.clientName}! Seu horário no ${input.salonName} está reservado:\n${input.serviceName}\n📅 ${when}\nProfissional: ${input.professionalName}\n\nResponda CONFIRMAR para confirmar sua presença ou CANCELAR para cancelar. Cancelamentos online são permitidos com no mínimo ${minHours} horas de antecedência.`
    : `Seu horário está chegando ⏰\n\n${input.serviceName}\n📅 ${when}\nProfissional: ${input.professionalName}\n\nSe precisar de ajuda, fale com o ${input.salonName}.`;

  const result = await sendWhatsAppMessage({ phone: normalizePhone(input.clientPhone), message });
  const providerData = result as { data?: { messages?: Array<{ id?: string }> } };
  if (result.ok) {
    await saveWhatsAppMessage({
      salonId: input.salonId,
      providerMessageId: providerData.data?.messages?.[0]?.id,
      phone: input.clientPhone,
      direction: 'OUT',
      text: message
    });
  } else if (!await recentFailedAttempt(input.appointmentId, input.salonId, input.kind)) {
    await createOperationalNotification({
      salonId: input.salonId,
      type: 'WHATSAPP_DELIVERY_FAILED',
      title: 'Lembrete não entregue',
      message: `Não consegui entregar o lembrete de ${input.clientName} para ${when}. O agendamento continua confirmado.`,
      appointmentId: input.appointmentId,
      clientName: input.clientName,
      severity: 'WARNING'
    });
  }

  await registerAttempt({
    appointmentId: input.appointmentId,
    salonId: input.salonId,
    kind: input.kind,
    clientPhone: input.clientPhone,
    ok: result.ok
  });

  return { skipped: false, ok: result.ok };
}

/**
 * Varredura idempotente dos próximos horários.
 * - lembrete principal: entre 25h e 12h antes (preserva a política de cancelamento);
 * - lembrete curto: entre 2h30 e 1h30 antes.
 */
export async function scanAppointmentReminders() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 25 * HOUR_MS);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      startTime: { gt: now, lte: horizon }
    },
    include: {
      salon: { select: { id: true, name: true, modulesConfigured: true, enabledModules: true } },
      service: { select: { name: true } },
      professional: { select: { name: true } }
    },
    orderBy: { startTime: 'asc' }
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const appointment of appointments) {
    if (!hasSalonModule(appointment.salon, 'AGENDA') || !hasSalonModule(appointment.salon, 'WHATSAPP')) continue;
    const hoursUntil = (appointment.startTime.getTime() - now.getTime()) / HOUR_MS;
    const kind: ReminderKind | null = hoursUntil >= 12 && hoursUntil <= 25
      ? '24H'
      : hoursUntil >= 1.5 && hoursUntil <= 2.5
        ? '2H'
        : null;
    if (!kind) continue;

    const result = await deliverReminder({
      salonId: appointment.salonId,
      salonName: appointment.salon.name,
      appointmentId: appointment.id,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      serviceName: appointment.service.name,
      professionalName: appointment.professional.name,
      startTime: appointment.startTime,
      kind
    });
    if (result.skipped) skipped += 1;
    else if (result.ok) sent += 1;
    else failed += 1;
  }

  return { checked: appointments.length, sent, failed, skipped };
}

function normalizedReply(value: string) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function latestReminderForPhone(salonId: string, clientPhone: string) {
  const since = new Date(Date.now() - 36 * HOUR_MS);
  const records = await prisma.auditLog.findMany({
    where: {
      salonId,
      resource: REMINDER_RESOURCE,
      action: 'REMINDER_24H_SENT',
      createdAt: { gte: since }
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { resourceId: true, metadata: true }
  });
  const phone = normalizePhone(clientPhone);
  return records.find((item) => {
    const metadata = (item.metadata || {}) as Record<string, unknown>;
    return normalizePhone(String(metadata.clientPhone || '')) === phone;
  }) || null;
}

export async function handleAppointmentReminderReply(input: {
  salonId: string;
  clientPhone: string;
  text: string;
}) {
  const reply = normalizedReply(input.text);
  const wantsConfirm = ['confirmar', 'confirmo', 'confirmar presenca'].includes(reply);
  const wantsCancel = ['cancelar', 'cancelar horario', 'cancelar agendamento'].includes(reply);
  if (!wantsConfirm && !wantsCancel) return null;

  const reminder = await latestReminderForPhone(input.salonId, input.clientPhone);
  if (!reminder?.resourceId) return null;

  const appointment = await prisma.appointment.findFirst({
    where: { id: reminder.resourceId, salonId: input.salonId },
    include: { service: true, professional: true }
  });
  if (!appointment || appointment.status !== 'CONFIRMED' || appointment.startTime <= new Date()) return null;

  if (wantsConfirm) {
    const existing = await prisma.auditLog.findFirst({
      where: {
        salonId: input.salonId,
        resource: CONFIRMATION_RESOURCE,
        resourceId: appointment.id,
        action: 'CLIENT_CONFIRMED_ATTENDANCE'
      },
      select: { id: true }
    });
    if (!existing) {
      await prisma.auditLog.create({
        data: {
          action: 'CLIENT_CONFIRMED_ATTENDANCE',
          resource: CONFIRMATION_RESOURCE,
          resourceId: appointment.id,
          method: 'WHATSAPP',
          path: '/webhooks/whatsapp',
          salonId: input.salonId,
          metadata: { clientPhone: normalizePhone(input.clientPhone) }
        }
      });
      await createOperationalNotification({
        salonId: input.salonId,
        type: 'APPOINTMENT_CREATED',
        title: 'Cliente confirmou presença',
        message: `${appointment.clientName} confirmou presença em ${appointment.service.name} com ${appointment.professional.name}.`,
        appointmentId: appointment.id,
        professionalId: appointment.professionalId,
        clientName: appointment.clientName,
        severity: 'SUCCESS'
      });
    }
    return {
      handled: true as const,
      replyText: `Presença confirmada ✅\n\n${appointment.service.name}\n📅 ${formatAppointmentDate(appointment.startTime)}\nProfissional: ${appointment.professional.name}\n\nAté lá!`
    };
  }

  const minHours = cancellationMinHours();
  const hoursUntil = (appointment.startTime.getTime() - Date.now()) / HOUR_MS;
  if (hoursUntil < minHours) {
    return {
      handled: true as const,
      replyText: `O prazo de cancelamento automático encerrou. A política do salão exige no mínimo ${minHours} horas de antecedência. Entre em contato com a equipe para verificar uma exceção.`
    };
  }

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELED' } });
  await createOperationalNotification({
    salonId: input.salonId,
    type: 'APPOINTMENT_CANCELLED',
    title: 'Cliente cancelou pelo lembrete',
    message: `${appointment.clientName} cancelou ${appointment.service.name} de ${formatAppointmentDate(appointment.startTime)}.`,
    appointmentId: appointment.id,
    professionalId: appointment.professionalId,
    clientName: appointment.clientName,
    severity: 'WARNING'
  });

  return {
    handled: true as const,
    cancelledAppointment: { salonId: input.salonId, previousStartTime: appointment.startTime },
    replyText: `Cancelamento confirmado ✅\n\n${appointment.service.name}\n📅 ${formatAppointmentDate(appointment.startTime)}\n\nO horário foi liberado na agenda.`
  };
}

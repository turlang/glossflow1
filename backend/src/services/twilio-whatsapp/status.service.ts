import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createOperationalNotification } from '../appointment-notification.service';
import { normalizePhone } from '../whatsapp-agent.service';
import { fallbackTwilioSalon } from './salon.service';
import { stripWhatsappAddress, TwilioForm } from './security';

/** Persiste o callback de entrega e converte falhas em alerta operacional. */
export async function processTwilioStatusCallback(app: FastifyInstance, form: TwilioForm) {
  const messageSid = String(form.MessageSid || form.SmsSid || '').trim();
  const status = String(form.MessageStatus || form.SmsStatus || '').trim().toLowerCase();
  const errorCode = String(form.ErrorCode || '').trim();
  const errorMessage = String(form.ChannelStatusMessage || form.ErrorMessage || '').trim();
  if (!messageSid || !status) return;

  const sentMessage = await prisma.auditLog.findFirst({
    where: { resource: 'WhatsAppMessage', resourceId: messageSid },
    orderBy: { createdAt: 'desc' },
    select: { salonId: true, metadata: true }
  });

  let salonId = sentMessage?.salonId || '';
  if (!salonId) {
    const salon = await fallbackTwilioSalon(form.From || '');
    salonId = salon?.id || '';
  }

  if (!salonId) {
    app.log.warn({ messageSid, status }, 'Status Twilio recebido sem salão associado.');
    return;
  }

  await prisma.auditLog.create({
    data: {
      action: 'WHATSAPP_DELIVERY_STATUS',
      resource: 'WhatsAppDeliveryStatus',
      resourceId: messageSid,
      method: 'WEBHOOK',
      path: '/webhooks/whatsapp/twilio/status',
      salonId,
      metadata: {
        status,
        errorCode,
        errorMessage,
        to: normalizePhone(stripWhatsappAddress(form.To || '')),
        from: normalizePhone(stripWhatsappAddress(form.From || ''))
      }
    }
  });

  app.log.info({ salonId, messageSid, status, errorCode, errorMessage }, 'Status de entrega WhatsApp atualizado pela Twilio.');

  if (status === 'failed' || status === 'undelivered') {
    const reason = [errorCode ? `código ${errorCode}` : '', errorMessage].filter(Boolean).join(' · ');
    await createOperationalNotification({
      salonId,
      type: 'WHATSAPP_DELIVERY_FAILED',
      title: 'WhatsApp não entregue',
      message: `A Twilio aceitou a mensagem inicialmente, mas a entrega terminou como ${status.toUpperCase()}.${reason ? ` Provider: ${reason}` : ''}`,
      severity: 'WARNING'
    });
  }
}

import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { availabilityClarification, unavailableServiceDecision } from '../services/agent-intent.service';
import { guardAgentReply } from '../services/agent-response-guard.service';
import { handleAppointmentReminderReply } from '../services/appointment-reminder.service';
import { directAvailabilityFromText } from '../services/direct-availability.service';
import { hasSalonModule } from '../services/module-access.service';
import { confirmPendingBooking } from '../services/pending-booking.service';
import { handleWaitlistWhatsAppReply, matchWaitlistAfterAppointmentChange } from '../services/waitlist.service';
import {
  answerWhatsAppMessage,
  findSalonByWhatsApp,
  hasOpenHumanHandoff,
  isDuplicateWhatsAppMessage,
  normalizePhone,
  saveWhatsAppMessage
} from '../services/whatsapp-agent.service';
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from '../services/whatsapp.service';

type TwilioForm = Record<string, string>;

function stripWhatsappAddress(value: string) {
  return String(value || '').replace(/^whatsapp:/i, '').trim();
}

function webhookUrl(request: FastifyRequest) {
  const configured = String(process.env.TWILIO_WEBHOOK_URL || '').trim();
  if (configured) return configured;

  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || 'https';
  const host = forwardedHost || String(request.headers.host || '').trim();
  return `${protocol}://${host}${request.url}`;
}

function validTwilioSignature(url: string, params: TwilioForm, signature: string, authToken: string) {
  if (!url || !signature || !authToken) return false;

  const signed = Object.keys(params)
    .sort()
    .reduce((value, key) => `${value}${key}${String(params[key] ?? '')}`, url);
  const expected = createHmac('sha1', authToken).update(signed).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function stripServiceChoicePrompt(text: string) {
  return String(text || '')
    .replace(/\n\nSe quiser,\s*(?:escolha|me diga)[\s\S]*$/i, '')
    .trim();
}

function twilioTrialReplyEnabled() {
  return String(process.env.WHATSAPP_PROVIDER || '').toLowerCase() === 'twilio'
    && process.env.TWILIO_TRIAL_MODE === 'true'
    && Boolean(String(process.env.TWILIO_TRIAL_CONTENT_SID || '').trim());
}

async function agentModulesEnabled(salonId: string) {
  const entitlement = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { modulesConfigured: true, enabledModules: true }
  });
  if (!entitlement) return false;
  return hasSalonModule(entitlement, 'WHATSAPP')
    && hasSalonModule(entitlement, 'IA')
    && hasSalonModule(entitlement, 'AGENDA');
}

async function fallbackTwilioSalon(to: string) {
  const configuredFrom = normalizePhone(stripWhatsappAddress(process.env.TWILIO_WHATSAPP_FROM || ''));
  const target = normalizePhone(stripWhatsappAddress(to));
  if (configuredFrom && target && configuredFrom !== target) return null;

  const slug = process.env.TWILIO_DEFAULT_SALON_SLUG
    || process.env.DEFAULT_PUBLIC_SALON_SLUG
    || 'glossflow';
  return prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, whatsapp: true, openingHours: true }
  });
}

async function processTwilioInbound(app: FastifyInstance, form: TwilioForm) {
  const messageId = form.MessageSid || form.SmsMessageSid || '';
  const fromAddress = form.From || '';
  const toAddress = form.To || '';
  const from = stripWhatsappAddress(form.WaId || fromAddress);
  const to = stripWhatsappAddress(toAddress);
  const contactName = String(form.ProfileName || '').trim();
  const text = String(form.Body || '').trim();
  const numMedia = Number(form.NumMedia || 0);

  if (!messageId || !from || !to) {
    app.log.warn({ messageId, from, to }, 'Webhook Twilio WhatsApp sem campos obrigatórios.');
    return;
  }
  if (await isDuplicateWhatsAppMessage(messageId)) return;

  const salon = await findSalonByWhatsApp(to) || await fallbackTwilioSalon(toAddress);
  if (!salon) {
    app.log.warn({ to }, 'Webhook Twilio recebido para sender sem salão associado.');
    return;
  }

  if (!await agentModulesEnabled(salon.id)) {
    app.log.info({ salonId: salon.id }, 'Webhook Twilio ignorado: WhatsApp/IA/Agenda não habilitado.');
    return;
  }

  const inboundText = text || (numMedia > 0 ? '[mensagem com mídia]' : '[mensagem não textual]');
  await saveWhatsAppMessage({
    salonId: salon.id,
    providerMessageId: messageId,
    phone: from,
    direction: 'IN',
    text: inboundText
  });

  if (await hasOpenHumanHandoff(salon.id, from)) return;

  const reminderReply = text
    ? await handleAppointmentReminderReply({ salonId: salon.id, clientPhone: from, text })
    : null;

  if (reminderReply?.cancelledAppointment) {
    const cancelled = reminderReply.cancelledAppointment;
    setImmediate(() => {
      void matchWaitlistAfterAppointmentChange(cancelled)
        .catch((error) => app.log.error(error, 'Falha na lista de espera após cancelamento via Twilio.'));
    });
  }

  const waitlistReply = !reminderReply?.handled && text
    ? await handleWaitlistWhatsAppReply({
        salonId: salon.id,
        salonName: salon.name,
        clientPhone: from,
        clientName: contactName,
        text
      })
    : null;

  const confirmation = !reminderReply?.handled && !waitlistReply?.handled && text
    ? await confirmPendingBooking({
        salonId: salon.id,
        salonName: salon.name,
        clientPhone: from,
        clientName: contactName,
        text
      })
    : null;

  let rawReplyText: string;
  if (reminderReply?.handled) {
    rawReplyText = reminderReply.replyText;
  } else if (waitlistReply?.handled) {
    rawReplyText = waitlistReply.replyText;
  } else if (confirmation?.handled) {
    rawReplyText = confirmation.replyText;
  } else {
    const [serviceDecision, directAvailability] = text
      ? await Promise.all([
          unavailableServiceDecision(salon.id, text),
          directAvailabilityFromText({ salon, text })
        ])
      : [null, null];
    const clarification = text && !serviceDecision && !directAvailability
      ? await availabilityClarification(salon.id, text)
      : null;

    if (!text) {
      rawReplyText = 'No momento consigo atender mensagens de texto. Se preferir, posso encaminhar você para uma pessoa da equipe.';
    } else if (serviceDecision && directAvailability) {
      rawReplyText = `${stripServiceChoicePrompt(serviceDecision.reply)}\n\n${directAvailability}`;
    } else if (directAvailability) {
      rawReplyText = directAvailability;
    } else {
      rawReplyText = serviceDecision?.reply
        || clarification
        || await answerWhatsAppMessage({ salon, phone: from, clientName: contactName, text });
    }
  }

  const guarded = await guardAgentReply({
    salonId: salon.id,
    phone: from,
    userText: text,
    replyText: rawReplyText
  });
  const replyText = guarded.replyText;

  /**
   * O Try out WhatsApp da Twilio não aceita Body livre: exige um ContentSid
   * fornecido pela própria Twilio. Para QA do round-trip usamos o template
   * fixo do Trial somente aqui, sem alterar waitlist/notificações de negócio.
   * Em conta completa, a resposta livre volta automaticamente a usar Body.
   */
  const trialTemplateFallback = twilioTrialReplyEnabled();
  const result = trialTemplateFallback
    ? await sendWhatsAppTemplateMessage({
        to: from,
        templateName: String(process.env.TWILIO_TRIAL_CONTENT_SID || '').trim()
      })
    : await sendWhatsAppMessage({ to: from, message: replyText });

  const providerData = result as {
    messageId?: string;
    data?: { messages?: Array<{ id?: string }>; sid?: string };
  };
  const outboundId = providerData.messageId
    || providerData.data?.messages?.[0]?.id
    || providerData.data?.sid;

  if (result.ok) {
    await saveWhatsAppMessage({
      salonId: salon.id,
      providerMessageId: outboundId,
      phone: from,
      direction: 'OUT',
      text: trialTemplateFallback
        ? '[Twilio Trial] Template fixo de QA enviado. A resposta livre do agente fica disponível após remover as limitações do Trial.'
        : replyText
    });

    if (trialTemplateFallback) {
      app.log.info({ salonId: salon.id, phone: from, outboundId }, 'Resposta do webhook validada via ContentSid do Twilio Trial.');
    }
  } else {
    app.log.error({ salonId: salon.id, phone: from, result }, 'Falha ao responder mensagem recebida pela Twilio.');
  }
}

/**
 * Webhook público da Twilio para mensagens recebidas pelo WhatsApp.
 * A Twilio envia application/x-www-form-urlencoded e assina a requisição em
 * X-Twilio-Signature com HMAC-SHA1 usando o Primary Auth Token da conta.
 */
export async function twilioWhatsAppWebhookRoutes(app: FastifyInstance) {
  if (!app.hasContentTypeParser('application/x-www-form-urlencoded')) {
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
      try {
        const params = new URLSearchParams(String(body || ''));
        done(null, Object.fromEntries(params.entries()));
      } catch (error) {
        done(error as Error, undefined);
      }
    });
  }

  app.post('/webhooks/whatsapp/twilio', async (request: FastifyRequest, reply) => {
    const params = (request.body || {}) as TwilioForm;
    const signatureHeader = request.headers['x-twilio-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : String(signatureHeader || '');
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const url = webhookUrl(request);

    if (!authToken && process.env.NODE_ENV === 'production') {
      return reply.status(503).send({ message: 'TWILIO_AUTH_TOKEN é obrigatório para validar o webhook.' });
    }

    if (authToken && !validTwilioSignature(url, params, signature, authToken)) {
      app.log.warn({ url }, 'Assinatura X-Twilio-Signature inválida.');
      return reply.status(401).send({ message: 'Assinatura do webhook Twilio inválida.' });
    }

    reply
      .status(200)
      .type('text/xml; charset=utf-8')
      .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    setImmediate(() => {
      void processTwilioInbound(app, params)
        .catch((error) => app.log.error(error, 'Erro no processamento assíncrono do webhook Twilio WhatsApp.'));
    });
    return reply;
  });
}

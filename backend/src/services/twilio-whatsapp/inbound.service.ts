import { FastifyInstance } from 'fastify';
import { availabilityClarification, unavailableServiceDecision } from '../agent-intent.service';
import { guardAgentReply } from '../agent-response-guard.service';
import { handleAppointmentReminderReply } from '../appointment-reminder.service';
import { directAvailabilityFromText } from '../direct-availability.service';
import { confirmPendingBooking } from '../pending-booking.service';
import { handleWaitlistWhatsAppReply, matchWaitlistAfterAppointmentChange } from '../waitlist.service';
import { answerWhatsAppMessage } from '../whatsapp-agent/orchestrator.service';
import {
  findSalonByWhatsApp,
  hasOpenHumanHandoff,
  isDuplicateWhatsAppMessage,
  saveWhatsAppMessage
} from '../whatsapp-agent/conversation.repository';
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from '../whatsapp.service';
import { agentModulesEnabled, fallbackTwilioSalon } from './salon.service';
import { stripWhatsappAddress, twilioTrialReplyEnabled, TwilioForm } from './security';

function stripServiceChoicePrompt(text: string) {
  return String(text || '')
    .replace(/\n\nSe quiser,\s*(?:escolha|me diga)[\s\S]*$/i, '')
    .trim();
}

/**
 * Pipeline inbound Twilio: deduplicação -> tenant -> módulos -> automações
 * especializadas -> agente -> guardrail -> provider de saída -> auditoria.
 */
export async function processTwilioInbound(app: FastifyInstance, form: TwilioForm) {
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
   * O Try out WhatsApp da Twilio exige ContentSid. O template fixo fica
   * restrito ao Trial e não altera waitlist/notificações de negócio.
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

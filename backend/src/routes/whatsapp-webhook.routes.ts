import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { availabilityClarification } from '../services/agent-intent.service';
import { hasSalonModule } from '../services/module-access.service';
import {
  answerWhatsAppMessage,
  findSalonByWhatsApp,
  hasOpenHumanHandoff,
  isDuplicateWhatsAppMessage,
  saveWhatsAppMessage
} from '../services/whatsapp-agent.service';
import { sendWhatsAppMessage } from '../services/whatsapp.service';

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
};

type MetaValue = {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: MetaMessage[];
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }>;
};

function validSignature(rawBody: string, signature: string, secret: string) {
  if (!rawBody || !signature || !secret) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function fallbackSalon(phoneNumberId: string) {
  if (!phoneNumberId || phoneNumberId !== process.env.WHATSAPP_PHONE_NUMBER_ID) return null;
  const slug = process.env.DEFAULT_PUBLIC_SALON_SLUG || 'glossflow';
  return prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, whatsapp: true, openingHours: true }
  });
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

async function processPayload(app: FastifyInstance, payload: MetaWebhookPayload) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const displayNumber = value.metadata?.display_phone_number || '';
      const phoneNumberId = value.metadata?.phone_number_id || '';
      const contactName = value.contacts?.[0]?.profile?.name || '';

      for (const message of value.messages || []) {
        const messageId = message.id || '';
        const from = message.from || value.contacts?.[0]?.wa_id || '';
        if (!messageId || !from) continue;
        if (await isDuplicateWhatsAppMessage(messageId)) continue;

        const salon = await findSalonByWhatsApp(displayNumber) || await fallbackSalon(phoneNumberId);
        if (!salon) {
          app.log.warn({ displayNumber, phoneNumberId }, 'Webhook WhatsApp recebido para número sem salão associado.');
          continue;
        }

        if (!await agentModulesEnabled(salon.id)) {
          app.log.info({ salonId: salon.id }, 'Webhook ignorado: agente WhatsApp/IA/Agenda não habilitado para este salão.');
          continue;
        }

        const text = message.type === 'text' ? String(message.text?.body || '').trim() : '';
        const inboundText = text || `[mensagem ${message.type || 'não suportada'}]`;
        await saveWhatsAppMessage({ salonId: salon.id, providerMessageId: messageId, phone: from, direction: 'IN', text: inboundText });

        if (await hasOpenHumanHandoff(salon.id, from)) continue;

        const clarification = text ? await availabilityClarification(salon.id, text) : null;
        const replyText = text
          ? (clarification || await answerWhatsAppMessage({ salon, phone: from, clientName: contactName, text }))
          : 'No momento consigo atender mensagens de texto. Se preferir, posso encaminhar você para uma pessoa da equipe.';

        const result = await sendWhatsAppMessage({ to: from, message: replyText, phoneNumberId });
        const providerData = result as { data?: { messages?: Array<{ id?: string }> } };
        const outboundId = providerData.data?.messages?.[0]?.id;
        await saveWhatsAppMessage({ salonId: salon.id, providerMessageId: outboundId, phone: from, direction: 'OUT', text: replyText });

        if (!result.ok) {
          app.log.error({ salonId: salon.id, phone: from, result }, 'Falha ao responder mensagem do agente WhatsApp.');
        }
      }
    }
  }
}

/** Webhook público da Meta WhatsApp Cloud API. */
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get('/webhooks/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
      return reply.type('text/plain').send(challenge);
    }
    return reply.status(403).send({ message: 'Falha na verificação do webhook.' });
  });

  app.post('/webhooks/whatsapp', async (request: FastifyRequest, reply) => {
    const secret = process.env.WHATSAPP_APP_SECRET || '';
    const signatureHeader = request.headers['x-hub-signature-256'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : String(signatureHeader || '');
    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody || '';

    if (secret) {
      if (!validSignature(rawBody, signature, secret)) {
        return reply.status(401).send({ message: 'Assinatura do webhook inválida.' });
      }
    } else if (process.env.NODE_ENV === 'production' && process.env.WHATSAPP_DRY_RUN !== 'true') {
      return reply.status(503).send({ message: 'WHATSAPP_APP_SECRET é obrigatório para webhook real em produção.' });
    }

    const payload = request.body as MetaWebhookPayload;
    if (payload?.object !== 'whatsapp_business_account') {
      return reply.status(200).send({ received: false });
    }

    reply.status(200).send({ received: true });
    setImmediate(() => {
      void processPayload(app, payload).catch((error) => app.log.error(error, 'Erro no processamento assíncrono do webhook WhatsApp.'));
    });
    return reply;
  });
}

import { FastifyInstance, FastifyRequest } from 'fastify';
import { processTwilioInbound } from '../services/twilio-whatsapp/inbound.service';
import { processTwilioStatusCallback } from '../services/twilio-whatsapp/status.service';
import { TwilioForm, validTwilioSignature, webhookUrl } from '../services/twilio-whatsapp/security';
import { recordDependencyMetric } from './metrics';

function signatureFromRequest(request: FastifyRequest) {
  const header = request.headers['x-twilio-signature'];
  return Array.isArray(header) ? header[0] : String(header || '');
}

function validateTwilioRequest(request: FastifyRequest, params: TwilioForm) {
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const url = webhookUrl(request);
  const signature = signatureFromRequest(request);
  return {
    authToken,
    url,
    valid: !authToken || validTwilioSignature(url, params, signature, authToken)
  };
}

async function observeWebhookWork(operation: string, work: () => Promise<unknown>) {
  const startedAt = Date.now();
  try {
    await work();
    recordDependencyMetric({
      dependency: 'twilio-webhook',
      operation,
      ok: true,
      latencyMs: Date.now() - startedAt,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    recordDependencyMetric({
      dependency: 'twilio-webhook',
      operation,
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name || 'PROCESSING_ERROR' : 'PROCESSING_ERROR',
      createdAt: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Webhook público Twilio. A rota cuida somente de transporte, parser,
 * assinatura e ACK; processamento de negócio fica em serviços isolados.
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

  app.post('/webhooks/whatsapp/twilio/status', async (request: FastifyRequest, reply) => {
    const params = (request.body || {}) as TwilioForm;
    const validation = validateTwilioRequest(request, params);

    if (!validation.authToken && process.env.NODE_ENV === 'production') {
      return reply.status(503).send({ message: 'TWILIO_AUTH_TOKEN é obrigatório para validar o callback.' });
    }
    if (!validation.valid) {
      app.log.warn({ url: validation.url }, 'Assinatura X-Twilio-Signature inválida no callback de status.');
      return reply.status(401).send({ message: 'Assinatura do callback Twilio inválida.' });
    }

    reply.status(200).send({ received: true });
    setImmediate(() => {
      void observeWebhookWork('status-callback', () => processTwilioStatusCallback(app, params))
        .catch((error) => app.log.error(error, 'Erro ao processar status de entrega Twilio.'));
    });
    return reply;
  });

  app.post('/webhooks/whatsapp/twilio', async (request: FastifyRequest, reply) => {
    const params = (request.body || {}) as TwilioForm;
    const validation = validateTwilioRequest(request, params);

    if (!validation.authToken && process.env.NODE_ENV === 'production') {
      return reply.status(503).send({ message: 'TWILIO_AUTH_TOKEN é obrigatório para validar o webhook.' });
    }
    if (!validation.valid) {
      app.log.warn({ url: validation.url }, 'Assinatura X-Twilio-Signature inválida.');
      return reply.status(401).send({ message: 'Assinatura do webhook Twilio inválida.' });
    }

    reply
      .status(200)
      .type('text/xml; charset=utf-8')
      .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    setImmediate(() => {
      void observeWebhookWork('inbound-processing', () => processTwilioInbound(app, params))
        .catch((error) => app.log.error(error, 'Erro no processamento assíncrono do webhook Twilio WhatsApp.'));
    });
    return reply;
  });
}
